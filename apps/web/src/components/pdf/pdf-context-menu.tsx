"use client";

import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Highlighter, MessageSquare, StickyNote, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Selection {
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  pageRelativeRect: { x: number; y: number; width: number; height: number };
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

export function PdfContextMenu({ selection, documentId, onClose, scale }: PdfContextMenuProps) {
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

    // Position menu centered above the selection
    let x = selection.rect.x + selection.rect.width / 2 - menuWidth / 2;
    let y = selection.rect.y - menuHeight - 8;

    // Adjust horizontally if menu would go off-screen
    if (x < 10) x = 10;
    if (x + menuWidth > windowWidth - 10) x = windowWidth - menuWidth - 10;

    // If no room above, position below selection
    if (y < 10) {
      y = selection.rect.y + selection.rect.height + 8;
    }

    // Final vertical adjustment if still off-screen
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
      rects: [selection.pageRelativeRect],
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
      rects: [selection.pageRelativeRect],
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
        <div className="w-[540px] rounded-3xl bg-white p-8 shadow-xl dark:bg-gray-800">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add Note</h3>
            <button
              onClick={() => setShowNoteDialog(false)}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {selection.text.length > 100
                ? selection.text.substring(0, 100) + "..."
                : selection.text}
            </p>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your note here..."
            className="mb-4 h-36 w-full rounded-2xl border p-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            autoFocus
          />

          <div className="flex gap-3">
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim()}
              className={cn(
                "flex-1 rounded-2xl px-5 py-2.5 text-sm font-medium text-white transition-colors",
                noteText.trim() ? "bg-blue-500 hover:bg-blue-600" : "cursor-not-allowed bg-gray-300"
              )}
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setShowNoteDialog(false);
                setNoteText("");
              }}
              className="flex-1 rounded-2xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
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
      className="fixed z-40 rounded-lg border bg-white shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="flex items-center divide-x">
        <button
          onClick={handleHighlight}
          className="group flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-yellow-50"
          title="Highlight"
        >
          <Highlighter className="h-4 w-4 text-yellow-600" />
          <span className="text-gray-700">Highlight</span>
        </button>

        <button
          onClick={handleAddNote}
          className="group flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-blue-50"
          title="Add Note"
        >
          <StickyNote className="h-4 w-4 text-blue-600" />
          <span className="text-gray-700">Note</span>
        </button>

        <button
          onClick={handleAddToChat}
          className="group flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-green-50"
          title="Add to Chat"
        >
          <MessageSquare className="h-4 w-4 text-green-600" />
          <span className="text-gray-700">Chat</span>
        </button>

        <button
          onClick={handleCopy}
          className="group flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50"
          title="Copy"
        >
          <Copy className="h-4 w-4 text-gray-600" />
          <span className="text-gray-700">Copy</span>
        </button>
      </div>
    </div>
  );
}
