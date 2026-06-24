"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Send, Loader2, Zap, BookOpen, RefreshCw } from "lucide-react";
import { usePS13Store } from "@/store";
import { streamCopilotUrl, queryCopilot } from "@/lib/api";

const QUICK_PROMPTS = [
  "What is likely to fail next?",
  "Why is risk elevated on HUB-RTR-01?",
  "What should I do before SLA impact?",
  "Explain the blast radius of MPLS-PE-01 failure",
  "What caused the current BGP instability?",
];

export default function CopilotPanel() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    copilotMessages, addCopilotMessage, updateLastCopilotMessage,
    selectedNode, setHighlightedNodes, clearCopilot,
  } = usePS13Store();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [copilotMessages]);

  async function sendMessage(question?: string) {
    const q = question ?? input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);

    // Add user message
    addCopilotMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content: q,
      referenced_nodes: [],
      referenced_runbooks: [],
      timestamp: new Date().toISOString(),
    });

    // Add empty assistant message (will stream into it)
    const assistantId = `assistant-${Date.now()}`;
    addCopilotMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      referenced_nodes: [],
      referenced_runbooks: [],
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });

    try {
      // Stream via EventSource (SSE)
      const url = streamCopilotUrl(q, selectedNode?.node_id);
      const sse = new EventSource(url);
      let accumulated = "";

      sse.onmessage = (e) => {
        if (e.data === "[DONE]") {
          sse.close();
          updateLastCopilotMessage(accumulated, true);
          // Highlight referenced nodes
          const knownNodes = [
            "HUB-RTR-01","MPLS-PE-01","MPLS-PE-02","SDWAN-CTRL",
            "SPOKE-RTR-A","SPOKE-RTR-B","SPOKE-RTR-C","SPOKE-RTR-D",
            "BGP-PEER-01","SVC-VOIP","SVC-ERP","SVC-VIDEO",
          ];
          const refs = knownNodes.filter((n) => accumulated.toUpperCase().includes(n));
          setHighlightedNodes(refs);
          setTimeout(() => setHighlightedNodes([]), 8000);
          setLoading(false);
          return;
        }
        accumulated += e.data;
        updateLastCopilotMessage(accumulated, false);
      };

      sse.onerror = () => {
        sse.close();
        // Fallback to non-streaming
        queryCopilot(q, selectedNode?.node_id).then((resp) => {
          updateLastCopilotMessage(resp.answer, true);
          setHighlightedNodes(resp.referenced_nodes ?? []);
          setTimeout(() => setHighlightedNodes([]), 8000);
        }).finally(() => setLoading(false));
      };
    } catch (err) {
      updateLastCopilotMessage("⚠️ Copilot connection error. Ensure backend is running.", true);
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-plasma/20 border border-plasma/40 flex items-center justify-center">
            <Brain size={14} className="text-plasma" />
          </div>
          <div>
            <div className="text-sm font-display font-bold text-white">ARIA Copilot</div>
            <div className="text-[10px] text-white/30 font-mono">Mistral 7B · Offline</div>
          </div>
        </div>
        <button
          onClick={clearCopilot}
          className="text-white/20 hover:text-white/60 transition-colors"
          title="Clear conversation"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* ── Quick Prompts ── */}
      {copilotMessages.length === 0 && (
        <div className="p-3 border-b border-white/5 flex-shrink-0">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
            Quick Questions
          </div>
          <div className="flex flex-col gap-1">
            {QUICK_PROMPTS.map((p) => (
              <motion.button
                key={p}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => sendMessage(p)}
                className="text-left text-[11px] text-white/50 hover:text-white/80 font-mono px-2 py-1.5 rounded hover:bg-plasma/10 transition-all border border-transparent hover:border-plasma/20"
              >
                <Zap size={9} className="inline mr-1.5 text-plasma" />
                {p}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {copilotMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2.5 text-[11px] font-mono leading-relaxed ${
                  msg.role === "user"
                    ? "bg-plasma/20 border border-plasma/30 text-white/90"
                    : "bg-surface-2 border border-white/5 text-white/80"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain size={9} className="text-plasma" />
                    <span className="text-[9px] text-plasma font-bold tracking-widest uppercase">
                      ARIA
                    </span>
                  </div>
                )}
                <div
                  className={`whitespace-pre-wrap ${msg.isStreaming ? "type-cursor" : ""}`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: rgba(255,255,255,0.95)">$1</strong>')
                      .replace(/`([^`]+)`/g, '<code style="background:rgba(124,58,237,0.2);padding:1px 4px;border-radius:3px;color:#a78bfa">$1</code>')
                      .replace(/^(\d+\.) (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:rgba(124,58,237,0.7)">$1</span><span>$2</span></div>')
                      .replace(/^- (.+)$/gm, '<div style="display:flex;gap:6px;margin:1px 0"><span style="color:#06b6d4">•</span><span>$1</span></div>')
                      .replace(/🔴|⚠️|📊|📈|🤖/g, (m) => `<span style="font-size:12px">${m}</span>`),
                  }}
                />
                {/* RAG sources */}
                {msg.role === "assistant" && msg.referenced_runbooks?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                    {msg.referenced_runbooks.map((rb) => (
                      <span
                        key={rb}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                        style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee" }}
                      >
                        <BookOpen size={7} className="inline mr-1" />
                        {rb}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        {selectedNode && (
          <div className="mb-2 text-[10px] font-mono text-neon/60 px-1">
            Context: {selectedNode.node_id}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask ARIA about network risk, failures, actions..."
            rows={2}
            className="flex-1 bg-surface-2 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-plasma/50 focus:bg-surface-3 transition-all"
          />
          <motion.button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            whileTap={{ scale: 0.9 }}
            className="flex-shrink-0 w-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: loading ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)" }}
          >
            {loading
              ? <Loader2 size={14} className="text-plasma animate-spin" />
              : <Send size={14} className="text-plasma" />
            }
          </motion.button>
        </div>
        <div className="mt-1.5 text-[9px] text-white/20 font-mono px-1">
          Enter to send · Shift+Enter for newline · Fully offline
        </div>
      </div>
    </div>
  );
}
