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

const NEW_CHAT_ID = "new-chat-pending";

export function ChatPanel({ documentId, currentPage }: ChatPanelProps) {
  // Start with a virtual new chat selected
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(NEW_CHAT_ID);
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isNewThread, setIsNewThread] = useState(true); // Start as new thread
  const queryClient = useQueryClient();

  // Fetch threads
  const { data: threadsData } = useQuery<{ threads: Thread[]; total: number }>({
    queryKey: ["threads", documentId],
    queryFn: () =>
      apiClient.getThreads(documentId) as Promise<{ threads: Thread[]; total: number }>,
  });

  const threads = threadsData?.threads || [];

  // Don't auto-select threads anymore - start with empty chat

  // Reset the new thread flag when selecting an existing thread
  const handleThreadSelect = (threadId: string) => {
    setIsNewThread(false);
    setSelectedThreadId(threadId);
  };

  // Clear local messages when switching threads
  useEffect(() => {
    if (selectedThreadId === NEW_CHAT_ID) {
      // Starting a new chat - clear everything
      setLocalMessages([]);
      setStreamingMessage("");
      setIsNewThread(true);
    } else if (!isNewThread) {
      // Switching to an existing thread
      setLocalMessages([]);
      setStreamingMessage("");
    }
  }, [selectedThreadId, isNewThread]);
  
  // Fetch messages for selected thread (but not for placeholder or newly created threads)
  const { data: messagesData } = useQuery<{ messages: Message[]; total: number }>({
    queryKey: ["messages", selectedThreadId],
    queryFn: () =>
      apiClient.getMessages(selectedThreadId!) as Promise<{ messages: Message[]; total: number }>,
    enabled: !!selectedThreadId && selectedThreadId !== NEW_CHAT_ID && !isNewThread,
  });

  const messages = messagesData?.messages || [];

  // Sync local messages with fetched messages (but not for new threads or while streaming)
  useEffect(() => {
    if (messages.length > 0 && !isStreaming && !isNewThread) {
      setLocalMessages(messages);
    }
  }, [messages, isStreaming, isNewThread]);

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
    if (!input.trim() || isStreaming) return;

    const messageText = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Determine if this is a new chat or existing thread
    const isNewChat = selectedThreadId === NEW_CHAT_ID;
    
    // Add user message optimistically (always, for both new and existing)
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      thread_id: selectedThreadId || NEW_CHAT_ID,
      role: "user",
      content: messageText,
      tokens_prompt: null,
      tokens_completion: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, userMessage]);

    try {
      let response: Response;
      
      if (isNewChat || selectedThreadId === NEW_CHAT_ID) {
        // Use the new start-chat endpoint
        response = await apiClient.startChat(documentId, messageText, currentPage);
      } else {
        // Use existing thread streaming endpoint
        const supabase = await import("@/lib/supabase/client").then((m) => m.createClient());
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          throw new Error("Not authenticated");
        }

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";
        const url = `${apiBaseUrl}/threads/${selectedThreadId}/stream?query=${encodeURIComponent(messageText)}${currentPage ? `&page_context=${currentPage}` : ""}`;

        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

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

              if (data.type === "start") {
                // Handle new thread creation
                if (data.thread_id && isNewChat) {
                  // Replace placeholder with real thread ID
                  const oldThreadId = selectedThreadId;
                  setSelectedThreadId(data.thread_id);
                  setIsNewThread(true); // Mark this as a new thread to prevent fetching
                  
                  // Update existing messages with new thread ID
                  setLocalMessages(prev => prev.map(msg => 
                    msg.thread_id === oldThreadId ? { ...msg, thread_id: data.thread_id } : msg
                  ));
                  
                  // Add the new thread to the cache without refetching
                  const newThread: Thread = {
                    id: data.thread_id,
                    user_id: "", // Will be filled by backend
                    document_id: documentId,
                    title: data.title || "New Chat",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  
                  queryClient.setQueryData(
                    ["threads", documentId],
                    (oldData: { threads: Thread[]; total: number } | undefined) => {
                      if (!oldData) {
                        return { threads: [newThread], total: 1 };
                      }
                      return {
                        ...oldData,
                        threads: [newThread, ...oldData.threads],
                        total: oldData.total + 1,
                      };
                    }
                  );
                }
                
                // Update thread title if provided (only for existing threads)
                if (data.title && !isNewChat) {
                  const threadIdToUpdate = selectedThreadId;
                  queryClient.setQueryData(
                    ["threads", documentId],
                    (oldData: { threads: Thread[]; total: number } | undefined) => {
                      if (!oldData) return oldData;
                      return {
                        ...oldData,
                        threads: oldData.threads.map((t) =>
                          t.id === threadIdToUpdate ? { ...t, title: data.title } : t
                        ),
                      };
                    }
                  );
                }
              } else if (data.type === "token") {
                fullMessage += data.content || "";
                setStreamingMessage(fullMessage);
              } else if (data.type === "done") {
                // Add assistant message to local messages
                const currentThreadId = data.thread_id || selectedThreadId;
                const assistantMessage: Message = {
                  id: `temp-assistant-${Date.now()}`,
                  thread_id: currentThreadId!,
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
                
                // Don't refresh messages for any thread while streaming
                // We already have the messages locally, and refreshing would clear the assistant message
                // The messages will be fetched fresh when the user navigates away and back
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

  const handleNewChat = () => {
    // Set to placeholder ID for new chat
    setSelectedThreadId(NEW_CHAT_ID);
    setIsNewThread(true);
    setLocalMessages([]);
    setStreamingMessage("");
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await apiClient.deleteThread(threadId);
      
      // If we're deleting the currently selected thread, select another one
      if (selectedThreadId === threadId) {
        const remainingThreads = threads.filter(t => t.id !== threadId);
        if (remainingThreads.length > 0) {
          // Select the first remaining thread
          setSelectedThreadId(remainingThreads[0].id);
        } else {
          // No threads left, clear selection
          setSelectedThreadId(null);
        }
      }
      
      // Refresh the threads list
      queryClient.invalidateQueries({ queryKey: ["threads", documentId] });
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header with thread tabs and actions */}
      <ThreadTabs
        threads={threads}
        selectedThreadId={selectedThreadId}
        onThreadSelect={handleThreadSelect}
        onCreateThread={handleNewChat}
        onDeleteThread={handleDeleteThread}
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
