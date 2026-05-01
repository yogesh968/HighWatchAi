"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, FileText, Loader2, Trash2, Brain, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";
import { getApiBaseUrl } from "@/utils/apiBaseUrl";

interface Message {
  role: "user" | "ai";
  content: string;
  sources?: { doc_id: string; name: string; chunk_text: string }[];
}

export function ChatInterface() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    axios.get(`${getApiBaseUrl()}/chat/history?t=${Date.now()}`)
      .then(r => { if (r.data?.history) setMessages(r.data.history); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { docName } = (e as CustomEvent<{ docName: string }>).detail ?? {};
      if (docName) handleSubmit(undefined, `Please provide a comprehensive summary of the document: ${docName}`);
    };
    window.addEventListener("requestDocumentSummary", handler);
    return () => window.removeEventListener("requestDocumentSummary", handler);
  }, [loading]);

  const handleSubmit = async (e?: React.FormEvent, override?: string) => {
    if (e) e.preventDefault();
    const userQuery = (override ?? query).trim();
    if (!userQuery || loading) return;
    setQuery("");
    setMessages(p => [...p, { role: "user", content: userQuery }]);
    setLoading(true);
    try {
      const res = await axios.post(`${getApiBaseUrl()}/ask`, { query: userQuery });
      setMessages(p => [...p, { role: "ai", content: res.data.answer, sources: res.data.sources }]);
    } catch (err: any) {
      let msg = "Sorry, I encountered an error answering that.";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        msg = detail.includes("Rate limit") ? "Rate limit reached. Please wait a moment and try again." : `Error: ${detail}`;
      }
      setMessages(p => [...p, { role: "ai", content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (loading || messages.length === 0) return;
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
    try {
      setLoading(true);
      await axios.delete(`${getApiBaseUrl()}/chat`);
      setMessages([]);
      setConfirmClear(false);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#080c14]">

      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.07] bg-[#0d1220] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
          <span className="text-sm font-medium text-white/70">AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClearChat} disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
              confirmClear
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmClear ? "Confirm clear?" : "Clear chat"}
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[55vh] text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                <Brain className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white/80 mb-1">How can I help you?</p>
                <p className="text-sm text-slate-500 max-w-xs">Ask anything about the documents in your synced Google Drive.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["Summarize my latest document", "What are the key points?", "Find information about..."].map(s => (
                  <button key={s} onClick={() => setQuery(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user"
                    ? "bg-white/[0.07] border border-white/[0.08]"
                    : "bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                }`}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-slate-300" />
                    : <Sparkles className="w-4 h-4 text-white" />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-[#111827] border border-white/[0.07] text-slate-200 rounded-tl-sm"
                  }`}>
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-white prose-strong:text-white prose-code:text-indigo-300 prose-pre:bg-black/40">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <button key={i}
                          onClick={() => handleSubmit(undefined, `Please provide a comprehensive summary of the document: ${src.name}`)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all"
                          title="Click to summarize"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[180px]">{src.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#111827] border border-white/[0.07] flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-sm text-slate-400">Analyzing documents...</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2 bg-gradient-to-t from-[#080c14] to-transparent shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-3 bg-[#111827] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-indigo-500/40 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <textarea
              ref={inputRef}
              rows={1}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your documents..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button type="submit" disabled={!query.trim() || loading}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-600 mt-2">
            LLaMA 3.3 can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
