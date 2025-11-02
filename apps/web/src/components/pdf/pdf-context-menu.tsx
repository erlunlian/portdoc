"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Highlighter, MessageSquare, StickyNote, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Selection {
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  pageNumber: number;
}

interface PdfContextMenuProps {
  selection: Selection;
  documentId: string;
  onClose: () => void;
  scale: number;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function PdfContextMenu({
  selection,
  documentId,
  onClose,
  scale,
}: PdfContextMenuProps) {
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Create highlight mutation
  const createHighlightMutation = useMutation({
    mutationFn: async (data: {
      page: number;
      rects: Array<{ x: number; y: number; width: number; height: number }>;
      text: string;
      note?: string;
    }) => {
      return apiClient.createHighlight(documentId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
      onClose();
    },
  });

  // Calculate menu position
  useEffect(() => {
    if (!selection || !menuRef.current) return;

    const menuWidth = menuRef.current.offsetWidth;
    const menuHeight = menuRef.current.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Position menu above the selection by default
    let x = selection.rect.x + selection.rect.width / 2 - menuWidth / 2;
    let y = selection.rect.y - menuHeight - 10;

    // Adjust if menu would go off-screen
    if (x < 10) x = 10;
    if (x + menuWidth > windowWidth - 10) x = windowWidth - menuWidth - 10;
    if (y < 10) {
      // Position below selection if no room above
      y = selection.rect.y + selection.rect.height + 10;
    }
    if (y + menuHeight > windowHeight - 10) {
      y = windowHeight - menuHeight - 10;
    }

    setPosition({ x, y });
  }, [selection]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleHighlight = () => {
    createHighlightMutation.mutate({
      page: selection.pageNumber,
      rects: [selection.rect],
      text: selection.text,
    });
  };

  const handleAddNote = () => {
    setShowNoteDialog(true);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    
    createHighlightMutation.mutate({
      page: selection.pageNumber,
      rects: [selection.rect],
      text: selection.text,
      note: noteText,
    });
  };

  const handleAddToChat = () => {
    // Dispatch custom event to add text to chat
    window.dispatchEvent(
      new CustomEvent("addToChat", {
        detail: { text: selection.text, page: selection.pageNumber },
      })
    );
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selection.text);
    onClose();
  };

  if (showNoteDialog) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-96 rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add Note</h3>
            <button
              onClick={() => setShowNoteDialog(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mb-2 rounded bg-gray-50 p-3">
            <p className="text-sm text-gray-600">
              {selection.text.length > 100
                ? selection.text.substring(0, 100) + "..."
                : selection.text}
            </p>
          </div>
          
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your note here..."
            className="mb-4 h-32 w-full rounded border p-3 text-sm focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          
          <div className="flex gap-2">
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim()}
              className={cn(
                "flex-1 rounded px-4 py-2 text-sm font-medium text-white",
                noteText.trim()
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setShowNoteDialog(false);
                setNoteText("");
              }}
              className="flex-1 rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-40 rounded-lg border bg-white py-2 shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="px-3 pb-2 pt-1">
        <p className="text-xs text-gray-500">
          {selection.text.length > 50
            ? selection.text.substring(0, 50) + "..."
            : selection.text}
        </p>
      </div>
      
      <div className="border-t pt-1">
        <button
          onClick={handleHighlight}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100"
        >
          <Highlighter className="h-4 w-4 text-yellow-500" />
          <span>Highlight</span>
        </button>
        
        <button
          onClick={handleAddNote}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100"
        >
          <StickyNote className="h-4 w-4 text-blue-500" />
          <span>Add Note</span>
        </button>
        
        <button
          onClick={handleAddToChat}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100"
        >
          <MessageSquare className="h-4 w-4 text-green-500" />
          <span>Add to Chat</span>
        </button>
        
        <div className="my-1 border-t" />
        
        <button
          onClick={handleCopy}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100"
        >
          <Copy className="h-4 w-4 text-gray-500" />
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
}