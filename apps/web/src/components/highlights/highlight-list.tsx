"use client";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Calendar, FileText, Highlighter, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

interface HighlightListProps {
  documentId: string;
  currentPage?: number;
  onJumpToPage?: (page: number) => void;
}

type SortBy = "created" | "page";
type SortOrder = "asc" | "desc";

export function HighlightList({ documentId, currentPage, onJumpToPage }: HighlightListProps) {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc"); // desc = recent first
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: highlightsData, isLoading } = useQuery<{
    highlights: Highlight[];
    total: number;
  }>({
    queryKey: ["highlights", documentId],
    queryFn: () =>
      apiClient.getHighlights(documentId) as Promise<{
        highlights: Highlight[];
        total: number;
      }>,
  });

  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      return apiClient.deleteHighlight(highlightId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
    },
  });

  const updateHighlightMutation = useMutation({
    mutationFn: async ({ highlightId, note }: { highlightId: string; note: string | null }) => {
      return apiClient.updateHighlight(highlightId, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
      setEditingHighlight(null);
      setNoteText("");
    },
  });

  const highlights = highlightsData?.highlights || [];

  const handleDelete = (highlightId: string) => {
    if (confirm("Delete this highlight?")) {
      deleteHighlightMutation.mutate(highlightId);
    }
  };

  const handleEditNote = (highlight: Highlight) => {
    setEditingHighlight(highlight);
    setNoteText(highlight.note || "");
  };

  const handleSaveNote = () => {
    if (!editingHighlight) return;
    updateHighlightMutation.mutate({
      highlightId: editingHighlight.id,
      note: noteText.trim() || null,
    });
  };

  const handleCloseDialog = () => {
    setEditingHighlight(null);
    setNoteText("");
  };

  const handleJumpToPage = (page: number) => {
    if (onJumpToPage) {
      onJumpToPage(page);
    } else {
      // Fallback to event-based approach
      window.dispatchEvent(new CustomEvent("jumpToPage", { detail: { page } }));
    }
  };

  const handleJumpToHighlight = (highlight: Highlight) => {
    // First jump to the page
    handleJumpToPage(highlight.page);
    // Then dispatch event to scroll to and flash the specific highlight
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("scrollToHighlight", {
          detail: { highlightId: highlight.id, page: highlight.page },
        })
      );
    }, 300); // Wait for page navigation to complete
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="text-muted-foreground text-sm">Loading highlights...</div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Highlighter className="text-muted-foreground/50 mb-3 h-12 w-12" />
        <div className="text-muted-foreground text-sm">No highlights yet</div>
        <div className="text-muted-foreground/75 mt-1 text-xs">
          Select text in the PDF to create a highlight
        </div>
      </div>
    );
  }

  // Sort highlights based on selected option and order
  const sortedHighlights = [...highlights].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "created") {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === "page") {
      comparison = a.page - b.page;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSortToggle = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      // Toggle order if clicking the same sort option
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Switch to new sort option with default order
      setSortBy(newSortBy);
      setSortOrder(newSortBy === "created" ? "desc" : "asc"); // default: recent first for created, page up for page
    }
  };

  const sortOptions = [
    {
      value: "created" as SortBy,
      label: "Created At",
      icon: <Calendar className="h-3 w-3" />,
      arrow: sortBy === "created" ? (sortOrder === "desc" ? "↓" : "↑") : null,
    },
    {
      value: "page" as SortBy,
      label: "Page",
      icon: <FileText className="h-3 w-3" />,
      arrow: sortBy === "page" ? (sortOrder === "asc" ? "↑" : "↓") : null,
    },
  ];

  return (
    <>
      {/* Note Dialog */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[540px] rounded-3xl bg-white p-8 shadow-xl dark:bg-gray-800">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingHighlight.note ? "Edit Note" : "Add Note"}
              </h3>
              <button
                onClick={handleCloseDialog}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {editingHighlight.text.length > 100
                  ? editingHighlight.text.substring(0, 100) + "..."
                  : editingHighlight.text}
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
                className={cn(
                  "flex-1 rounded-2xl px-5 py-2.5 text-sm font-medium text-white transition-colors",
                  "bg-blue-500 hover:bg-blue-600"
                )}
              >
                Save Note
              </button>
              <button
                onClick={handleCloseDialog}
                className="flex-1 rounded-2xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full flex-col">
        {/* Header with sort options - fixed at top */}
        <div className="flex-shrink-0 border-b px-4 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Highlighter className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">
                {highlights.length} Highlight{highlights.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ArrowUpDown className="text-muted-foreground h-3.5 w-3.5" />
          </div>

          {/* Sort buttons */}
          <div className="flex flex-wrap gap-1.5">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortToggle(option.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors",
                  sortBy === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
                title={`Sort by ${option.label}${option.arrow ? ` ${option.arrow === "↑" ? "(ascending)" : "(descending)"}` : ""}`}
              >
                {option.icon}
                <span>{option.label}</span>
                {option.arrow && <span className="ml-0.5 font-bold">{option.arrow}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {sortedHighlights.map((highlight: Highlight) => (
              <div
                key={highlight.id}
                className="group relative cursor-pointer rounded-2xl bg-amber-50/50 p-3 transition-colors hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                onClick={() => handleJumpToHighlight(highlight)}
              >
                {/* Page indicator */}
                <div className="text-muted-foreground mb-1.5 flex items-center gap-2 text-xs">
                  <FileText className="h-3 w-3" />
                  <span>Page {highlight.page}</span>
                  {currentPage === highlight.page && (
                    <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      Current
                    </span>
                  )}
                </div>

                {/* Highlight text */}
                <div className="pr-8 text-sm leading-relaxed">{highlight.text}</div>

                {/* Note */}
                {highlight.note && (
                  <div className="mt-2 rounded-xl bg-blue-50/50 p-2 text-sm italic text-blue-900 dark:bg-blue-900/10 dark:text-blue-100">
                    {highlight.note}
                  </div>
                )}

                {/* Action buttons */}
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditNote(highlight);
                    }}
                    className="h-6 w-6"
                    aria-label="Edit note"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(highlight.id);
                    }}
                    className="h-6 w-6"
                    aria-label="Delete highlight"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Date */}
                <div className="text-muted-foreground mt-1.5 text-xs">
                  {new Date(highlight.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
