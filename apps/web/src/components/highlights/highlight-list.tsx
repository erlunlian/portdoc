"use client";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Highlighter, Trash2 } from "lucide-react";

interface HighlightListProps {
  documentId: string;
  currentPage?: number;
  onJumpToPage?: (page: number) => void;
}

export function HighlightList({ documentId, currentPage, onJumpToPage }: HighlightListProps) {
  const queryClient = useQueryClient();

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

  const highlights = highlightsData?.highlights || [];

  const handleDelete = (highlightId: string) => {
    if (confirm("Delete this highlight?")) {
      deleteHighlightMutation.mutate(highlightId);
    }
  };

  const handleJumpToPage = (page: number) => {
    if (onJumpToPage) {
      onJumpToPage(page);
    } else {
      // Fallback to event-based approach
      window.dispatchEvent(new CustomEvent("jumpToPage", { detail: { page } }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-sm text-muted-foreground">Loading highlights...</div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Highlighter className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <div className="text-sm text-muted-foreground">
          No highlights yet
        </div>
        <div className="text-xs text-muted-foreground/75 mt-1">
          Select text in the PDF to create a highlight
        </div>
      </div>
    );
  }

  // Group highlights by page
  const highlightsByPage = highlights.reduce(
    (acc: Record<number, Highlight[]>, highlight: Highlight) => {
      if (!acc[highlight.page]) {
        acc[highlight.page] = [];
      }
      acc[highlight.page].push(highlight);
      return acc;
    },
    {}
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Highlighter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {highlights.length} Highlight{highlights.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(highlightsByPage)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([page, pageHighlights]) => (
            <div key={page} className="space-y-2">
              <button
                onClick={() => handleJumpToPage(Number(page))}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  currentPage === Number(page)
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                Page {page}
                {currentPage === Number(page) && (
                  <span className="ml-2 text-xs">(current)</span>
                )}
              </button>
              <div className="space-y-2">
                {pageHighlights.map((highlight: Highlight) => (
                  <div
                    key={highlight.id}
                    className="group relative rounded-lg bg-amber-50/50 dark:bg-amber-900/10 p-3 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    <div className="pr-8 text-sm leading-relaxed">{highlight.text}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(highlight.id)}
                      className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete highlight"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(highlight.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
