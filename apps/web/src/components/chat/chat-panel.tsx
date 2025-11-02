"use client";

import { apiClient } from "@/lib/api/client";
import type { Message, Thread } from "@/types/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Thread Selector */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Threads</h3>
          <button
            onClick={handleCreateThread}
            className="bg-primary hover:bg-primary/90 rounded px-3 py-1 text-xs text-white"
          >
            New
          </button>
        </div>
        <select
          value={selectedThreadId || ""}
          onChange={(e) => setSelectedThreadId(e.target.value)}
          className="w-full rounded border px-2 py-1 text-sm"
        >
          {threads.map((thread: Thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.title || `Thread ${new Date(thread.created_at).toLocaleDateString()}`}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                {message.metadata?.pages && message.metadata.pages.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    Sources: Pages {message.metadata.pages.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2">
                <div className="whitespace-pre-wrap text-sm">{streamingMessage}</div>
                <div className="mt-1 text-xs text-gray-500">Thinking...</div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask a question about the document..."
            className="flex-1 rounded border px-3 py-2 text-sm"
            rows={2}
            disabled={isStreaming}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isStreaming}
            className="bg-primary hover:bg-primary/90 rounded p-2 text-white disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {currentPage && (
          <div className="mt-2 text-xs text-gray-500">Context: Page {currentPage}</div>
        )}
      </div>
    </div>
  );
}
