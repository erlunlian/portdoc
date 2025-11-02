"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { HighlightList } from "@/components/highlights/highlight-list";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { cn, debounce } from "@/lib/utils";
import type { Document, DocumentReadState } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { Highlighter, MessageSquare } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "highlights">("chat");

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

  if (docLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-600">Document not found</div>
      </div>
    );
  }

  if (document.status !== "ready") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">
            {document.status === "error" ? "Processing Failed" : "Document Processing"}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Status: {document.status === "uploaded" ? "Starting processing..." : document.status}
          </div>
          {document.status === "processing" || document.status === "uploaded" ? (
            <>
              <div className="mt-4">
                <svg
                  className="mx-auto h-8 w-8 animate-spin text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <div className="mt-4 text-sm text-gray-400">
                Extracting text and generating embeddings...
              </div>
            </>
          ) : document.status === "error" ? (
            <div className="mt-4 text-sm text-red-500">
              There was an error processing this document. Please try uploading it again.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className=" flex-shrink-0 border-b px-6 py-2">
        <h1 className="text-base font-medium">{document.title}</h1>
      </div>

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
          <div className="flex h-full flex-col overflow-hidden">
            {/* Icon Toggle Header */}
            <div className="bg-background flex items-center justify-between px-4 pt-2">
              <h3 className="text-foreground text-base font-semibold">
                {activeView === "chat" ? "Chat" : "Highlights"}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant={activeView === "chat" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setActiveView("chat")}
                  className={cn(
                    "h-8 w-8 rounded-full",
                    activeView === "chat" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  title="Chat"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeView === "highlights" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setActiveView("highlights")}
                  className={cn(
                    "h-8 w-8 rounded-full",
                    activeView === "highlights"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  title="Highlights"
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content with transition */}
            <div className="relative flex-1 overflow-hidden">
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-200",
                  activeView === "chat" ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                <ChatPanel documentId={documentId} currentPage={currentPage} />
              </div>
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-200",
                  activeView === "highlights" ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                <HighlightList
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
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
