import { useState, useRef, useEffect } from "react";
import { 
  useGetChatSessions, 
  useCreateChatSession, 
  useDeleteChatSession,
  useGetChatMessages,
  useSendChatMessage,
  ChatSession,
  ChatMessage
} from "@workspace/api-client-react";
import { 
  MessageSquare, Plus, Trash2, Send, Bot, User, 
  MoreVertical, Loader2, BrainCircuit
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChatSessionsQueryKey, getGetChatMessagesQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatMessageContent(content: string) {
  // Simple regex to extract code blocks and render them differently
  const parts = content.split(/```(\w+)?\n([\s\S]*?)```/g);
  
  if (parts.length === 1) {
    return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
  }

  const elements = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) {
        elements.push(<p key={i} className="whitespace-pre-wrap leading-relaxed">{parts[i]}</p>);
      }
    } else if (i % 3 === 2) {
      const language = parts[i - 1] || "text";
      const code = parts[i];
      elements.push(
        <div key={i} className="my-4 rounded-md overflow-hidden bg-zinc-950 border border-zinc-800">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400">{language}</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <code className="text-sm font-mono text-zinc-100">{code}</code>
          </div>
        </div>
      );
    }
  }
  
  return <div className="space-y-2">{elements}</div>;
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sessions, isLoading: sessionsLoading } = useGetChatSessions();
  
  const { data: messages, isLoading: messagesLoading } = useGetChatMessages(
    activeSessionId as number,
    { query: { enabled: !!activeSessionId } }
  );

  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendChatMessage();

  // Auto-select first session if none selected
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessage.isPending]);

  const handleNewChat = () => {
    createSession.mutate(
      { data: { title: "New Chat" } },
      {
        onSuccess: (newSession) => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionsQueryKey() });
          setActiveSessionId(newSession.id);
        }
      }
    );
  };

  const handleDeleteChat = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionsQueryKey() });
          if (activeSessionId === id) {
            setActiveSessionId(null);
          }
          toast({ description: "Chat deleted." });
        }
      }
    );
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId) return;

    const messageText = input;
    setInput("");

    sendMessage.mutate(
      { id: activeSessionId, data: { content: messageText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(activeSessionId) });
        },
        onError: () => {
          toast({ variant: "destructive", description: "Failed to send message." });
          setInput(messageText); // restore input
        }
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden animate-in fade-in duration-500">
      
      {/* Sidebar */}
      <div className="w-80 border-r border-border/50 bg-sidebar/5 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            Chat History
          </h2>
          <Button size="icon" variant="ghost" onClick={handleNewChat} disabled={createSession.isPending}>
            <Plus className="size-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessionsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))
            ) : sessions?.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">
                No chat history yet. Start a new chat!
              </div>
            ) : (
              sessions?.map(session => (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group",
                    activeSessionId === session.id 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare className="size-4 shrink-0 opacity-70" />
                    <div className="flex flex-col truncate">
                      <span className="text-sm font-medium truncate">{session.title || "New Chat"}</span>
                      <span className="text-[10px] opacity-70">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className={cn(
                        "size-6 opacity-0 group-hover:opacity-100 transition-opacity",
                        activeSessionId === session.id ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-background"
                      )}>
                        <MoreVertical className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => handleDeleteChat(session.id, e)}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete Chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50 relative">
        {/* Mobile Header (Shows only on small screens to replace sidebar) */}
        <div className="md:hidden p-4 border-b flex items-center justify-between bg-card">
          <span className="font-bold">Norv_ai</span>
          <Button variant="outline" size="sm" onClick={handleNewChat}>
            <Plus className="size-4 mr-2" /> New Chat
          </Button>
        </div>

        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <BrainCircuit className="size-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">How can I help you learn today?</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              I can explain complex concepts, debug your code, or help you study for your next {user?.specialization} exam.
            </p>
            <Button size="lg" onClick={handleNewChat}>
              Start a New Conversation
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-6 pb-4">
                {messagesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages?.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <BrainCircuit className="size-10 mx-auto opacity-20 mb-4" />
                    <p>Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages?.map(msg => (
                    <div 
                      key={msg.id} 
                      className={cn(
                        "flex gap-4 w-full",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="size-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Bot className="size-5 text-primary" />
                        </div>
                      )}
                      
                      <div className={cn(
                        "px-5 py-4 max-w-[85%] rounded-2xl shadow-sm text-sm",
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground rounded-tr-sm" 
                          : "bg-card border border-border/50 text-card-foreground rounded-tl-sm"
                      )}>
                        {formatMessageContent(msg.content)}
                      </div>

                      {msg.role === "user" && (
                        <div className="size-8 shrink-0 rounded-lg bg-muted flex items-center justify-center border border-border/50">
                          <User className="size-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {sendMessage.isPending && (
                  <div className="flex gap-4 w-full justify-start animate-pulse">
                    <div className="size-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="size-5 text-primary" />
                    </div>
                    <div className="px-5 py-4 rounded-2xl bg-card border border-border/50 rounded-tl-sm flex items-center gap-2">
                      <div className="size-2 bg-primary/40 rounded-full animate-bounce" />
                      <div className="size-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="size-2 bg-primary/80 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 bg-card border-t border-border/50">
              <form 
                onSubmit={handleSend}
                className="max-w-3xl mx-auto relative flex items-center"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a technical question..."
                  className="pr-12 py-6 rounded-xl border-sidebar-border bg-background shadow-sm text-base"
                  disabled={sendMessage.isPending}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-2 size-9 rounded-lg"
                  disabled={!input.trim() || sendMessage.isPending}
                >
                  <Send className="size-4" />
                </Button>
              </form>
              <div className="text-center mt-2 text-xs text-muted-foreground">
                AI can make mistakes. Consider verifying critical technical information.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
