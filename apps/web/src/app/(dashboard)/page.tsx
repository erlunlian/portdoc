"use client";

import { DocumentCard } from "@/components/documents/document-card";
import { FileUploader } from "@/components/documents/file-uploader";
import { apiClient } from "@/lib/api/client";
import type { Document } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function DashboardPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery<{
    documents: Document[];
    total: number;
  }>({
    queryKey: ["documents", filter],
    queryFn: () => apiClient.getDocuments(filter) as Promise<{
      documents: Document[];
      total: number;
    }>,
  });

  const documents = data?.documents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <FileUploader onUploadComplete={() => refetch()} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter(undefined)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            filter === undefined
              ? "bg-primary text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("ready")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            filter === "ready"
              ? "bg-primary text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Ready
        </button>
        <button
          onClick={() => setFilter("processing")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            filter === "processing"
              ? "bg-primary text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Processing
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">
            No documents yet. Upload a PDF to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

