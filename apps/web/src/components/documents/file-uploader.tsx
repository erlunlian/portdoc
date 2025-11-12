"use client";

import { apiClient } from "@/lib/api/client";
import { useEffect, useRef, useState } from "react";

interface FileUploaderProps {
  onUploadComplete?: (documentId?: string) => void;
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arxivUrl, setArxivUrl] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect wifi/internet connectivity
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Set initial status
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

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

  const handleArxivSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!arxivUrl.trim()) {
      setError("Please enter an arXiv URL");
      return;
    }

    if (!isOnline) {
      setError("Cannot download from arXiv while offline");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadData = await apiClient.uploadArxivDocument(arxivUrl);
      setArxivUrl("");
      onUploadComplete?.(uploadData.document_id);
    } catch (err: any) {
      setError(err.message || "Failed to download from arXiv");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File upload section */}
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
          className={`bg-primary hover:bg-primary/90 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-white inline-block ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </label>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* ArXiv URL section */}
      <form onSubmit={handleArxivSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={arxivUrl}
            onChange={(e) => setArxivUrl(e.target.value)}
            placeholder="Paste arXiv URL (e.g., https://arxiv.org/abs/2301.07041)"
            disabled={!isOnline || uploading}
            className={`flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              !isOnline || uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          <button
            type="submit"
            disabled={!isOnline || uploading || !arxivUrl.trim()}
            className={`bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white ${
              !isOnline || uploading || !arxivUrl.trim()
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            {uploading ? "Downloading..." : "Download"}
          </button>
        </div>
        {!isOnline && (
          <p className="text-sm text-amber-600">
            ⚠️ Internet connection required to download from arXiv
          </p>
        )}
      </form>

      {/* Error message */}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
