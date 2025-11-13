"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface HighlightOverlayProps {
  documentId: string;
  page: number;
  pageRef: React.RefObject<HTMLDivElement>;
  onSelectionComplete: () => void;
  scale: number;
}

interface Highlight {
  id: string;
  page: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  text: string;
}

export function HighlightOverlay({
  documentId,
  page,
  pageRef,
  onSelectionComplete,
  scale,
}: HighlightOverlayProps) {
  const queryClient = useQueryClient();
  const [flashingHighlightId, setFlashingHighlightId] = useState<string | null>(null);

  // Fetch highlights for this page
  const { data: highlightsData } = useQuery<{
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

  const highlights = highlightsData?.highlights?.filter((h: Highlight) => h.page === page) || [];

  // Delete highlight mutation
  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      return apiClient.deleteHighlight(highlightId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
    },
  });

  const handleDeleteHighlight = (highlightId: string) => {
    if (confirm("Delete this highlight?")) {
      deleteHighlightMutation.mutate(highlightId);
    }
  };

  // Listen for scroll to highlight events
  useEffect(() => {
    const handleScrollToHighlight = (event: CustomEvent<{ highlightId: string; page: number }>) => {
      const { highlightId, page: targetPage } = event.detail;

      // Only handle if this is the correct page
      if (targetPage !== page) return;

      // Flash the highlight
      setFlashingHighlightId(highlightId);

      // Scroll to the highlight element
      setTimeout(() => {
        const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
        if (highlightElement) {
          highlightElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
        }
      }, 100);

      // Remove flash after animation
      setTimeout(() => {
        setFlashingHighlightId(null);
      }, 2000);
    };

    window.addEventListener("scrollToHighlight", handleScrollToHighlight as EventListener);
    return () => {
      window.removeEventListener("scrollToHighlight", handleScrollToHighlight as EventListener);
    };
  }, [page]);

  if (!pageRef.current) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Existing highlights */}
      {highlights.map((highlight: Highlight) => {
        const rect = highlight.rects[0];
        if (!rect) return null;

        // Apply scale to page-relative coordinates
        const scaledRect = {
          x: rect.x * scale,
          y: rect.y * scale,
          width: rect.width * scale,
          height: rect.height * scale,
        };

        const isFlashing = flashingHighlightId === highlight.id;

        return (
          <div
            key={highlight.id}
            data-highlight-id={highlight.id}
            className={`group pointer-events-auto absolute cursor-pointer transition-all ${
              isFlashing ? "animate-pulse" : ""
            }`}
            style={{
              left: `${scaledRect.x}px`,
              top: `${scaledRect.y}px`,
              width: `${scaledRect.width}px`,
              height: `${scaledRect.height}px`,
            }}
          >
            <div
              className={`h-full w-full ${
                isFlashing
                  ? "bg-yellow-400 bg-opacity-60 ring-2 ring-yellow-500 ring-offset-1"
                  : "bg-yellow-300 bg-opacity-30 hover:bg-opacity-50"
              }`}
            />
            <div className="invisible absolute -top-8 left-0 z-10 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
              {highlight.text.substring(0, 30)}...
              <button
                onClick={() => handleDeleteHighlight(highlight.id)}
                className="ml-2 text-red-300 hover:text-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
