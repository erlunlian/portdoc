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
  initialThreadId?: string | null;
  onThreadChange?: (threadId: string | null) => void;
}

interface HighlightContext {
  id: string;
  text: string;
  page: number;
}

const NEW_CHAT_ID = "new-chat-pending";

export function ChatPanel({
  documentId,
  currentPage,
  initialThreadId,
  onThreadChange,
}: ChatPanelProps) {
  // Initialize thread ID from prop if provided, otherwise start with new chat
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId || NEW_CHAT_ID
  );
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isNewThread, setIsNewThread] = useState(
    !initialThreadId || initialThreadId === NEW_CHAT_ID
  ); // Start as new thread if no initial thread
  const [hasPendingNewChat, setHasPendingNewChat] = useState(
    !initialThreadId || initialThreadId === NEW_CHAT_ID
  ); // Track if pending new chat exists
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({}); // Cache messages per thread
  const [highlightContexts, setHighlightContexts] = useState<HighlightContext[]>([]); // Highlight context pills
  const queryClient = useQueryClient();
  const prevThreadIdRef = useRef<string | null>(selectedThreadId);
  const localMessagesRef = useRef<Message[]>(localMessages);
  const messagesCacheRef = useRef<Record<string, Message[]>>(messagesCache);

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

  // Validate that initialThreadId exists in threads, if not reset to new chat
  useEffect(() => {
    if (!initialThreadId || initialThreadId === NEW_CHAT_ID) return;

    // Only validate if threads have loaded
    if (threads.length > 0) {
      const threadExists = threads.some((t) => t.id === initialThreadId);
      if (!threadExists && selectedThreadId === initialThreadId) {
        // Initial thread no longer exists, reset to new chat
        setSelectedThreadId(NEW_CHAT_ID);
        setIsNewThread(true);
        setHasPendingNewChat(true);
        onThreadChange?.(NEW_CHAT_ID);
      }
    }
  }, [threads, initialThreadId, selectedThreadId, onThreadChange]);

  // Handle thread selection
  const handleThreadSelect = (threadId: string) => {
    if (threadId === NEW_CHAT_ID) {
      setIsNewThread(true);
    } else {
      setIsNewThread(false);
    }
    setSelectedThreadId(threadId);
    // Notify parent of thread change
    onThreadChange?.(threadId);
  };

  // Cache and load messages when switching threads
  useEffect(() => {
    // Only cache when thread actually changes
    if (prevThreadIdRef.current && prevThreadIdRef.current !== selectedThreadId) {
      // Don't clear messages if we're currently streaming (this happens when a new thread is created)
      if (isStreaming) {
        // Just update the ref and return - we'll handle the messages after streaming completes
        prevThreadIdRef.current = selectedThreadId;
        return;
      }

      // IMPORTANT: Save messages BEFORE loading new thread's messages
      const prevMessages = localMessagesRef.current;
      if (prevMessages.length > 0) {
        const updatedCache = {
          ...messagesCacheRef.current,
          [prevThreadIdRef.current!]: prevMessages,
        };
        messagesCacheRef.current = updatedCache;
        setMessagesCache(updatedCache);
      }

      // Now load the new thread's messages from cache
      if (selectedThreadId === NEW_CHAT_ID) {
        // Load cached messages for pending new chat or start fresh
        const cached = messagesCacheRef.current[NEW_CHAT_ID];
        if (cached && cached.length > 0) {
          setLocalMessages(cached);
        } else {
          setLocalMessages([]);
        }
        setStreamingMessage("");
        setIsNewThread(true);
      } else if (selectedThreadId) {
        // For existing threads, check cache first
        const cached = messagesCacheRef.current[selectedThreadId];
        if (cached && cached.length > 0) {
          setLocalMessages(cached);
        } else {
          // Clear local messages so they can be loaded from API
          setLocalMessages([]);
        }
        setStreamingMessage("");
        setIsNewThread(false);
      }
    }

    // Update ref for next switch (after all operations)
    prevThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId, isStreaming]);

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

  // Add highlight context
  const handleAddHighlightContext = (text: string, page: number) => {
    const newContext: HighlightContext = {
      id: `context-${Date.now()}-${Math.random()}`,
      text,
      page,
    };
    setHighlightContexts((prev) => [...prev, newContext]);
  };

  // Remove highlight context
  const handleRemoveContext = (contextId: string) => {
    setHighlightContexts((prev) => prev.filter((c) => c.id !== contextId));
  };

  // Listen for "Add to Chat" events from PDF context menu
  useEffect(() => {
    const handleAddToChat = (event: CustomEvent<{ text: string; page: number }>) => {
      const { text, page } = event.detail;
      handleAddHighlightContext(text, page);
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
    // Store the clean message text (without contexts) and contexts separately in metadata
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      thread_id: selectedThreadId || NEW_CHAT_ID,
      role: "user",
      content: messageText, // Clean message without context text
      tokens_prompt: null,
      tokens_completion: null,
      metadata:
        highlightContexts.length > 0
          ? {
              highlight_contexts: highlightContexts.map((ctx) => ({
                text: ctx.text,
                page: ctx.page,
              })),
            }
          : null,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      let response: Response;

      if (isNewChat || selectedThreadId === NEW_CHAT_ID) {
        // Use the new start-chat endpoint
        // Send clean message and contexts separately
        const contextsArray =
          highlightContexts.length > 0
            ? highlightContexts.map((ctx) => ({ text: ctx.text, page: ctx.page }))
            : undefined;
        response = await apiClient.startChat(documentId, messageText, currentPage, contextsArray);
      } else {
        // Use existing thread streaming endpoint
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";
        const params = new URLSearchParams({
          query: messageText, // Send clean message
        });
        if (currentPage) {
          params.append("page_context", currentPage.toString());
        }
        if (highlightContexts.length > 0) {
          params.append(
            "highlight_contexts",
            JSON.stringify(highlightContexts.map((ctx) => ({ text: ctx.text, page: ctx.page })))
          );
        }
        const url = `${apiBaseUrl}/threads/${selectedThreadId}/stream?${params}`;

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

                  // Notify parent of thread change
                  onThreadChange?.(data.thread_id);

                  // Update existing messages with new thread ID
                  setLocalMessages((prev) =>
                    prev.map((msg) =>
                      msg.thread_id === oldThreadId ? { ...msg, thread_id: data.thread_id } : msg
                    )
                  );

                  // Clear the pending chat from cache
                  const { [NEW_CHAT_ID]: removed, ...rest } = messagesCacheRef.current;
                  messagesCacheRef.current = rest;
                  setMessagesCache(rest);

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

                // Clear highlight contexts after successful send
                setHighlightContexts([]);

                // Mark thread as no longer new after first message exchange completes
                // This allows the query to refetch and sync messages with real IDs
                if (isNewThread) {
                  setIsNewThread(false);
                }

                // After streaming completes, invalidate and refetch messages to get server-side messages with real IDs
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
      onThreadChange?.(NEW_CHAT_ID);
      return;
    }

    // Create a new pending chat
    setSelectedThreadId(NEW_CHAT_ID);
    setIsNewThread(true);
    setHasPendingNewChat(true);
    setLocalMessages([]);
    setStreamingMessage("");
    // Clear any cached messages for the pending chat
    const { [NEW_CHAT_ID]: removed, ...rest } = messagesCacheRef.current;
    messagesCacheRef.current = rest;
    setMessagesCache(rest);
    // Notify parent of thread change
    onThreadChange?.(NEW_CHAT_ID);
  };

  const handleDeleteThread = async (threadId: string) => {
    // Handle deleting the pending new chat tab
    if (threadId === NEW_CHAT_ID) {
      setHasPendingNewChat(false);
      // Clear cached messages for pending chat
      const { [NEW_CHAT_ID]: removed, ...rest } = messagesCacheRef.current;
      messagesCacheRef.current = rest;
      setMessagesCache(rest);

      // Switch to another thread or create a new one
      if (threads.length > 0) {
        setSelectedThreadId(threads[0].id);
        setIsNewThread(false);
        onThreadChange?.(threads[0].id);
      } else {
        // No threads left, create a new pending chat
        setSelectedThreadId(NEW_CHAT_ID);
        setIsNewThread(true);
        setHasPendingNewChat(true);
        setLocalMessages([]);
        onThreadChange?.(NEW_CHAT_ID);
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
          const newThreadId = remainingThreads[0].id;
          setSelectedThreadId(newThreadId);
          setIsNewThread(false);
          onThreadChange?.(newThreadId);
        } else if (hasPendingNewChat) {
          // Switch to pending new chat if it exists
          setSelectedThreadId(NEW_CHAT_ID);
          setIsNewThread(true);
          onThreadChange?.(NEW_CHAT_ID);
        } else {
          // No threads left, create a new pending chat
          setSelectedThreadId(NEW_CHAT_ID);
          setIsNewThread(true);
          setHasPendingNewChat(true);
          setLocalMessages([]);
          onThreadChange?.(NEW_CHAT_ID);
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
      <div className="flex-shrink-0">
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={localMessages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
        />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <MessageInput
          input={input}
          onInputChange={setInput}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          currentPage={currentPage}
          highlightContexts={highlightContexts}
          onRemoveContext={handleRemoveContext}
        />
      </div>
    </div>
  );
}
