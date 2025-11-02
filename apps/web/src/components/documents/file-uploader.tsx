"use client";

import { apiClient } from "@/lib/api/client";
import type { UploadURLResponse } from "@/types/api";
import { useRef, useState } from "react";

interface FileUploaderProps {
  onUploadComplete?: () => void;
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
      // Get upload URL from API
      const title = file.name.replace(/\.pdf$/i, "");
      const uploadData = (await apiClient.createUploadURL(title, file.name)) as UploadURLResponse;

      // Upload file to Supabase Storage using signed URL
      const supabase = await import("@/lib/supabase/client").then((m) => m.createClient());
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(uploadData.storage_path, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Trigger ingestion
      await apiClient.ingestDocument(uploadData.document_id);

      onUploadComplete?.();
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
        className={`bg-primary hover:bg-primary/90 cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-white ${
          uploading ? "opacity-50" : ""
        }`}
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
