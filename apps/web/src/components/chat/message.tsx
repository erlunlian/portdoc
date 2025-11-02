"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/types/api";

interface MessageProps {
  message: Message;
}

export function MessageComponent({ message }: MessageProps) {
  return (
    <div
      className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
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
  );
}