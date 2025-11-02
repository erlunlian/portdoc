"use client";

import { apiClient } from "@/lib/api/client";
import { useRef, useState } from "react";

interface FileUploaderProps {
  onUploadComplete?: (documentId?: string) => void;
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload document directly to backend
      const title = file.name.replace(/\.pdf$/i, "");
      const uploadData = await apiClient.uploadDocument(file, title);

      onUploadComplete?.(uploadData.document_id);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`bg-primary hover:bg-primary/90 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-white ${
          uploading ? "opacity-50" : ""
        }`}
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
