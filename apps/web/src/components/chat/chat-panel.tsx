"use client";

import { apiClient } from "@/lib/api/client";
import type { Message, Thread } from "@/types/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  const [hasPendingNewChat, setHasPendingNewChat] = useState(true); // Track if pending new chat exists
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({}); // Cache messages per thread
  const queryClient = useQueryClient();
  const prevThreadIdRef = useRef<string | null>(selectedThreadId);
  const localMessagesRef = useRef<Message[]>(localMessages);

  // Keep ref in sync with state
  useEffect(() => {
    localMessagesRef.current = localMessages;
  }, [localMessages]);

  // Fetch threads
  const { data: threadsData } = useQuery<{ threads: Thread[]; total: number }>({
    queryKey: ["threads", documentId],
    queryFn: () =>
      apiClient.getThreads(documentId) as Promise<{ threads: Thread[]; total: number }>,
  });

  const threads = threadsData?.threads || [];

  // Don't auto-select threads anymore - start with empty chat

  // Handle thread selection
  const handleThreadSelect = (threadId: string) => {
    if (threadId === NEW_CHAT_ID) {
      setIsNewThread(true);
    } else {
      setIsNewThread(false);
    }
    setSelectedThreadId(threadId);
  };

  // Cache messages when switching threads
  useEffect(() => {
    // Only cache when thread actually changes
    if (prevThreadIdRef.current && prevThreadIdRef.current !== selectedThreadId) {
      const prevMessages = localMessagesRef.current;
      if (prevMessages.length > 0) {
        setMessagesCache((prev) => ({
          ...prev,
          [prevThreadIdRef.current!]: prevMessages,
        }));
      }
    }

    // Update ref for next switch
    prevThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  // Load messages when switching to a thread
  useEffect(() => {
    if (selectedThreadId === NEW_CHAT_ID) {
      // Load cached messages for pending new chat or start fresh
      const cached = messagesCache[NEW_CHAT_ID];
      if (!cached || cached.length === 0) {
        setLocalMessages([]);
      } else if (JSON.stringify(cached) !== JSON.stringify(localMessages)) {
        setLocalMessages(cached);
      }
      setStreamingMessage("");
      setIsNewThread(true);
    } else if (!isNewThread && selectedThreadId) {
      // Check cache first for existing threads
      const cached = messagesCache[selectedThreadId];
      if (cached && cached.length > 0) {
        if (JSON.stringify(cached) !== JSON.stringify(localMessages)) {
          setLocalMessages(cached);
        }
      } else if (localMessages.length > 0) {
        // Clear local messages so they can be loaded from API
        setLocalMessages([]);
      }
      setStreamingMessage("");
    }
  }, [selectedThreadId, isNewThread, messagesCache]);

  // Fetch messages for selected thread (but not for placeholder or newly created threads)
  const { data: messagesData } = useQuery<{ messages: Message[]; total: number }>({
    queryKey: ["messages", selectedThreadId],
    queryFn: () =>
      apiClient.getMessages(selectedThreadId!) as Promise<{ messages: Message[]; total: number }>,
    enabled: !!selectedThreadId && selectedThreadId !== NEW_CHAT_ID && !isNewThread,
  });

  const messages = messagesData?.messages || [];

  // Sync local messages with fetched messages
  useEffect(() => {
    // Update local messages with fetched messages in these cases:
    // 1. When first loading a thread (localMessages is empty)
    // 2. When messages are refetched after streaming (replace temp IDs with real IDs)
    if (messages.length > 0 && !isStreaming && !isNewThread) {
      // If we have local messages with temp IDs, replace them with server messages
      const hasTempMessages = localMessages.some((msg) => msg.id.startsWith("temp-"));

      if (localMessages.length === 0 || hasTempMessages) {
        setLocalMessages(messages);
      }
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
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      let response: Response;

      if (isNewChat || selectedThreadId === NEW_CHAT_ID) {
        // Use the new start-chat endpoint
        response = await apiClient.startChat(documentId, messageText, currentPage);
      } else {
        // Use existing thread streaming endpoint
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";
        const url = `${apiBaseUrl}/threads/${selectedThreadId}/stream?query=${encodeURIComponent(messageText)}${currentPage ? `&page_context=${currentPage}` : ""}`;

        response = await fetch(url);
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
                  setHasPendingNewChat(false); // No longer have a pending new chat

                  // Update existing messages with new thread ID
                  setLocalMessages((prev) =>
                    prev.map((msg) =>
                      msg.thread_id === oldThreadId ? { ...msg, thread_id: data.thread_id } : msg
                    )
                  );

                  // Clear the pending chat from cache
                  setMessagesCache((prev) => {
                    const { [NEW_CHAT_ID]: removed, ...rest } = prev;
                    return rest;
                  });

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
                setLocalMessages((prev) => [...prev, assistantMessage]);

                setIsStreaming(false);
                setStreamingMessage("");

                // After streaming completes, invalidate and refetch messages to get server-side messages with real IDs
                // But only for existing threads (not for brand new threads that were just created)
                if (currentThreadId && currentThreadId !== NEW_CHAT_ID) {
                  setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["messages", currentThreadId] });
                  }, 1000); // Small delay to ensure backend has saved the messages
                }
                return;
              } else if (data.type === "error") {
                // Remove the optimistic user message on error
                setLocalMessages((prev) => prev.slice(0, -1));
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
    // If we already have a pending new chat, just switch to it
    if (hasPendingNewChat) {
      setSelectedThreadId(NEW_CHAT_ID);
      setIsNewThread(true);
      return;
    }

    // Create a new pending chat
    setSelectedThreadId(NEW_CHAT_ID);
    setIsNewThread(true);
    setHasPendingNewChat(true);
    setLocalMessages([]);
    setStreamingMessage("");
    // Clear any cached messages for the pending chat
    setMessagesCache((prev) => {
      const { [NEW_CHAT_ID]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleDeleteThread = async (threadId: string) => {
    // Handle deleting the pending new chat tab
    if (threadId === NEW_CHAT_ID) {
      setHasPendingNewChat(false);
      // Clear cached messages for pending chat
      setMessagesCache((prev) => {
        const { [NEW_CHAT_ID]: removed, ...rest } = prev;
        return rest;
      });

      // Switch to another thread or create a new one
      if (threads.length > 0) {
        setSelectedThreadId(threads[0].id);
        setIsNewThread(false);
      } else {
        // No threads left, create a new pending chat
        setSelectedThreadId(NEW_CHAT_ID);
        setIsNewThread(true);
        setHasPendingNewChat(true);
        setLocalMessages([]);
      }
      return;
    }

    // Handle deleting regular threads
    try {
      await apiClient.deleteThread(threadId);

      // If we're deleting the currently selected thread, select another one
      if (selectedThreadId === threadId) {
        const remainingThreads = threads.filter((t) => t.id !== threadId);
        if (remainingThreads.length > 0) {
          // Select the first remaining thread
          setSelectedThreadId(remainingThreads[0].id);
          setIsNewThread(false);
        } else if (hasPendingNewChat) {
          // Switch to pending new chat if it exists
          setSelectedThreadId(NEW_CHAT_ID);
          setIsNewThread(true);
        } else {
          // No threads left, create a new pending chat
          setSelectedThreadId(NEW_CHAT_ID);
          setIsNewThread(true);
          setHasPendingNewChat(true);
          setLocalMessages([]);
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
        hasPendingNewChat={hasPendingNewChat}
      />

      {/* Messages */}
      <MessageList
        messages={localMessages}
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
