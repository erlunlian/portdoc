"use client";

import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
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
    if (readState?.last_page) {
      setCurrentPage(readState.last_page);
    }
  }, [readState]);

  // Get PDF URL from Supabase Storage
  useEffect(() => {
    async function getPdfUrl() {
      if (!document?.storage_path) return;

      const supabase = createClient();
      const { data } = await supabase.storage
        .from("pdfs")
        .createSignedUrl(document.storage_path, 3600);

      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    }

    getPdfUrl();
  }, [document]);

  // Debounced update of read state
  const updateReadState = debounce(async (page: number) => {
    if (!documentId) return;
    try {
      await apiClient.updateReadState(documentId, page, false);
    } catch (error) {
      console.error("Failed to update read state:", error);
    }
  }, 1000);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      updateReadState(page);
    },
    [updateReadState]
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
      {/* Header */}
      <DocumentHeader title={document.title} />

      {/* Main Content with Resizable Panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* PDF Viewer Panel */}
        <ResizablePanel defaultSize={70} minSize={50} maxSize={80}>
          <div className="bg-foreground/30 flex h-full justify-center overflow-hidden">
            {pdfUrl ? (
              <PdfViewer
                url={pdfUrl}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                totalPages={document.pages || 1}
                documentId={documentId}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading PDF...</div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle className="bg-border hover:bg-primary/20 transition-colors" />

        {/* Right Sidebar Panel */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <SidePanel
            documentId={documentId}
            currentPage={currentPage}
            onJumpToPage={(page) => {
              // Trigger programmatic scroll via custom event
              window.dispatchEvent(
                new CustomEvent("jumpToPageProgrammatic", { detail: { page } })
              );
              handlePageChange(page);
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
