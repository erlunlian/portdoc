"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Thread } from "@/types/api";
import { Archive, MessageSquare, MoreHorizontal, Plus, X } from "lucide-react";
import { useRef } from "react";

interface ThreadTabsProps {
  threads: Thread[];
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  showArchive: boolean;
  onToggleArchive: () => void;
}

export function ThreadTabs({
  threads,
  selectedThreadId,
  onThreadSelect,
  onCreateThread,
  onDeleteThread,
  showArchive,
  onToggleArchive,
}: ThreadTabsProps) {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-background flex-shrink-0 p-2">
      <div className="flex items-center gap-2">
        {/* Thread tabs */}
        <div className="flex flex-1 items-center overflow-hidden p-2">
          <div
            ref={tabsContainerRef}
            className="scrollbar-hide flex flex-1 gap-1 overflow-x-auto pb-1"
          >
            {threads.map((thread: Thread) => (
              <button
                key={thread.id}
                onClick={() => onThreadSelect(thread.id)}
                className={cn(
                  "group relative flex min-w-0 flex-shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all",
                  selectedThreadId === thread.id
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare className="h-3 w-3" />
                <span className="whitespace-nowrap">
                  {thread.title || `Chat ${new Date(thread.created_at).toLocaleDateString()}`}
                </span>
                <div className="bg-muted absolute inset-y-0 right-1 flex items-center rounded-md p-0.5 opacity-0 transition-all group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    className="hover:bg-muted rounded-sm shadow-sm transition-colors"
                    title="Close tab"
                  >
                    <X className="m-0.5 h-3 w-3" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateThread}
            className="h-8 w-8 rounded-lg"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleArchive}
            className="h-8 w-8 rounded-lg"
            title="Chat history"
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="More options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
