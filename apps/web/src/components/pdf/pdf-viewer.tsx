"use client";

import { cn, debounce } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { HighlightOverlay } from "./highlight-overlay";
import { PdfContextMenu } from "./pdf-context-menu";
import { PdfToolbar } from "./pdf-toolbar";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  documentId: string;
  initialScale?: number;
  onScaleChange?: (scale: number) => void;
}

interface Selection {
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  pageRelativeRect: { x: number; y: number; width: number; height: number };
  pageNumber: number;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
const DEFAULT_ZOOM = 1.5;

export function PdfViewer({
  url,
  currentPage,
  onPageChange,
  totalPages,
  documentId,
  initialScale,
  onScaleChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(totalPages);
  const [pageNumber, setPageNumber] = useState<number>(currentPage);
  // Initialize scale from props or default
  const [scale, setScale] = useState<number>(initialScale || DEFAULT_ZOOM);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isProgrammaticScroll = useRef(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to specific page
  const scrollToPage = useCallback((page: number) => {
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      const pageElement = pageRefs.current.get(page);
      if (pageElement && containerRef.current) {
        // Set flag to prevent scroll detection from interfering
        isProgrammaticScroll.current = true;

        // Get the page position relative to the document container
        const pageRect = pageElement.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate the scroll position
        // We need to add current scroll position and subtract container top
        const scrollPosition = containerRef.current.scrollTop + (pageRect.top - containerRect.top);

        containerRef.current.scrollTo({
          top: scrollPosition,
          behavior: "smooth",
        });

        // Reset flag after scroll completes
        setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 500);
      }
    }, 100);
  }, []);

  // Load PDF document
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setRenderError(null);
    // Scroll to initial page after document loads
    if (currentPage > 1) {
      setTimeout(() => scrollToPage(currentPage), 200);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setRenderError(error);
  };

  // Handle page changes
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= numPages) {
        setPageNumber(newPage);
        onPageChange(newPage);
        // Scroll to the new page when changed via toolbar
        scrollToPage(newPage);
      }
    },
    [numPages, onPageChange, scrollToPage]
  );

  // Handle scroll events to detect current page
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isProgrammaticScroll.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const centerY = scrollTop + containerHeight / 2;

    // Find which page is at the center of the viewport
    let currentPageInView = 1;
    pageRefs.current.forEach((pageElement, pageNum) => {
      const pageTop = pageElement.offsetTop - container.offsetTop;
      const pageBottom = pageTop + pageElement.clientHeight;

      if (centerY >= pageTop && centerY <= pageBottom) {
        currentPageInView = pageNum;
      }
    });

    if (currentPageInView !== pageNumber) {
      // Only update page number, don't trigger scroll
      setPageNumber(currentPageInView);
      onPageChange(currentPageInView);
    }
  }, [pageNumber, onPageChange]);

  // Debounced scroll handler
  const debouncedHandleScroll = debounce(handleScroll, 100);

  // Listen for jump to page events
  useEffect(() => {
    const handleJumpToPage = (event: CustomEvent<{ page: number }>) => {
      scrollToPage(event.detail.page);
      handlePageChange(event.detail.page);
    };

    const handleProgrammaticJump = (event: CustomEvent<{ page: number }>) => {
      scrollToPage(event.detail.page);
    };

    const handleScrollToPage = (event: CustomEvent<{ page: number }>) => {
      scrollToPage(event.detail.page);
      handlePageChange(event.detail.page);
    };

    window.addEventListener("jumpToPage", handleJumpToPage as EventListener);
    window.addEventListener("jumpToPageProgrammatic", handleProgrammaticJump as EventListener);
    window.addEventListener("scrollToPage", handleScrollToPage as EventListener);

    return () => {
      window.removeEventListener("jumpToPage", handleJumpToPage as EventListener);
      window.removeEventListener("jumpToPageProgrammatic", handleProgrammaticJump as EventListener);
      window.removeEventListener("scrollToPage", handleScrollToPage as EventListener);
    };
  }, [scrollToPage, handlePageChange]);

  // Update page when prop changes
  useEffect(() => {
    if (currentPage !== pageNumber) {
      setPageNumber(currentPage);
      scrollToPage(currentPage);
    }
  }, [currentPage, pageNumber, scrollToPage]);

  // Handle zoom
  const handleZoom = useCallback(
    (newScale: number) => {
      setScale(newScale);
      // Notify parent of scale change
      onScaleChange?.(newScale);
    },
    [onScaleChange]
  );

  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level === scale);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newScale = ZOOM_LEVELS[currentIndex + 1];
      setScale(newScale);
      onScaleChange?.(newScale);
    }
  }, [scale, onScaleChange]);

  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level === scale);
    if (currentIndex > 0) {
      const newScale = ZOOM_LEVELS[currentIndex - 1];
      setScale(newScale);
      onScaleChange?.(newScale);
    }
  }, [scale, onScaleChange]);

  // Handle text selection
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        const windowSelection = window.getSelection();
        if (windowSelection && windowSelection.toString().trim()) {
          // Find which page the selection is on
          const target = e.target as HTMLElement;
          const pageElement = target.closest("[data-page-number]");
          const pageNum = pageElement
            ? parseInt(pageElement.getAttribute("data-page-number") || "1")
            : pageNumber;

          // Get the bounding rect of the selection for positioning the context menu
          const range = windowSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Convert viewport coordinates to page-relative coordinates
          let pageRelativeRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

          if (pageElement) {
            const pageRect = pageElement.getBoundingClientRect();
            pageRelativeRect = {
              x: (rect.x - pageRect.x) / scale,
              y: (rect.y - pageRect.y) / scale,
              width: rect.width / scale,
              height: rect.height / scale,
            };
          }

          setSelection({
            text: windowSelection.toString().trim(),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            pageRelativeRect,
            pageNumber: pageNum,
          });
        }
      }, 10);
    },
    [pageNumber, scale]
  );

  const handleSelectionClear = () => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await fullscreenContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          handleZoom(DEFAULT_ZOOM);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scale, zoomIn, zoomOut, handleZoom]);

  if (renderError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error loading PDF</p>
          <p className="mt-2 text-sm text-gray-500">{renderError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={fullscreenContainerRef}
      className="bg-background flex h-full w-full flex-col overflow-hidden rounded-3xl border border-gray-300 shadow-2xl"
    >
      {/* Toolbar */}
      <PdfToolbar
        currentPage={pageNumber}
        totalPages={numPages}
        scale={scale}
        onPageChange={handlePageChange}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomChange={handleZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* PDF Document Container */}
      <div
        ref={containerRef}
        className="flex flex-1 justify-center overflow-auto"
        onScroll={debouncedHandleScroll}
      >
        <div ref={documentRef} className="flex w-full flex-col items-center py-8">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            className="flex flex-col items-center gap-8"
          >
            {Array.from(new Array(numPages), (_, index) => (
              <div
                key={`page_${index + 1}`}
                ref={(el) => {
                  if (el) pageRefs.current.set(index + 1, el);
                }}
                data-page-number={index + 1}
                className="relative shadow-lg"
                onMouseUp={handleMouseUp}
              >
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className={cn(
                    "bg-white",
                    index + 1 === pageNumber && "ring-2 ring-blue-500 ring-offset-2"
                  )}
                />

                {/* Highlight Overlay for this page */}
                <HighlightOverlay
                  documentId={documentId}
                  page={index + 1}
                  pageRef={
                    pageRefs.current.get(index + 1)
                      ? { current: pageRefs.current.get(index + 1) || null }
                      : { current: null }
                  }
                  onSelectionComplete={handleSelectionClear}
                  scale={scale}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      {/* Context Menu for selected text */}
      {selection && (
        <PdfContextMenu
          selection={selection}
          documentId={documentId}
          onClose={handleSelectionClear}
          scale={scale}
        />
      )}
    </div>
  );
}
