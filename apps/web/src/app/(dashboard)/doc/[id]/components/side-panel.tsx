"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { HighlightList } from "@/components/highlights/highlight-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Highlighter, MessageSquare } from "lucide-react";
import { useState } from "react";

interface SidePanelProps {
  documentId: string;
  currentPage: number;
  onJumpToPage: (page: number) => void;
}

export function SidePanel({ documentId, currentPage, onJumpToPage }: SidePanelProps) {
  const [activeView, setActiveView] = useState<"chat" | "highlights">("chat");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Icon Toggle Header */}
      <div className="bg-background flex items-center justify-between px-4 pt-2">
        <h3 className="text-foreground text-base font-semibold">
          {activeView === "chat" ? "Chat" : "Highlights"}
        </h3>
        <div className="flex gap-2">
          <Button
            variant={activeView === "chat" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveView("chat")}
            className={cn(
              "h-8 w-8 rounded-full",
              activeView === "chat" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            title="Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant={activeView === "highlights" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveView("highlights")}
            className={cn(
              "h-8 w-8 rounded-full",
              activeView === "highlights"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
            title="Highlights"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content with transition */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            activeView === "chat" ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <ChatPanel documentId={documentId} currentPage={currentPage} />
        </div>
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            activeView === "highlights" ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <HighlightList
            documentId={documentId}
            currentPage={currentPage}
            onJumpToPage={onJumpToPage}
          />
        </div>
      </div>
    </div>
  );
}