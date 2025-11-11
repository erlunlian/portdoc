"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (scale: number) => void;
}

const ZOOM_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
  { value: 1.5, label: "150%" },
  { value: 2, label: "200%" },
  { value: 2.5, label: "250%" },
  { value: 3, label: "300%" },
  { value: 4, label: "400%" },
  { value: 5, label: "500%" },
];

export function PdfToolbar({
  currentPage,
  totalPages,
  scale,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onZoomChange,
}: PdfToolbarProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString());

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setPageInput(value);
    }
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputSubmit();
    } else if (e.key === "Escape") {
      setPageInput(currentPage.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      setPageInput((currentPage - 1).toString());
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      setPageInput((currentPage + 1).toString());
    }
  };

  // Update page input when currentPage changes externally
  if (pageInput !== currentPage.toString() && document.activeElement?.id !== "page-input") {
    setPageInput(currentPage.toString());
  }

  return (
    <div className="border-border/50 flex h-14 w-full items-center border-b bg-transparent px-6">
      {/* Left Section: Page Navigation */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={handlePreviousPage}
          disabled={currentPage <= 1}
          className={cn(
            "rounded-xl p-2 transition-colors",
            currentPage <= 1
              ? "cursor-not-allowed text-gray-300"
              : "text-gray-600 hover:bg-gray-100"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <input
            id="page-input"
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputSubmit}
            onKeyDown={handlePageInputKeyDown}
            className="w-12 rounded-xl border px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
          />
          <span className="text-sm text-gray-600">of {totalPages}</span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className={cn(
            "rounded-xl p-2 transition-colors",
            currentPage >= totalPages
              ? "cursor-not-allowed text-gray-300"
              : "text-gray-600 hover:bg-gray-100"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Center Section: Flexible Spacer */}
      <div className="flex-1" />

      {/* Right Section: Zoom Controls and Shortcuts */}
      <div className="flex flex-shrink-0 items-center gap-4">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomOut}
            disabled={scale <= 0.5}
            className={cn(
              "rounded-xl p-2 transition-colors",
              scale <= 0.5 ? "cursor-not-allowed text-gray-300" : "text-gray-600 hover:bg-gray-100"
            )}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <select
            value={scale}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="rounded-xl border px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
          >
            {ZOOM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={onZoomIn}
            disabled={scale >= 5}
            className={cn(
              "rounded-xl p-2 transition-colors",
              scale >= 5 ? "cursor-not-allowed text-gray-300" : "text-gray-600 hover:bg-gray-100"
            )}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="text-xs text-gray-400">
          <span>Ctrl/⌘ + to zoom</span>
        </div>
      </div>
    </div>
  );
}
