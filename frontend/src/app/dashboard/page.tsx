"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { SyncPanel } from "@/components/SyncPanel";
import { DocsPanel } from "@/components/DocsPanel";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { Brain } from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from "@/utils/apiBaseUrl";

function DashboardContent() {
  const [docs, setDocs] = useState<{ id: string; name: string; status: string }[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const shouldAutoSync = searchParams.get("sync") === "true";

  useEffect(() => {
    axios.get(`${getApiBaseUrl()}/auth/status`)
      .then(r => { if (r.data.authenticated) setIsAuthenticated(true); else router.push("/"); })
      .catch(() => router.push("/"));
  }, [router]);

  const handleSyncSuccess = (newDocs: { id: string; name: string; status: string }[]) => {
    setDocs(prev => {
      const ids = new Set(prev.map(d => d.id));
      return [...newDocs.filter(d => !ids.has(d.id)), ...prev];
    });
  };

  const handleDocumentClick = (docName: string) => {
    window.dispatchEvent(new CustomEvent("requestDocumentSummary", { detail: { docName } }));
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080c14] text-slate-400 text-sm">
        Verifying access...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#080c14] text-white overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 flex flex-col border-r border-white/[0.07] bg-[#0d1220]">

        {/* Brand */}
        <Link href="/" className="h-14 flex items-center gap-3 px-5 border-b border-white/[0.07] hover:bg-white/[0.03] transition-colors group">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.5)] group-hover:shadow-[0_0_18px_rgba(99,102,241,0.7)] transition-shadow">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-white/90 tracking-wide">Highwatch RAG</span>
        </Link>

        {/* Sync */}
        <div className="p-4 border-b border-white/[0.07]">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Drive Sync</p>
          <SyncPanel onSyncSuccess={handleSyncSuccess} autoSync={shouldAutoSync} />
        </div>

        {/* Docs */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Knowledge Base</p>
          <DocsPanel docs={docs} onDocumentClick={handleDocumentClick} />
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface />
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#080c14] text-slate-400 text-sm">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
