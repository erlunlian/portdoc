"use client";

import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  isStreaming: boolean;
  currentPage?: number;
}

export function MessageInput({
  input,
  onInputChange,
  onSendMessage,
  isStreaming,
  currentPage,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  return (
    <div className="bg-background flex-shrink-0 p-3 pt-2">
      <div className="bg-background rounded-xl border shadow-md">
        <div className="flex items-end gap-2 p-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="Ask anything about this document..."
            className="placeholder:text-muted-foreground/50 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm outline-none"
            rows={1}
            style={{
              minHeight: "24px",
              maxHeight: "120px",
              overflowY: "auto",
            }}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={onSendMessage}
            disabled={!input.trim() || isStreaming}
            className="h-8 w-8 rounded-full"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {currentPage && (
          <div className="border-border/50 text-muted-foreground border-t px-3 py-2 text-xs">
            Context: Page {currentPage}
          </div>
        )}
      </div>
    </div>
  );
}