"use client";

import { apiClient } from "@/lib/api/client";
import type { Message, Thread } from "@/types/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { ThreadTabs } from "./thread-tabs";

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
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
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

  // Clear local messages when switching threads
  useEffect(() => {
    setLocalMessages([]);
    setStreamingMessage("");
  }, [selectedThreadId]);

  // Fetch messages for selected thread
  const { data: messagesData } = useQuery<{ messages: Message[]; total: number }>({
    queryKey: ["messages", selectedThreadId],
    queryFn: () =>
      apiClient.getMessages(selectedThreadId!) as Promise<{ messages: Message[]; total: number }>,
    enabled: !!selectedThreadId,
  });

  const messages = messagesData?.messages || [];

  // Sync local messages with fetched messages
  useEffect(() => {
    if (messages.length > 0 && !isStreaming) {
      setLocalMessages(messages);
    }
  }, [messages, isStreaming]);

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


  const handleSendMessage = async () => {
    if (!input.trim() || !selectedThreadId || isStreaming) return;

    const messageText = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      thread_id: selectedThreadId,
      role: "user",
      content: messageText,
      tokens_prompt: null,
      tokens_completion: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, userMessage]);

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
                // Add assistant message to local messages
                const assistantMessage: Message = {
                  id: `temp-assistant-${Date.now()}`,
                  thread_id: selectedThreadId,
                  role: "assistant",
                  content: fullMessage,
                  tokens_prompt: null,
                  tokens_completion: null,
                  metadata: data.metadata || null,
                  created_at: new Date().toISOString(),
                };
                setLocalMessages(prev => [...prev, assistantMessage]);
                
                setIsStreaming(false);
                setStreamingMessage("");
                
                // Refresh messages from database after a short delay
                setTimeout(() => {
                  queryClient.invalidateQueries({
                    queryKey: ["messages", selectedThreadId],
                  });
                }, 500);
                return;
              } else if (data.type === "error") {
                // Remove the optimistic user message on error
                setLocalMessages(prev => prev.slice(0, -1));
                setIsStreaming(false);
                setStreamingMessage("");
                console.error("Chat error:", data.content);
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
    setLocalMessages([]); // Clear messages for new thread
    queryClient.invalidateQueries({ queryKey: ["threads", documentId] });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header with thread tabs and actions */}
      <ThreadTabs
        threads={threads}
        selectedThreadId={selectedThreadId}
        onThreadSelect={setSelectedThreadId}
        onCreateThread={handleCreateThread}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(!showArchive)}
      />

      {/* Messages */}
      <MessageList
        messages={localMessages.length > 0 ? localMessages : messages}
        streamingMessage={streamingMessage}
        isStreaming={isStreaming}
      />

      {/* Input */}
      <MessageInput
        input={input}
        onInputChange={setInput}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        currentPage={currentPage}
      />
    </div>
  );
}
