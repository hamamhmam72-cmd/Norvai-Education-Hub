import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useGetChatMessages,
  useSendChatMessage,
} from "@workspace/api-client-react";
import {
  Plus, Trash2, Send, User,
  MoreVertical, Loader2, Sparkles,
  MessageSquarePlus, Copy, Check,
  History, Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChatSessionsQueryKey, getGetChatMessagesQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─────────────────────────── Monk Avatar ─────────────────────────── */
function MonkAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-7", md: "size-9", lg: "size-14" };
  const icon = { sm: "text-sm", md: "text-base", lg: "text-2xl" };
  return (
    <div className={cn(
      sizes[size],
      "shrink-0 rounded-xl flex items-center justify-center font-bold shadow-md",
      "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white",
    )}>
      <span className={icon[size]}>M</span>
    </div>
  );
}

/* ─────────────────────────── Code block with Copy ─────────────────── */
function CodeBlock({ code, language, copyLabel, copiedLabel }: {
  code: string; language: string; copyLabel: string; copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-zinc-700/60 text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700/60">
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wide">{language || "code"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-zinc-950">
        <code className="font-mono text-zinc-100 text-sm leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

/* ─────────────────────────── Message renderer ─────────────────────── */
function MessageContent({ content, copyLabel, copiedLabel }: {
  content: string; copyLabel: string; copiedLabel: string;
}) {
  const parts = content.split(/```(\w+)?\n([\s\S]*?)```/g);
  if (parts.length === 1) {
    return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
  }
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) elements.push(
        <p key={i} className="whitespace-pre-wrap leading-relaxed">{parts[i]}</p>
      );
    } else if (i % 3 === 2) {
      elements.push(
        <CodeBlock key={i} code={parts[i]} language={parts[i - 1] || "text"}
          copyLabel={copyLabel} copiedLabel={copiedLabel} />
      );
    }
  }
  return <div className="space-y-1">{elements}</div>;
}

/* ─────────────────────────── Typing dots ─────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-5">
      {[0, 1, 2].map(i => (
        <div key={i} className={cn(
          "size-2 rounded-full bg-purple-400",
          "animate-bounce",
          i === 1 && "[animation-delay:0.15s]",
          i === 2 && "[animation-delay:0.3s]",
        )} />
      ))}
    </div>
  );
}

/* ─────────────────────────── Suggestion chip ─────────────────────── */
function SuggestionChip({ label, icon, onClick }: {
  label: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card",
        "hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-sm",
        "transition-all duration-200 text-start text-sm text-foreground group",
      )}
    >
      <span className="mt-0.5 text-purple-500 group-hover:scale-110 transition-transform shrink-0">{icon}</span>
      <span className="leading-snug">{label}</span>
    </button>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, isRTL } = useLang();
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessions, isLoading: sessionsLoading } = useGetChatSessions();
  const { data: messages, isLoading: messagesLoading } = useGetChatMessages(
    activeSessionId ?? 0,
    { query: { enabled: !!activeSessionId, queryKey: activeSessionId ? getGetChatMessagesQueryKey(activeSessionId) : [] } }
  );

  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendChatMessage();

  // Auto-select first session
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleNewChat = useCallback(() => {
    createSession.mutate(
      { data: { title: t("newChat") } },
      {
        onSuccess: (s) => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionsQueryKey() });
          setActiveSessionId(s.id);
          textareaRef.current?.focus();
        },
      }
    );
  }, [createSession, queryClient, t]);

  const handleDeleteChat = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionsQueryKey() });
          if (activeSessionId === id) setActiveSessionId(null);
        },
      }
    );
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeSessionId || sendMessage.isPending) return;
    const text = input.trim();
    setInput("");
    sendMessage.mutate(
      { id: activeSessionId, data: { content: text } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(activeSessionId!) }),
        onError: () => {
          toast({ variant: "destructive", description: "Failed to send message." });
          setInput(text);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = async (text: string) => {
    // Create a session first if none, then send
    if (!activeSessionId) {
      createSession.mutate(
        { data: { title: text.slice(0, 60) } },
        {
          onSuccess: (s) => {
            queryClient.invalidateQueries({ queryKey: getGetChatSessionsQueryKey() });
            setActiveSessionId(s.id);
            // slight delay for state to settle
            setTimeout(() => {
              sendMessage.mutate(
                { id: s.id, data: { content: text } },
                { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(s.id) }) }
              );
            }, 100);
          },
        }
      );
    } else {
      setInput(text);
      textareaRef.current?.focus();
    }
  };

  const activeSession = sessions?.find(s => s.id === activeSessionId);

  const suggestions = [
    { key: "suggestExplain", icon: <Sparkles className="size-4" /> },
    { key: "suggestDebug",   icon: <Zap className="size-4" /> },
    { key: "suggestQuiz",    icon: <Sparkles className="size-4" /> },
    { key: "suggestCareer",  icon: <Zap className="size-4" /> },
    { key: "suggestDiff",    icon: <Sparkles className="size-4" /> },
    { key: "suggestBest",    icon: <Zap className="size-4" /> },
  ] as const;

  return (
    <div className={cn(
      "flex h-[calc(100vh-7rem)] rounded-2xl border border-border/50 bg-card shadow-lg overflow-hidden",
      "animate-in fade-in duration-300",
    )}>

      {/* ── Sessions sidebar ── */}
      <div className={cn(
        "hidden md:flex w-72 flex-col border-border/50 bg-sidebar/30",
        isRTL ? "border-l" : "border-r",
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MonkAvatar size="sm" />
              <div>
                <p className="text-sm font-bold leading-none">Monk</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("monkSubtitle")}</p>
              </div>
            </div>
            <Button
              size="icon" variant="ghost"
              onClick={handleNewChat}
              disabled={createSession.isPending}
              title={t("newChat")}
              className="size-8 rounded-lg hover:bg-purple-500/10 hover:text-purple-500"
            >
              {createSession.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
            </Button>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <History className="size-3" />
            {t("chatHistory")}
          </p>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessionsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : !sessions?.length ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t("noChats")}
              </div>
            ) : (
              sessions.map(session => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                      active
                        ? "bg-gradient-to-r from-violet-500/20 to-purple-600/10 border border-purple-500/30 shadow-sm"
                        : "hover:bg-muted/60 border border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "size-2 rounded-full shrink-0",
                        active ? "bg-purple-500" : "bg-muted-foreground/30"
                      )} />
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm truncate font-medium leading-tight",
                          active ? "text-purple-200 dark:text-purple-200" : "text-foreground",
                        )}>
                          {session.title || t("newChat")}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        >
                          <MoreVertical className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={e => handleDeleteChat(session.id, e)}
                        >
                          <Trash2 className={cn("size-4", isRTL ? "ms-2" : "me-2")} />
                          {t("deleteChat")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className={cn(
          "px-5 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm",
          "flex items-center justify-between gap-3",
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <MonkAvatar size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">Monk</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-500 border-purple-500/20">
                  AI
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {activeSession?.title || t("monkSubtitle")}
              </p>
            </div>
          </div>
          {/* Mobile new chat */}
          <Button
            variant="outline" size="sm"
            onClick={handleNewChat}
            className="md:hidden rounded-lg border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-500"
          >
            <Plus className={cn("size-4", isRTL ? "ms-1" : "me-1")} />
            {t("newChat")}
          </Button>
        </div>

        {/* ── Empty / Welcome state ── */}
        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto text-center space-y-6">
              {/* Monk logo */}
              <div className="flex flex-col items-center gap-3">
                <MonkAvatar size="lg" />
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-violet-500 to-purple-400 bg-clip-text text-transparent">Monk</span>
                  </h1>
                  <p className="text-muted-foreground mt-1">{t("monkWelcome")}</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">{t("monkWelcomeDesc")}</p>
                </div>
              </div>

              {/* Suggestions grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                {suggestions.map(({ key, icon }) => (
                  <SuggestionChip
                    key={key}
                    label={t(key)}
                    icon={icon}
                    onClick={() => handleSuggestion(t(key))}
                  />
                ))}
              </div>

              <Button
                size="lg"
                onClick={handleNewChat}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-purple-500/20 rounded-xl px-8"
                disabled={createSession.isPending}
              >
                {createSession.isPending
                  ? <Loader2 className={cn("size-4 animate-spin", isRTL ? "ms-2" : "me-2")} />
                  : <MessageSquarePlus className={cn("size-4", isRTL ? "ms-2" : "me-2")} />
                }
                {t("startNewConv")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Messages ── */}
            <ScrollArea className="flex-1 px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                {messagesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-purple-500" />
                  </div>
                ) : !messages?.length ? (
                  <div className="text-center py-16 text-muted-foreground space-y-2">
                    <MonkAvatar size="lg" />
                    <p className="mt-4 font-medium">{t("monkWelcome")}</p>
                    <p className="text-sm text-muted-foreground/70">{t("monkWelcomeDesc")}</p>
                    {/* inline suggestion chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 text-start max-w-xl mx-auto">
                      {suggestions.slice(0, 4).map(({ key, icon }) => (
                        <SuggestionChip
                          key={key}
                          label={t(key)}
                          icon={icon}
                          onClick={() => {
                            setInput(t(key));
                            textareaRef.current?.focus();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3 w-full",
                          isUser ? "justify-end" : "justify-start",
                        )}
                      >
                        {!isUser && <MonkAvatar size="sm" />}

                        <div className={cn(
                          "px-4 py-3 rounded-2xl max-w-[82%] text-sm shadow-sm",
                          isUser
                            ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-tr-sm"
                            : "bg-card border border-border/60 text-card-foreground rounded-tl-sm",
                        )}>
                          <MessageContent
                            content={msg.content}
                            copyLabel={t("copyCode")}
                            copiedLabel={t("copied")}
                          />
                        </div>

                        {isUser && (
                          <div className="size-9 shrink-0 rounded-xl bg-muted flex items-center justify-center border border-border/50">
                            <User className="size-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Typing indicator */}
                {sendMessage.isPending && (
                  <div className="flex gap-3 justify-start animate-in fade-in duration-200">
                    <MonkAvatar size="sm" />
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border/60 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* ── Input bar ── */}
            <div className="p-4 border-t border-border/50 bg-card/80 backdrop-blur-sm">
              <form onSubmit={handleSend} className="max-w-3xl mx-auto">
                <div className="relative flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("typeMessage")}
                    rows={1}
                    className={cn(
                      "flex-1 resize-none rounded-xl border-border/60 bg-background shadow-sm",
                      "text-sm leading-relaxed min-h-[44px] max-h-36 py-3",
                      "focus-visible:ring-purple-500/40 focus-visible:border-purple-500/60",
                      "transition-all",
                      isRTL ? "pe-4 ps-12" : "ps-4 pe-12",
                    )}
                    disabled={sendMessage.isPending}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || sendMessage.isPending}
                    className={cn(
                      "absolute bottom-1.5 size-9 rounded-lg shadow-sm",
                      isRTL ? "start-1.5" : "end-1.5",
                      "bg-gradient-to-br from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
                      "disabled:opacity-40 disabled:from-muted disabled:to-muted",
                    )}
                  >
                    {sendMessage.isPending
                      ? <Loader2 className="size-4 animate-spin" />
                      : <Send className="size-4" />
                    }
                  </Button>
                </div>
                <p className="text-center text-[11px] text-muted-foreground/60 mt-2">
                  {t("monkDisclaimer")} · Enter {t("sendMessage")} · Shift+Enter ↵
                </p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
