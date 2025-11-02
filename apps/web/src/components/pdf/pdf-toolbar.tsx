"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const handleFitToWidth = () => {
    // Calculate scale to fit width (approximate)
    const containerWidth = window.innerWidth * 0.6; // Assuming PDF takes ~60% of screen
    const defaultPageWidth = 612; // Default PDF page width in points
    const newScale = containerWidth / defaultPageWidth;
    onZoomChange(Math.min(2, Math.max(0.5, newScale)));
  };

  const handleFitToPage = () => {
    // Reset to default zoom
    onZoomChange(1);
  };

  // Update page input when currentPage changes externally
  if (pageInput !== currentPage.toString() && document.activeElement?.id !== "page-input") {
    setPageInput(currentPage.toString());
  }

  return (
    <div className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
      {/* Page Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePreviousPage}
          disabled={currentPage <= 1}
          className={cn(
            "rounded-xl p-2 transition-colors",
            currentPage <= 1
              ? "cursor-not-allowed text-gray-300"
              : "hover:bg-gray-100 text-gray-600"
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
              : "hover:bg-gray-100 text-gray-600"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onZoomOut}
          disabled={scale <= 0.5}
          className={cn(
            "rounded-xl p-2 transition-colors",
            scale <= 0.5
              ? "cursor-not-allowed text-gray-300"
              : "hover:bg-gray-100 text-gray-600"
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
          disabled={scale >= 2}
          className={cn(
            "rounded-xl p-2 transition-colors",
            scale >= 2
              ? "cursor-not-allowed text-gray-300"
              : "hover:bg-gray-100 text-gray-600"
          )}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        <div className="ml-2 h-6 w-px bg-gray-300" />

        <button
          onClick={handleFitToWidth}
          className="rounded-xl p-2 text-gray-600 transition-colors hover:bg-gray-100"
          aria-label="Fit to width"
          title="Fit to width"
        >
          <Maximize2 className="h-5 w-5" />
        </button>

        <button
          onClick={handleFitToPage}
          className="rounded-xl p-2 text-gray-600 transition-colors hover:bg-gray-100"
          aria-label="Fit to page"
          title="Fit to page"
        >
          <FileText className="h-5 w-5" />
        </button>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="text-xs text-gray-400">
        <span>Ctrl/⌘ + to zoom</span>
      </div>
    </div>
  );
}