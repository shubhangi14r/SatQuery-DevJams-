"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2,
  Droplets,
  Eye,
  History,
  Loader,
  ListOrdered,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Eyebrow } from "@/components/system/Eyebrow";
import { GlassPanel } from "@/components/system/GlassPanel";
import { useMapStore } from "@/lib/store";
import { postQuery } from "@/lib/api";
import { viewGeometry } from "@/lib/geo";

const SUGGESTED_PROMPTS = [
  { text: "What's visible here?", icon: Eye },
  { text: "Find all water bodies", icon: Droplets },
  { text: "Show areas near the river where construction increased", icon: Building2 },
  { text: "Name all water bodies and rank them biggest to smallest", icon: ListOrdered },
  { text: "What changed here over time?", icon: History },
];

const STAT_LABELS: Record<string, string> = {
  water_pct: "Water",
  vegetation_pct: "Vegetation",
  veg_pct: "Vegetation",
  built_up_pct: "Built-up",
};

function formatStat(key: string, value: unknown) {
  if (typeof value !== "number") return null;
  const label = STAT_LABELS[key] ?? key.replaceAll("_", " ");
  const formatted = key.includes("pct") ? `${value.toFixed(0)}%` : value.toLocaleString();
  return { label, value: formatted };
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useMapStore((s) => s.messages);
  const sending = useMapStore((s) => s.sending);
  const addMessage = useMapStore((s) => s.addMessage);
  const clearMessages = useMapStore((s) => s.clearMessages);
  const setSending = useMapStore((s) => s.setSending);
  const setHighlights = useMapStore((s) => s.setHighlights);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    addMessage("user", trimmed);
    setInput("");
    setSending(true);

    try {
      const geometry = useMapStore.getState().geometry ?? viewGeometry();
      if (!geometry) throw new Error("Map not ready yet — draw a region or wait a moment.");
      const [result] = await Promise.all([
        postQuery({ geometry, query: trimmed }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      addMessage("assistant", result.reply, result.stats);
      setHighlights(result.highlights);
    } catch (err) {
      addMessage("assistant", `Error: ${err instanceof Error ? err.message : "Query failed."}`);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <GlassPanel variant="hard" className="flex h-full w-full flex-col border-l-0 border-t-0 border-b-0">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <Eyebrow tone="signal">Query console</Eyebrow>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearMessages}
            className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-ink-dim transition-colors hover:text-signal"
          >
            <RotateCcw size={12} aria-hidden="true" />
            New query
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !sending && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-hard border border-line text-ink-faint">
              <Sparkles size={15} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <p className="max-w-[26ch] text-small text-ink-dim">Ask about any location, any year. Draw a region on the map to analyze it directly.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`max-w-[92%] rounded-hard border px-3 py-2 text-left ${msg.role === "user" ? "self-end border-signal/40 bg-void-3/80 text-ink" : "self-start border-line bg-void-2 text-ink"}`}>
            <p className={`text-caption font-semibold uppercase tracking-wider ${msg.role === "user" ? "text-signal" : "text-ink-dim"}`}>{msg.role === "user" ? "You" : "System"}</p>
            <p className="mt-1 whitespace-pre-wrap text-small leading-relaxed">{msg.text}</p>
            {msg.role === "assistant" && msg.stats && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(msg.stats).map(([key, value]) => {
                  const stat = formatStat(key, value);
                  return stat ? <span key={key} className="rounded-full border border-line px-2 py-1 font-mono text-caption text-ink-dim"><span>{stat.label} </span><strong className="font-medium text-signal">{stat.value}</strong></span> : null;
                })}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="relative self-start max-w-[92%] overflow-hidden rounded-hard border border-signal/40 bg-void-2 px-3 py-2">
            <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-signal" aria-hidden="true" />
            <p className="text-caption font-semibold uppercase tracking-wider text-ink-dim">System</p>
            <div className="mt-1 flex items-center gap-1.5"><Loader size={12} className="animate-spin text-signal" aria-hidden="true" /><span className="text-small text-ink">Analyzing location…</span></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-line px-4 py-4">
        {messages.length === 0 && <>
          <Eyebrow tone="signal" className="mb-2.5">Suggested</Eyebrow>
          <div className="mb-3 flex flex-col gap-1.5">
            {SUGGESTED_PROMPTS.map(({ text, icon: Icon }) => (
              <button key={text} type="button" data-cursor="action" onClick={() => handleSend(text)} className="group flex items-center gap-2 rounded-hard border border-line bg-void-3/50 px-3 py-2 text-left text-caption text-ink transition-colors hover:border-signal/60 hover:bg-void-3 hover:text-signal-bright">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-hard border border-line-bright/60 bg-void-2 text-ink-dim transition-colors group-hover:border-signal/70 group-hover:bg-signal/10 group-hover:text-signal"><Icon size={13} strokeWidth={1.5} aria-hidden="true" /></span>
                <span className="flex-1">{text}</span>
                <ArrowRight size={13} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </button>
            ))}
          </div>
        </>}
        <div className="flex items-center gap-2 rounded-hard border border-line bg-void-3/70 px-3 py-2.5 focus-within:border-line-bright">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Query the archive…" aria-label="Query the archive" className="w-full bg-transparent text-small text-ink placeholder:text-ink-dim focus:outline-none" />
          <button type="button" onClick={() => handleSend(input)} disabled={!input.trim() || sending} aria-label="Send query" data-cursor="action" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-hard text-ink-dim transition-colors hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"><SendHorizontal size={14} aria-hidden="true" /></button>
        </div>
      </div>
    </GlassPanel>
  );
}
