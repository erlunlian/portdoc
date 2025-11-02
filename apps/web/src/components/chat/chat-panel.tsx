"use client";

import { apiClient } from "@/lib/api/client";
import type { Message, Thread } from "@/types/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, MoreHorizontal, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatPanelProps {
  documentId: string;
  currentPage?: number;
}

export function ChatPanel({ documentId, currentPage }: ChatPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch threads
  const { data: threadsData } = useQuery<{ threads: Thread[]; total: number }>({
    queryKey: ["threads", documentId],
    queryFn: () =>
      apiClient.getThreads(documentId) as Promise<{ threads: Thread[]; total: number }>,
  });

  const threads = threadsData?.threads || [];

  // Auto-select first thread or create one
  useEffect(() => {
    if (threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0].id);
    } else if (threads.length === 0 && !selectedThreadId) {
      // Create a new thread
      apiClient.createThread(documentId, "New Chat").then((thread) => {
        setSelectedThreadId((thread as Thread).id);
      });
    }
  }, [threads, selectedThreadId, documentId]);

  // Fetch messages for selected thread
  const { data: messagesData } = useQuery<{ messages: Message[]; total: number }>({
    queryKey: ["messages", selectedThreadId],
    queryFn: () =>
      apiClient.getMessages(selectedThreadId!) as Promise<{ messages: Message[]; total: number }>,
    enabled: !!selectedThreadId,
  });

  const messages = messagesData?.messages || [];

  // Listen for "Add to Chat" events from PDF context menu
  useEffect(() => {
    const handleAddToChat = (event: CustomEvent<{ text: string; page: number }>) => {
      const { text, page } = event.detail;
      const quotedText = `"${text}" (Page ${page})`;
      setInput((prev) => {
        if (prev) {
          return `${prev}\n\n${quotedText}`;
        }
        return quotedText;
      });
    };

    window.addEventListener("addToChat", handleAddToChat as EventListener);
    return () => {
      window.removeEventListener("addToChat", handleAddToChat as EventListener);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedThreadId || isStreaming) return;

    const messageText = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      // Get auth token
      const supabase = await import("@/lib/supabase/client").then((m) => m.createClient());
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";
      const url = `${apiBaseUrl}/threads/${selectedThreadId}/stream?query=${encodeURIComponent(messageText)}${currentPage ? `&page_context=${currentPage}` : ""}`;

      // EventSource doesn't support custom headers, so we'll use fetch with streaming
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let fullMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "token") {
                fullMessage += data.content || "";
                setStreamingMessage(fullMessage);
              } else if (data.type === "done") {
                setIsStreaming(false);
                setStreamingMessage("");
                queryClient.invalidateQueries({
                  queryKey: ["messages", selectedThreadId],
                });
                return;
              } else if (data.type === "error") {
                setIsStreaming(false);
                setStreamingMessage("");
                alert(`Error: ${data.content}`);
                return;
              }
            } catch (e) {
              console.error("Failed to parse SSE message:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleCreateThread = async () => {
    const thread = await apiClient.createThread(documentId, "New Chat");
    setSelectedThreadId((thread as Thread).id);
    queryClient.invalidateQueries({ queryKey: ["threads", documentId] });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-gray-50">
      {/* Header with tabs */}
      <div className="flex-shrink-0 border-b bg-white">
        <div className="flex items-center">
          {/* Scrollable tabs container */}
          <div className="flex flex-1 items-center overflow-hidden">
            <div
              ref={tabsContainerRef}
              className="flex flex-1 items-center overflow-x-auto scrollbar-hide"
            >
              {threads.map((thread: Thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`flex min-w-0 flex-shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
                    selectedThreadId === thread.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="truncate">
                    {thread.title || `Chat ${new Date(thread.created_at).toLocaleDateString()}`}
                  </span>
                  {selectedThreadId === thread.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle close tab if needed
                      }}
                      className="rounded-xl p-0.5 hover:bg-gray-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1 border-l px-2">
            <button
              onClick={handleCreateThread}
              className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
              title="Chat history"
            >
              <Archive className="h-4 w-4" />
            </button>
            <button
              className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-auto bg-white p-4">
        <div className="space-y-4">
          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-3xl px-4 py-2.5 ${
                  message.role === "user" 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.content}
                </div>
                {message.metadata?.pages && message.metadata.pages.length > 0 && (
                  <div className="mt-1.5 text-xs opacity-75">
                    📄 Pages {message.metadata.pages.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-3xl bg-gray-100 px-4 py-2.5">
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
                  {streamingMessage}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-gray-500"></span>
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-gray-500 animation-delay-200"></span>
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-gray-500 animation-delay-400"></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t bg-gray-50 p-4">
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message..."
              className="flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm outline-none placeholder:text-gray-400"
              rows={1}
              style={{
                minHeight: '24px',
                maxHeight: '120px',
                overflowY: 'auto'
              }}
              disabled={isStreaming}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming}
              className="rounded-full bg-blue-500 p-1.5 text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {currentPage && (
            <div className="border-t px-3 py-2 text-xs text-gray-500">
              Context: Page {currentPage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
