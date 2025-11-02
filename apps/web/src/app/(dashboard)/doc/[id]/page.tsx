"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { HighlightList } from "@/components/highlights/highlight-list";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { debounce } from "@/lib/utils";
import type { Document, DocumentReadState } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "highlights">("chat");

  // Fetch document
  const { data: document, isLoading: docLoading } = useQuery<Document>({
    queryKey: ["document", documentId],
    queryFn: () => apiClient.getDocument(documentId) as Promise<Document>,
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
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    updateReadState(page);
  }, [updateReadState]);

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
          <div className="text-lg font-semibold">Document Processing</div>
          <div className="mt-2 text-sm text-gray-500">Status: {document.status}</div>
          <div className="mt-4 text-sm text-gray-400">
            Please wait while the document is being processed...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{document.title}</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>{document.pages} pages</span>
              {readState && (
                <span>
                  Page {readState.last_page} of {document.pages}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PDF Viewer - Left */}
        <div className="flex min-w-0 flex-1 overflow-hidden bg-gray-100 justify-center">
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
              <div className="text-gray-500">Loading PDF...</div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex w-96 flex-shrink-0 flex-col overflow-hidden border-l bg-white">
          <div className="flex flex-shrink-0 border-b">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "chat"
                  ? "border-primary text-primary border-b-2"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("highlights")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "highlights"
                  ? "border-primary text-primary border-b-2"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Highlights
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === "chat" ? (
              <ChatPanel documentId={documentId} currentPage={currentPage} />
            ) : (
              <div className="h-full overflow-auto">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
