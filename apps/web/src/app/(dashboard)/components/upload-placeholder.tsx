"use client";

import { apiClient } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function UploadPlaceholder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      return;
    }

    setUploading(true);

    try {
      // Upload document directly to backend
      const title = file.name.replace(/\.pdf$/i, "");
      const uploadData = await apiClient.uploadDocument(file, title);

      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["documents"] });

      // Navigate to the document page
      router.push(`/doc/${uploadData.document_id}`);
    } catch (err: any) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="h-full p-6">
      <div className="bg-background/95 flex h-full w-full items-center justify-center rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="max-w-md text-center">
          <div className="mb-8">
            <svg
              className="text-muted-foreground/50 mx-auto mb-4 h-24 w-24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h2 className="mb-2 text-2xl font-bold">Upload a PDF to get started</h2>
            <p className="text-muted-foreground">
              Select a document from the sidebar or upload a new one
            </p>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-3 font-semibold shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Choose PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
