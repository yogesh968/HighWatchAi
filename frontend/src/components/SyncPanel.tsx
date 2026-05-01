"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, LogOut, FolderSync } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/utils/apiBaseUrl";

export function SyncPanel({
  onSyncSuccess,
  autoSync = false,
}: {
  onSyncSuccess: (docs: { id: string; name: string; status: string }[]) => void;
  autoSync?: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [folderUrl, setFolderUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error" | "processing">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const poll = async () => {
      try {
        const r = await axios.get(`${getApiBaseUrl()}/storage/stats`);
        if (r.data.status === "Processing in background...") {
          setStatus("processing");
          setMessage("Indexing documents in background...");
        } else if (status === "processing" && r.data.status === "Ready") {
          setStatus("success");
          setMessage("Indexing complete! Ready to query.");
        }
      } catch { /* ignore */ }
    };
    if (status === "processing" || status === "success") {
      poll();
      interval = setInterval(poll, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [status]);

  useEffect(() => { if (autoSync) handleSync(true); }, [autoSync]);

  const handleSync = async (force = false) => {
    setSyncing(true);
    setStatus("idle");
    setMessage(force ? "Force syncing from Google Drive..." : "Syncing from Google Drive...");
    try {
      const params = new URLSearchParams();
      if (force) params.append("force", "true");
      if (folderUrl.trim()) params.append("folder_url", folderUrl.trim());
      const res = await axios.post(`${getApiBaseUrl()}/sync-drive?${params}`);
      setStatus("success");
      setMessage(res.data.message || `Synced ${res.data.files_processed} files.`);
      if (res.data.files?.length > 0) {
        onSyncSuccess(res.data.files.map((f: any) => ({ id: f.id, name: f.name, status: "Synced" })));
      }
      router.replace("/dashboard");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${getApiBaseUrl()}/disconnect-drive`);
      await new Promise(r => setTimeout(r, 400));
      router.push("/");
    } catch {
      setStatus("error");
      setMessage("Failed to logout.");
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input
        type="text"
        placeholder="Folder URL (optional)"
        value={folderUrl}
        onChange={e => setFolderUrl(e.target.value)}
        disabled={syncing}
        className="w-full bg-[#080c14] border border-white/[0.08] text-white placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/40 transition-colors"
      />

      <button onClick={() => handleSync(false)} disabled={syncing}
        className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-all active:scale-95"
      >
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5" />}
        {syncing ? "Syncing..." : "Sync Drive"}
      </button>

      <button onClick={() => handleSync(true)} disabled={syncing}
        className="w-full py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-50 transition-all"
      >
        <RefreshCw className="w-3 h-3" /> Force Sync All
      </button>

      <button onClick={handleLogout} disabled={syncing}
        className="w-full py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
      >
        <LogOut className="w-3 h-3" /> Logout & Disconnect
      </button>

      {status !== "idle" && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className={`p-2.5 rounded-lg flex items-start gap-2 text-xs ${
            status === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" :
            status === "processing" ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300" :
            "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> :
           status === "processing" ? <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin" /> :
           <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{message}</span>
        </motion.div>
      )}
    </div>
  );
}
