"use client";

import { apiClient } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function UploadPlaceholder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arxivUrl, setArxivUrl] = useState("");
  const [isOnline, setIsOnline] = useState(true);

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

      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["documents"] });

      // Navigate to the document page
      router.push(`/doc/${uploadData.document_id}`);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      console.error("Upload failed:", err);
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

      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["documents"] });

      setArxivUrl("");

      // Navigate to the document page
      router.push(`/doc/${uploadData.document_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to download from arXiv");
      console.error("ArXiv upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full p-6">
      <div className="bg-background/95 flex h-full w-full items-center justify-center rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="max-w-2xl text-center">
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="border-muted-foreground/20 w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">Or</span>
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
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isOnline || uploading || !arxivUrl.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
