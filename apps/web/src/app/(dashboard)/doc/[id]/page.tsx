"use client";

import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { apiClient } from "@/lib/api/client";
import { debounce } from "@/lib/utils";
import type { Document, DocumentReadState } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentHeader } from "./components/document-header";
import { DocumentStatus } from "./components/document-status";
import { SidePanel } from "./components/side-panel";

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch document with auto-refresh while processing
  const { data: document, isLoading: docLoading } = useQuery<Document>({
    queryKey: ["document", documentId],
    queryFn: () => apiClient.getDocument(documentId) as Promise<Document>,
    // Refetch every 2 seconds while document is processing
    refetchInterval: (query) => {
      const doc = query.state.data;
      if (doc?.status === "processing" || doc?.status === "uploaded") {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling when ready or error
    },
  });

  // Fetch read state
  const { data: readState } = useQuery<DocumentReadState>({
    queryKey: ["read-state", documentId],
    queryFn: () => apiClient.getReadState(documentId) as Promise<DocumentReadState>,
    enabled: !!documentId,
  });

  // Set initial page from read state
  useEffect(() => {
    if (hasInitialized || !readState) return;

    if (readState.last_page) {
      setCurrentPage(readState.last_page);
      setHasInitialized(true);
    }
  }, [readState, hasInitialized]);

  // Get PDF URL from local storage
  useEffect(() => {
    if (!document?.storage_path) return;

    // Construct URL to serve PDF from API
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";
    // We'll need to add an endpoint to serve PDFs
    setPdfUrl(`${apiBaseUrl}/documents/${documentId}/pdf`);
  }, [document, documentId]);

  // Debounced update of read state
  const updateReadState = debounce(async (page: number, scale?: number) => {
    if (!documentId || !readState) return;
    try {
      await apiClient.updateReadState(
        documentId,
        page,
        scale !== undefined ? scale : readState.scale,
        false
      );
    } catch (error) {
      console.error("Failed to update read state:", error);
    }
  }, 1000);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      // Update server state (debounced)
      updateReadState(page);
    },
    [updateReadState]
  );

  // Handle scale change
  const handleScaleChange = useCallback(
    (scale: number) => {
      // Update server state with new scale (debounced)
      updateReadState(currentPage, scale);
    },
    [currentPage, updateReadState]
  );

  // Listen for page jump events from highlight list
  useEffect(() => {
    const handleJumpToPage = (event: CustomEvent<{ page: number }>) => {
      handlePageChange(event.detail.page);
    };

    window.addEventListener("jumpToPage", handleJumpToPage as EventListener);
    return () => {
      window.removeEventListener("jumpToPage", handleJumpToPage as EventListener);
    };
  }, [handlePageChange]);

  // Handle status states
  const statusComponent = <DocumentStatus document={document || null} isLoading={docLoading} />;
  if (docLoading || !document || document.status !== "ready") {
    return statusComponent;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Floating Header Row */}
      <div className="flex-shrink-0 px-6 pb-3 pt-6">
        <DocumentHeader title={document.title} documentId={documentId} />
      </div>

      {/* Main Content - Floating Panels */}
      <div className="relative flex-1 overflow-hidden px-6 pb-6">
        {/* Floating PDF Viewer */}
        <div className="bg-background/95 absolute bottom-6 left-6 right-[448px] top-0 flex justify-center overflow-hidden rounded-3xl shadow-2xl backdrop-blur-xl">
          {pdfUrl ? (
            <PdfViewer
              url={pdfUrl}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              totalPages={document.pages || 1}
              documentId={documentId}
              initialScale={readState?.scale || undefined}
              onScaleChange={handleScaleChange}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-muted-foreground">Loading PDF...</div>
            </div>
          )}
        </div>

        {/* Floating Side Panel */}
        <SidePanel
          documentId={documentId}
          currentPage={currentPage}
          onJumpToPage={(page) => {
            // Trigger programmatic scroll via custom event
            window.dispatchEvent(new CustomEvent("jumpToPageProgrammatic", { detail: { page } }));
            handlePageChange(page);
          }}
        />
      </div>
    </div>
  );
}
