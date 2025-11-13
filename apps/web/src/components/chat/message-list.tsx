"use client";

import type { Message } from "@/types/api";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto p-4">
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {streamingMessage}
                  </ReactMarkdown>
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
    </div>
  );
}
