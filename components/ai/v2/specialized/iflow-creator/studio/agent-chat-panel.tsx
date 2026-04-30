"use client";

/**
 * AgentChatPanel
 *
 * Left pane of the studio. Combines:
 *  - Clarifier Q&A (questions surface from RequirementsBrief.openQuestions)
 *  - Free-form modify instructions (post-design)
 *  - Agent activity ribbon (per-agent badges from agentLogs)
 *  - Persisted chat thread (loaded from /api/pipelines/[id]/messages)
 *
 * Submitting an answer / instruction posts to /api/pipelines/[id]/messages
 * which routes the message to either the clarifier loop or the patch agent
 * depending on phase.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Bot,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioPipelineSnapshot, StudioChatMessage, AgentLogRow } from "./types";

interface AgentChatPanelProps {
  pipelineId: string;
  snapshot: StudioPipelineSnapshot | null;
}

const POLL_MS = 2500;
/** Slow poll for terminal phases — only catches a moderator action / out-of-band edit. */
const POLL_MS_IDLE = 30_000;
/** Phases where no further chat updates are expected unless the user acts. */
const TERMINAL_PHASES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "DRAFTED",
  "AWAITING_APPROVAL",
]);

export function AgentChatPanel({ pipelineId, snapshot }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<StudioChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /**
   * Keyed by **chat message id**, not question id. The clarifier restarts
   * its `q1/q2/...` numbering on every follow-up call, so two different
   * questions can share the same questionId — keying by the unique
   * persisted message.id avoids accidentally disabling later questions.
   */
  const [pickedMessages, setPickedMessages] = useState<Set<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);

  const phase = snapshot?.phase ?? "INIT";
  const isTerminal = TERMINAL_PHASES.has(phase);

  // Poll messages thread.
  // - Fast (2.5s) while agents are running.
  // - Slow (30s) when in a terminal phase — just enough to pick up
  //   out-of-band changes without spamming the dev console.
  // - Paused when the tab is hidden (saves work on background tabs).
  useEffect(() => {
    if (!pipelineId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Tab is hidden — re-check in 5s instead of hammering the API.
        timer = setTimeout(tick, 5_000);
        return;
      }
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/messages`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { messages: StudioChatMessage[] };
        if (cancelled) return;
        setMessages(json.messages ?? []);
      } catch {
        /* ignore — endpoint may not exist yet */
      }
      if (!cancelled) {
        timer = setTimeout(tick, isTerminal ? POLL_MS_IDLE : POLL_MS);
      }
    };

    void tick();

    // Refresh immediately when the tab regains focus so the user sees
    // up-to-date state without waiting for the next interval tick.
    const onVis = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [pipelineId, isTerminal]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const openQuestions = snapshot?.requirementsBrief?.openQuestions ?? [];
  const inputMode = phaseToInputMode(phase);
  const placeholder = inputModePlaceholder(inputMode, openQuestions.length);
  const canSend = input.trim().length > 0 && !pending && inputMode !== "READ_ONLY";

  const handleSubmit = () => {
    if (!canSend) return;
    setSendError(null);
    const content = input.trim();
    submitAnswer(content, inputMode === "MODIFY" ? "MODIFY_REQUEST" : "CLARIFIER_ANSWER");
    setInput("");
  };

  const submitAnswer = (
    content: string,
    kind: StudioChatMessage["kind"],
    questionId?: string,
    sourceMessageId?: string,
  ) => {
    setSendError(null);
    // Optimistic
    const optimistic: StudioChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      kind,
      content,
      createdAt: new Date().toISOString(),
      ...(questionId ? { metadata: { questionId } } : {}),
    };
    setMessages((prev) => [...prev, optimistic]);
    if (sourceMessageId) {
      setPickedMessages((prev) => {
        const next = new Set(prev);
        next.add(sourceMessageId);
        return next;
      });
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, kind, ...(questionId ? { questionId } : {}) }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Send failed");
      }
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ⌘/Ctrl+Enter submits — Enter alone allows newlines for longer instructions.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Build the bubble list — combine persisted messages with synthetic system items
  // (e.g., open clarifier questions as agent prompts when the thread is empty).
  const bubbles = useMemo<StudioChatMessage[]>(() => {
    if (messages.length > 0) return messages;
    // Synthesize a welcome bubble + any open clarifier questions.
    const seed: StudioChatMessage[] = [
      {
        id: "sys-welcome",
        role: "assistant",
        kind: "TEXT",
        content:
          "I'll help you build this iFlow. While I work, you'll see each agent's progress on the right.",
        createdAt: new Date().toISOString(),
      },
    ];
    for (const q of openQuestions) {
      seed.push({
        id: `q-${q.id}`,
        role: "assistant",
        kind: "CLARIFIER_QUESTION",
        content: q.question,
        createdAt: new Date().toISOString(),
        metadata: { options: q.options ?? null, required: q.required, questionId: q.id },
      });
    }
    return seed;
  }, [messages, openQuestions]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Agent activity ribbon */}
      <AgentActivityRibbon agentLogs={snapshot?.agentLogs ?? []} phase={phase} />

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <ol className="flex flex-col gap-3" aria-live="polite" aria-label="Studio chat thread">
          {bubbles.map((m, idx) => {
            const meta = m.metadata as
              | { options?: string[] | null; questionId?: string; id?: string }
              | undefined;
            // Persisted clarifier messages from the server use `metadata.id`
            // (set in iflow-chat.ts / iflow-orchestrator.ts). Synthetic
            // bubbles built from openQuestions use `metadata.questionId`.
            // Accept either so click handlers fire in both cases.
            const qid = meta?.questionId ?? meta?.id;
            // A question is "answered" if (a) the user already clicked an
            // option in this session, or (b) any later user message exists
            // in the thread (i.e. they typed/clicked something after).
            // Keying by message.id (not questionId) avoids collisions when
            // the clarifier reuses ids like "q1" across follow-up calls.
            const hasLaterUserReply = bubbles
              .slice(idx + 1)
              .some((later) => later.role === "user");
            const alreadyPicked =
              pickedMessages.has(m.id) || (m.kind === "CLARIFIER_QUESTION" && hasLaterUserReply);
            return (
              <li key={m.id}>
                <ChatBubble
                  message={m}
                  optionsDisabled={alreadyPicked || pending || inputMode === "READ_ONLY"}
                  onPickOption={(opt) => {
                    if (!qid || alreadyPicked) return;
                    submitAnswer(opt, "CLARIFIER_ANSWER", qid, m.id);
                  }}
                />
              </li>
            );
          })}
          {pending && (
            <li>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3" /> sending…
              </div>
            </li>
          )}
        </ol>
      </div>

      {/* Input */}
      <div className="border-t bg-background/60 p-3">
        {sendError && (
          <p
            role="alert"
            className="mb-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="size-3.5" />
            {sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            rows={2}
            disabled={inputMode === "READ_ONLY"}
            className="min-h-11 resize-none text-sm"
            aria-label={inputMode === "MODIFY" ? "Modify instruction" : "Reply to clarifier"}
            spellCheck={false}
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send"
            className="size-11"
          >
            {pending ? <Spinner className="size-4" /> : <Send className="size-4" aria-hidden />}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {inputMode === "READ_ONLY"
            ? "Read-only while the agents finish"
            : "⌘/Ctrl + Enter to send"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type InputMode = "CLARIFY" | "MODIFY" | "READ_ONLY";

function phaseToInputMode(phase: string): InputMode {
  switch (phase) {
    case "CLARIFYING":
    case "INIT":
      return "CLARIFY";
    case "AWAITING_APPROVAL":
    case "DRAFTED":
    case "COMPLETED":
    case "FAILED":
      return "MODIFY";
    default:
      return "READ_ONLY";
  }
}

function inputModePlaceholder(mode: InputMode, openCount: number): string {
  if (mode === "READ_ONLY") return "Agents are working…";
  if (mode === "MODIFY")
    return "Tell me what to change (e.g. ‘add an audit log step before the mapping’)…";
  if (openCount > 0) return "Answer the clarifier above…";
  return "Add more details about your iFlow…";
}

// ---------------------------------------------------------------------------

function ChatBubble({
  message,
  optionsDisabled,
  onPickOption,
}: {
  message: StudioChatMessage;
  optionsDisabled?: boolean;
  onPickOption?: (option: string) => void;
}) {
  const isUser = message.role === "user";
  const isAgent = message.role === "agent";
  const isQuestion = message.kind === "CLARIFIER_QUESTION";
  const isPatch = message.kind === "PATCH_RESULT";

  const Icon = isUser ? UserIcon : isPatch ? Wrench : isAgent ? Sparkles : Bot;
  const tone = isUser
    ? "bg-primary text-primary-foreground"
    : isQuestion
      ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/50"
      : isPatch
        ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-900/50"
        : "bg-muted text-foreground";

  const options = (message.metadata as { options?: string[] | null } | undefined)?.options;
  const interactive = isQuestion && !!onPickOption && !!options && options.length > 0;

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </div>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed", tone)}>
        <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        {options && options.length > 0 && (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role={interactive ? "group" : undefined}
            aria-label={interactive ? "Suggested answers" : undefined}
          >
            {options.map((opt) =>
              interactive ? (
                <button
                  key={opt}
                  type="button"
                  disabled={optionsDisabled}
                  onClick={() => onPickOption?.(opt)}
                  className={cn(
                    "min-h-7 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    "border-amber-300 bg-amber-100/60 text-amber-900 hover:bg-amber-200/70 hover:text-amber-950",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-800/60",
                  )}
                >
                  {opt}
                </button>
              ) : (
                <Badge
                  key={opt}
                  variant="outline"
                  className="cursor-default border-amber-300 bg-amber-100/60 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                >
                  {opt}
                </Badge>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AgentActivityRibbon({
  agentLogs,
  phase,
}: {
  agentLogs: AgentLogRow[];
  phase: string;
}) {
  // Show last 6 agents, deduped by name keeping latest status.
  const byName = new Map<string, AgentLogRow>();
  for (const a of agentLogs) byName.set(a.agentName, a);
  const items = Array.from(byName.values()).slice(-6);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <Spinner className="size-3" /> Waiting for agents…
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b bg-muted/30 px-3 py-2"
      role="status"
      aria-label="Agent activity"
    >
      {items.map((a) => (
        <AgentChip key={a.id} log={a} active={phase !== "COMPLETED" && phase !== "FAILED"} />
      ))}
    </div>
  );
}

function AgentChip({ log, active }: { log: AgentLogRow; active: boolean }) {
  const running = log.status === "RUNNING";
  const failed = log.status === "FAILED";
  const success = log.status === "SUCCESS";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
        running && active && "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
        success && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        failed && "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
        !running && !success && !failed && "border-muted bg-background text-muted-foreground",
      )}
      title={log.error ?? undefined}
    >
      {running && active ? (
        <Spinner className="size-2.5" />
      ) : success ? (
        <CheckCircle2 className="size-3" aria-hidden />
      ) : failed ? (
        <AlertCircle className="size-3" aria-hidden />
      ) : (
        <Bot className="size-3" aria-hidden />
      )}
      {humanizeAgent(log.agentName)}
    </span>
  );
}

function humanizeAgent(name: string): string {
  const map: Record<string, string> = {
    CLARIFIER: "Clarifier",
    PLANNER: "Planner",
    ARCHITECT: "Architect",
    REVIEWER: "Reviewer",
    VALIDATOR: "Validator",
    FIX: "Fixer",
    SUMMARIZER: "Summary",
    ADAPTER_SPECIALIST: "Adapters",
    MAPPING_SPECIALIST: "Mapping",
    SCRIPT_SPECIALIST: "Scripts",
    EXTERNALIZATION_SPECIALIST: "Params",
    ERROR_HANDLER_SPECIALIST: "Errors",
    DECOMPOSITION_SPECIALIST: "Subprocesses",
    PATCH: "Patch",
    SAMPLE_DATA: "Samples",
  };
  return map[name] ?? name;
}
