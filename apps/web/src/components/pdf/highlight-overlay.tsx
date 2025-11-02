"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface HighlightOverlayProps {
  documentId: string;
  page: number;
  pageRef: React.RefObject<HTMLDivElement>;
  isSelecting: boolean;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
  onSelectionComplete: () => void;
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
  isSelecting,
  selectionRect,
  onSelectionComplete,
}: HighlightOverlayProps) {
  const [selectedText, setSelectedText] = useState("");
  const queryClient = useQueryClient();

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

  // Create highlight mutation
  const createHighlightMutation = useMutation({
    mutationFn: async (data: {
      page: number;
      rects: Array<{ x: number; y: number; width: number; height: number }>;
      text: string;
    }) => {
      return apiClient.createHighlight(documentId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
      onSelectionComplete();
      setSelectedText("");
    },
  });

  // Delete highlight mutation
  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      return apiClient.deleteHighlight(highlightId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", documentId] });
    },
  });

  // Get selected text when selection completes
  useEffect(() => {
    if (!isSelecting && selectionRect && selectionRect.width > 10 && selectionRect.height > 10) {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        setSelectedText(selection.toString().trim());
      }
    }
  }, [isSelecting, selectionRect]);

  const handleSaveHighlight = () => {
    if (!selectionRect || !selectedText.trim()) return;

    createHighlightMutation.mutate({
      page,
      rects: [selectionRect],
      text: selectedText,
    });
  };

  const handleDeleteHighlight = (highlightId: string) => {
    if (confirm("Delete this highlight?")) {
      deleteHighlightMutation.mutate(highlightId);
    }
  };

  if (!pageRef.current) return null;

  return (
    <>
      {/* Selection rectangle */}
      {isSelecting && selectionRect && (
        <div
          className="pointer-events-none absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30"
          style={{
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
          }}
        />
      )}

      {/* Save highlight popup */}
      {!isSelecting && selectionRect && selectedText && (
        <div
          className="absolute z-10 rounded-md border bg-white p-2 shadow-lg"
          style={{
            left: `${selectionRect.x + selectionRect.width / 2}px`,
            top: `${selectionRect.y - 40}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="mb-2 text-sm">{selectedText.substring(0, 50)}...</div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveHighlight}
              className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => {
                setSelectedText("");
                onSelectionComplete();
              }}
              className="rounded bg-gray-200 px-3 py-1 text-xs hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing highlights */}
      {highlights.map((highlight: Highlight) => (
        <div
          key={highlight.id}
          className="group absolute cursor-pointer"
          style={{
            left: `${highlight.rects[0]?.x || 0}px`,
            top: `${highlight.rects[0]?.y || 0}px`,
            width: `${highlight.rects[0]?.width || 0}px`,
            height: `${highlight.rects[0]?.height || 0}px`,
          }}
        >
          <div className="h-full w-full bg-yellow-300 bg-opacity-30 hover:bg-opacity-50" />
          <div className="invisible absolute -top-8 left-0 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
            {highlight.text.substring(0, 30)}...
            <button
              onClick={() => handleDeleteHighlight(highlight.id)}
              className="ml-2 text-red-300 hover:text-red-100"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
