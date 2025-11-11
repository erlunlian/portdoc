"use client";

import type { Message } from "@/types/api";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageComponent } from "./message";

interface MessageListProps {
  messages: Message[];
  streamingMessage: string;
  isStreaming: boolean;
}

export function MessageList({ messages, streamingMessage, isStreaming }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="space-y-3">
        {messages.map((message: Message) => (
          <MessageComponent key={message.id} message={message} />
        ))}

        {/* Loading state - shown when streaming starts but no tokens received yet */}
        {isStreaming && !streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[75%]">
              <div className="shimmer-text text-sm font-medium">Thinking...</div>
            </div>
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[75%]">
              <div className="message-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="bg-muted-foreground inline-block h-1.5 w-1.5 animate-pulse rounded-full opacity-60"></span>
                <span className="bg-muted-foreground animation-delay-200 inline-block h-1.5 w-1.5 animate-pulse rounded-full opacity-60"></span>
                <span className="bg-muted-foreground animation-delay-400 inline-block h-1.5 w-1.5 animate-pulse rounded-full opacity-60"></span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}
