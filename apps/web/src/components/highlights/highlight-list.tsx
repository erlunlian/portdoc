"use client";

import { apiClient } from "@/lib/api/client";
import type { Highlight } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

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
    return <div className="p-4 text-center text-sm text-gray-500">Loading highlights...</div>;
  }

  if (highlights.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No highlights yet. Select text in the PDF to create a highlight.
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
      <div className="mb-4 text-sm font-semibold">
        {highlights.length} Highlight{highlights.length !== 1 ? "s" : ""}
      </div>

      <div className="space-y-4">
        {Object.entries(highlightsByPage)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([page, pageHighlights]) => (
            <div key={page} className="border-b pb-4 last:border-b-0">
              <button
                onClick={() => handleJumpToPage(Number(page))}
                className="text-primary mb-2 text-sm font-medium hover:underline"
              >
                Page {page}
                {currentPage === Number(page) && (
                  <span className="ml-2 text-xs text-gray-500">(current)</span>
                )}
              </button>
              <div className="space-y-2">
                {pageHighlights.map((highlight: Highlight) => (
                  <div
                    key={highlight.id}
                    className="group relative rounded-xl border bg-yellow-50 p-3"
                  >
                    <div className="text-sm text-gray-800">{highlight.text}</div>
                    <button
                      onClick={() => handleDelete(highlight.id)}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
                      aria-label="Delete highlight"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                    <div className="mt-1 text-xs text-gray-500">
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
