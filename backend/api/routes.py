import os
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow

from connectors.gdrive import get_files_to_sync, download_items, SCOPES, TOKEN_FILE
from processing.parser import process_files
from embedding.embedder import embed_chunks
from search.vector_store import add_to_faiss, search_faiss, get_document_metadata
from db import files_collection, chats_collection
from groq import Groq

router = APIRouter()

STATES_FILE = "oauth_states.json"

# ── helpers ──────────────────────────────────────────────────────────────────

def _get_env(key: str, default: str) -> str:
    return os.getenv(key, default).rstrip("/")

def _load_states() -> dict:
    if os.path.exists(STATES_FILE):
        try:
            with open(STATES_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def _save_states(states: dict):
    with open(STATES_FILE, "w") as f:
        json.dump(states, f)

def _get_user_email() -> str:
    try:
        from connectors.gdrive import get_drive_service
        service = get_drive_service()
        about = service.about().get(fields="user").execute()
        return about["user"]["emailAddress"]
    except Exception:
        return "default_user"

def _has_refresh_token() -> bool:
    try:
        with open(TOKEN_FILE) as f:
            return bool(json.load(f).get("refresh_token"))
    except Exception:
        return False

# ── auth ─────────────────────────────────────────────────────────────────────

@router.get("/auth/status")
def auth_status():
    return {"authenticated": os.path.exists(TOKEN_FILE)}

@router.get("/auth/login")
def auth_login():
    API_URL = _get_env("API_URL", "http://127.0.0.1:8000")
    credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")

    if not os.path.exists(credentials_path):
        raise HTTPException(status_code=500, detail=f"credentials.json not found at {credentials_path}")

    flow = Flow.from_client_secrets_file(
        credentials_path,
        scopes=SCOPES,
        redirect_uri=f"{API_URL}/auth/callback"
    )

    # Only show consent screen the very first time (no refresh token yet)
    prompt = "consent" if not _has_refresh_token() else "select_account"
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt=prompt,
        include_granted_scopes="true"
    )

    states = _load_states()
    states[state] = flow.code_verifier
    _save_states(states)

    return RedirectResponse(url=auth_url)

@router.get("/auth/callback")
def auth_callback(state: str, code: str):
    FRONTEND_URL = _get_env("FRONTEND_URL", "http://localhost:3000")
    API_URL = _get_env("API_URL", "http://127.0.0.1:8000")

    states = _load_states()
    if state not in states:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=invalid_state")

    credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
    flow = Flow.from_client_secrets_file(
        credentials_path,
        scopes=SCOPES,
        redirect_uri=f"{API_URL}/auth/callback",
        state=state
    )
    flow.code_verifier = states[state]
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Preserve existing refresh_token if new creds don't include one
    if not creds.refresh_token and os.path.exists(TOKEN_FILE):
        try:
            from google.oauth2.credentials import Credentials as GCreds
            old = GCreds.from_authorized_user_file(TOKEN_FILE, SCOPES)
            if old.refresh_token:
                data = json.loads(creds.to_json())
                data["refresh_token"] = old.refresh_token
                with open(TOKEN_FILE, "w") as f:
                    json.dump(data, f)
                del states[state]
                _save_states(states)
                return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?sync=true")
        except Exception:
            pass

    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())

    del states[state]
    _save_states(states)

    return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?sync=true")

@router.post("/disconnect-drive")
def disconnect_drive():
    # Keep token.json so Google doesn't show the warning screen again
    # Only clear local synced files
    sync_dir = "synced_docs"
    if os.path.exists(sync_dir):
        for fname in os.listdir(sync_dir):
            fp = os.path.join(sync_dir, fname)
            if os.path.isfile(fp):
                os.remove(fp)
    if os.path.exists(STATES_FILE):
        os.remove(STATES_FILE)
    return {"status": "success"}

# ── sync ─────────────────────────────────────────────────────────────────────

@router.post("/sync-drive")
def sync_drive(force: Optional[bool] = False, folder_url: Optional[str] = None):
    import gc, time

    if not os.path.exists(TOKEN_FILE):
        raise HTTPException(status_code=401, detail="Not authenticated. Please login first.")

    if force:
        try:
            user_email = _get_user_email()
            files_collection.delete_many({"user_email": user_email})
        except Exception:
            pass
        sync_dir = "synced_docs"
        if os.path.exists(sync_dir):
            for fname in os.listdir(sync_dir):
                fp = os.path.join(sync_dir, fname)
                if os.path.isfile(fp):
                    os.remove(fp)

    items, user_email = get_files_to_sync(page_size=20, force=bool(force), folder_url=folder_url)
    if not items:
        return {"status": "success", "files_processed": 0, "message": "No new files to sync.", "files": []}

    t0 = time.time()
    downloaded = download_items(items, user_email); gc.collect()

    if downloaded:
        chunks = process_files(downloaded); gc.collect()
        if chunks:
            embedded = embed_chunks(chunks); gc.collect()
            add_to_faiss(embedded); gc.collect()

    print(f"Sync done in {round(time.time()-t0, 2)}s")
    return {
        "status": "success",
        "files_processed": len(items),
        "message": f"Synced and indexed {len(downloaded)} files.",
        "files": [{"id": f["id"], "name": f["name"]} for f in items]
    }

@router.get("/storage/stats")
def storage_stats():
    try:
        from search.vector_store import index, load_chunks
        user_email = _get_user_email()
        is_processing = user_email in active_syncs
        vector_count = index.ntotal if index else 0
        faiss_size = os.path.getsize("faiss_index.bin") if os.path.exists("faiss_index.bin") else 0
        docs_size, docs_count = 0, 0
        if os.path.exists("synced_docs"):
            for fname in os.listdir("synced_docs"):
                fp = os.path.join("synced_docs", fname)
                if os.path.isfile(fp):
                    docs_size += os.path.getsize(fp)
                    docs_count += 1
        return {
            "vectors": vector_count,
            "faiss_size_kb": round(faiss_size / 1024, 2),
            "docs_size_kb": round(docs_size / 1024, 2),
            "docs_count": docs_count,
            "status": "Processing in background..." if is_processing else "Ready"
        }
    except Exception:
        return {"vectors": 0, "faiss_size_kb": 0, "docs_size_kb": 0, "docs_count": 0, "status": "Error"}

active_syncs: set = set()

# ── chat ─────────────────────────────────────────────────────────────────────

@router.get("/chat/history")
def chat_history():
    try:
        user_email = _get_user_email()
        if user_email == "default_user":
            return {"history": []}
        cursor = chats_collection.find({"user_email": user_email})
        try:
            cursor = cursor.sort("timestamp", 1)
        except Exception:
            pass
        history = []
        for c in cursor:
            msg = {"role": c["role"], "content": c["content"]}
            if c.get("sources"):
                msg["sources"] = c["sources"]
            history.append(msg)
        return {"history": history}
    except Exception:
        return {"history": []}

@router.delete("/chat")
def clear_chat():
    user_email = _get_user_email()
    result = chats_collection.delete_many({"user_email": user_email})
    deleted = result.deleted_count if hasattr(result, "deleted_count") else 0
    return {"status": "success", "deleted": deleted}

# ── ask ───────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    query: str
    filter_metadata: Optional[Dict[str, str]] = None

class Source(BaseModel):
    doc_id: str
    name: str
    chunk_text: str

class AskResponse(BaseModel):
    answer: str
    sources: List[Source]

SYSTEM_PROMPT = """You are Highwatch, an intelligent AI assistant integrated with the user's Google Drive.
Answer questions using ONLY the provided context from their documents.
Be concise, clear, and use markdown formatting.
If the answer is not in the context, say so honestly — never hallucinate."""

@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    user_email = _get_user_email()

    chats_collection.insert_one({
        "user_email": user_email,
        "role": "user",
        "content": req.query,
        "timestamp": datetime.utcnow()
    })

    filter_metadata = req.filter_metadata
    faiss_query = req.query
    prefix = "Please provide a comprehensive summary of the document: "
    if req.query.startswith(prefix):
        doc_name = req.query[len(prefix):].strip()
        filter_metadata = filter_metadata or {"name": doc_name}
        faiss_query = f"Overview and summary of {doc_name}"

    top_chunks = search_faiss(faiss_query, k=15, filters=filter_metadata)
    if not top_chunks:
        return AskResponse(
            answer="I couldn't find relevant information in your synced documents.",
            sources=[]
        )

    context_parts, sources = [], []
    for chunk in top_chunks:
        doc_id = chunk["doc_id"]
        text = chunk["text"]
        meta = get_document_metadata(doc_id)
        doc_name = meta.get("name", "Unknown") if meta else "Unknown"
        context_parts.append(f"Document: {doc_name}\n{text}")
        if not any(s.doc_id == doc_id for s in sources):
            sources.append(Source(doc_id=doc_id, name=doc_name, chunk_text=text))

    # Build message history (last 10)
    cursor = chats_collection.find({"user_email": user_email})
    try:
        cursor = cursor.sort("timestamp", 1)
    except Exception:
        pass
    history = list(cursor)[-10:]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for c in history:
        if c["content"] != req.query:
            messages.append({"role": "user" if c["role"] == "user" else "assistant", "content": c["content"]})

    messages.append({"role": "user", "content": f"Context:\n{chr(10).join(context_parts)}\n\nQuestion:\n{req.query}"})

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set.")

    try:
        client = Groq(api_key=groq_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.4,
            max_tokens=2048
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        if "rate_limit" in str(e).lower() or "429" in str(e):
            raise HTTPException(status_code=429, detail="Rate limit reached. Please wait and try again.")
        raise HTTPException(status_code=500, detail=str(e))

    chats_collection.insert_one({
        "user_email": user_email,
        "role": "ai",
        "content": answer,
        "sources": [s.dict() for s in sources],
        "timestamp": datetime.utcnow()
    })

    return AskResponse(answer=answer, sources=sources)
