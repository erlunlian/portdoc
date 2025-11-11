"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/types/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageProps {
  message: Message;
}

export function MessageComponent({ message }: MessageProps) {
  const handlePageClick = (page: number) => {
    // Dispatch custom event to scroll to page
    window.dispatchEvent(
      new CustomEvent("scrollToPage", {
        detail: { page },
      })
    );
  };

  return (
    <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        {message.role === "assistant" ? (
          <>
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
            {message.metadata?.pages && message.metadata.pages.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-xs">📄 Referenced pages:</span>
                {message.metadata.pages.map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageClick(page)}
                    className="hover:bg-primary/20 bg-muted text-foreground hover:border-primary inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium transition-colors"
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-primary text-primary-foreground rounded-3xl px-4 py-2.5 shadow-sm">
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
