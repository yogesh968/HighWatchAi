"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Database, Search, Zap, LogIn, Loader2, Brain } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/utils/apiBaseUrl";

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  })
};

function HomeContent() {
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "invalid_state") {
      alert("Login failed: Invalid state. Please try again.");
    }
    axios.get(`${getApiBaseUrl()}/auth/status`)
      .then(r => { if (r.data.authenticated) setIsAuthenticated(true); })
      .catch(() => {});
  }, [searchParams]);

  const go = async (dest: "login" | "dashboard") => {
    setLoading(true);
    try {
      const r = await axios.get(`${getApiBaseUrl()}/auth/status`);
      if (r.data.authenticated) { window.location.href = "/dashboard"; return; }
      if (dest === "login") window.location.href = `${getApiBaseUrl()}/auth/login`;
      else window.location.href = "/dashboard";
    } catch {
      window.location.href = `${getApiBaseUrl()}/auth/login`;
    }
  };

  const features = [
    { icon: Database, title: "Instant Drive Sync", desc: "Securely ingest PDFs, Docs, and TXT files from your Google Drive in seconds." },
    { icon: Zap, title: "LLaMA 3.3 · 70B", desc: "Groq-powered inference delivers blazing-fast, high-quality answers." },
    { icon: Search, title: "FAISS Vector Search", desc: "Semantic retrieval pinpoints the exact paragraph you need every time." },
  ];

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#080c14] text-white px-6 py-24 selection:bg-indigo-500/30">

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-violet-700/8 blur-[100px]" />
        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto w-full">

        {/* Badge */}
        <motion.div custom={0} variants={fade} initial="hidden" animate="show"
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-widest uppercase"
        >
          <Brain className="w-3.5 h-3.5" />
          Highwatch RAG · LLaMA 3.3 70B
        </motion.div>

        {/* Headline */}
        <motion.h1 custom={1} variants={fade} initial="hidden" animate="show"
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
        >
          Your Google Drive,{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            now intelligent.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p custom={2} variants={fade} initial="hidden" animate="show"
          className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed"
        >
          Connect your Drive, ask complex questions, and get precise answers backed by exact citations — zero friction.
        </motion.p>

        {/* CTAs */}
        <motion.div custom={3} variants={fade} initial="hidden" animate="show"
          className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
        >
          {isAuthenticated ? (
            <button onClick={() => { window.location.href = "/dashboard"; }}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95"
            >
              <ArrowRight className="w-4 h-4" /> Go to Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => go("login")} disabled={loading}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {loading ? "Authenticating..." : "Login with Google"}
              </button>
              <button onClick={() => go("dashboard")}
                className="flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-8 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
              >
                Open Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mx-auto mt-24 px-2">
        {features.map((f, i) => (
          <motion.div key={i} custom={i + 4} variants={fade} initial="hidden" animate="show"
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/30 p-7 transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:bg-indigo-500/25 transition-colors">
              <f.icon className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex gap-6 text-xs text-slate-600 z-10">
        <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#080c14] text-white">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
