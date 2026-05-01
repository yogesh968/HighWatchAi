"use client";

import { motion } from "framer-motion";
import { FileText, Inbox } from "lucide-react";

export function DocsPanel({
  docs,
  onDocumentClick,
}: {
  docs: { id: string; name: string; status: string }[];
  onDocumentClick?: (name: string) => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-28 text-slate-600 gap-2">
        <Inbox className="w-6 h-6" />
        <p className="text-xs">No documents synced yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1 -mr-1 pr-1">
      {docs.map((doc, idx) => (
        <motion.button
          key={`${doc.id}-${idx}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.03 }}
          onClick={() => onDocumentClick?.(doc.name)}
          title="Click to summarize"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-500/20 border border-transparent text-left transition-all group active:scale-[0.98]"
        >
          <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-colors">
            <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <p className="text-xs font-medium truncate text-slate-400 group-hover:text-white transition-colors">{doc.name}</p>
        </motion.button>
      ))}
    </div>
  );
}
