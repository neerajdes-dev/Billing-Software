"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { Bot, BrainCircuit, Languages, LayoutTemplate, Loader2, Send, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GatedButton } from "@/components/ui/gated-button";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import { AiCopilotPanel } from "./ai-copilot-panel";

interface ReplyDraft { id: string; authorLabel: string; preview: string; }
interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  hasMessages: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}
type AiAction = "suggest" | "professional" | "friendly" | "shorten" | "translate-hindi" | "translate-english";

export function MessageComposer({ conversationId, sessionExpired, hasMessages, onSend, onOpenTemplates, replyTo, onClearReply }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState<AiAction | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = useCan("send-messages");
  const readOnly = !canSend;

  useEffect(() => {
    const handleAiDraft = (event: Event) => {
      const custom = event as CustomEvent<{ conversationId?: string; text?: string }>;
      if (custom.detail?.conversationId !== conversationId || !custom.detail?.text) return;
      setText(custom.detail.text);
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (element) {
          element.style.height = "auto";
          element.style.height = `${Math.min(element.scrollHeight, 96)}px`;
          element.focus();
        }
      });
    };
    window.addEventListener("resolvent:use-ai-draft", handleAiDraft);
    return () => window.removeEventListener("resolvent:use-ai-draft", handleAiDraft);
  }, [conversationId]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;
    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally { setSending(false); }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const runAi = useCallback(async (action: AiAction) => {
    if (action !== "suggest" && !text.trim()) {
      toast.info("Type a draft message first.");
      textareaRef.current?.focus();
      return;
    }
    setAiLoading(action);
    try {
      const response = await fetch("/api/ai/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed.");
      setText(data.text);
      requestAnimationFrame(() => { adjustHeight(); textareaRef.current?.focus(); });
      toast.success(`Draft generated with ${data.provider}. Review before sending.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI request failed.");
    } finally { setAiLoading(null); }
  }, [adjustHeight, conversationId, text]);

  const applyCopilotDraft = useCallback((draft: string) => {
    setText(draft);
    setCopilotOpen(false);
    requestAnimationFrame(() => {
      adjustHeight();
      textareaRef.current?.focus();
    });
  }, [adjustHeight]);

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-3">
      {replyTo && <div className="mb-2"><ReplyQuote authorLabel={replyTo.authorLabel} preview={replyTo.preview} onDismiss={onClearReply} /></div>}
      {sessionExpired && (
        <div className="mb-3 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
          <div className="flex items-start gap-3 p-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">
              <LayoutTemplate className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-amber-200">Customer service window closed</p>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                  24h window
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                The customer has not replied within the last 24 hours. WhatsApp requires an approved template before you can re-engage.
              </p>
              {!readOnly && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-amber-400 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                    onClick={onOpenTemplates}
                  >
                    <LayoutTemplate className="mr-1.5 size-3.5" />
                    Choose approved template
                  </Button>
                  <span className="text-[10px] leading-4 text-slate-500">
                    Normal messaging and AI replies become available again after the customer responds.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!readOnly && copilotOpen && (
        <AiCopilotPanel
          conversationId={conversationId}
          hasMessages={hasMessages}
          sessionExpired={sessionExpired}
          onUseDraft={applyCopilotDraft}
          onOpenTemplates={onOpenTemplates}
          onClose={() => setCopilotOpen(false)}
        />
      )}

      {!readOnly && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-primary/40 bg-primary/15 text-xs font-medium text-primary hover:bg-primary/25"
            onClick={() => setCopilotOpen((open) => !open)}
          >
            <BrainCircuit className="size-3.5" />
            AI Copilot
          </Button>
          {!sessionExpired && (
            <>
          <Button type="button" variant="outline" size="sm" className="h-8 border-primary/30 bg-primary/10 text-xs text-primary hover:bg-primary/20" disabled={Boolean(aiLoading)} onClick={() => runAi("suggest")}>
            {aiLoading === "suggest" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} AI Suggest Reply
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-300"
                  disabled={Boolean(aiLoading)}
                />
              }
            >
              {aiLoading && aiLoading !== "suggest" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <WandSparkles className="size-3.5" />
              )}
              Improve Writing
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Rewrite draft</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runAi("professional")}>Professional</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAi("friendly")}>Friendly</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAi("shorten")}>Shorten</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Languages className="size-3.5" /> Translate
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runAi("translate-hindi")}>Hindi</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runAi("translate-english")}>English</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
            </>
          )}
          <span className="flex items-center gap-1 text-[10px] text-slate-500"><Bot className="size-3" /> AI drafts are never sent automatically</span>
        </div>
      )}

      {sessionExpired && !readOnly ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-800/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300">Free-form messaging is temporarily unavailable</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Choose an approved WhatsApp template to continue this conversation.</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 bg-primary px-3 text-xs font-medium hover:bg-primary/90"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1.5 size-3.5" />
            Templates
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <GatedButton variant="ghost" size="sm" canAct={!readOnly} gateReason="send messages" title={readOnly ? undefined : "Send template"} className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-white" onClick={onOpenTemplates}><LayoutTemplate className="h-4 w-4" /></GatedButton>
            <textarea ref={textareaRef} value={text} onChange={(e) => { setText(e.target.value); adjustHeight(); }} onKeyDown={handleKeyDown}
              placeholder={readOnly ? "Read-only — viewers can browse but not reply" : "Type a message... (Shift+Enter for new line)"}
              disabled={readOnly} rows={1} title={readOnly ? "Read-only — your role can't send messages" : undefined}
              className={cn("flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-primary/50", readOnly && "cursor-not-allowed opacity-50")} />
            <GatedButton size="sm" canAct={!readOnly} gateReason="send messages" disabled={!text.trim() || sending} onClick={handleSend} className="h-9 w-9 shrink-0 bg-primary p-0 hover:bg-primary/90 disabled:opacity-40"><Send className="h-4 w-4" /></GatedButton>
          </div>
          <p className="mt-1 pl-11 text-[10px] text-slate-600">Type &apos;/&apos; for quick replies</p>
        </>
      )}
    </div>
  );
}
