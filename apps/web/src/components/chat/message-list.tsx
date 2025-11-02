"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types/api";
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
    <div className="bg-background min-h-0 flex-1 overflow-auto p-4">
      <div className="space-y-3">
        {messages.map((message: Message) => (
          <MessageComponent key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingMessage && (
          <div className="flex justify-start">
            <div className="bg-muted max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm">
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {streamingMessage}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="bg-primary inline-block h-1.5 w-1.5 animate-pulse rounded-full"></span>
                <span className="bg-primary animation-delay-200 inline-block h-1.5 w-1.5 animate-pulse rounded-full"></span>
                <span className="bg-primary animation-delay-400 inline-block h-1.5 w-1.5 animate-pulse rounded-full"></span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}