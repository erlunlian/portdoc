"use client";

import type { Document } from "@/types/api";

interface DocumentStatusProps {
  document: Document | null;
  isLoading: boolean;
}

export function DocumentStatus({ document, isLoading }: DocumentStatusProps) {
  if (isLoading) {
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

  return null;
}