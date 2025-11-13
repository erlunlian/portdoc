"use client";

import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface HighlightContext {
  id: string;
  text: string;
  page: number;
}

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  isStreaming: boolean;
  currentPage?: number;
  highlightContexts?: HighlightContext[];
  onRemoveContext?: (contextId: string) => void;
}

export function MessageInput({
  input,
  onInputChange,
  onSendMessage,
  isStreaming,
  currentPage,
  highlightContexts = [],
  onRemoveContext,
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
        {/* Highlight Context Pills */}
        {highlightContexts.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b p-3 pb-2">
            {highlightContexts.map((context) => (
              <div
                key={context.id}
                className="group flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm transition-colors hover:bg-blue-100"
              >
                <span className="text-blue-600">📄</span>
                <span className="text-muted-foreground text-xs">Page {context.page}:</span>
                <span className="max-w-[200px] truncate text-xs">
                  "{context.text}"
                </span>
                {onRemoveContext && (
                  <button
                    onClick={() => onRemoveContext(context.id)}
                    className="text-muted-foreground hover:text-foreground ml-1 rounded-full p-0.5 transition-colors hover:bg-blue-200"
                    aria-label="Remove context"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
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