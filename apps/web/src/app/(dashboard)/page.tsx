"use client";

import { FileUploader } from "@/components/documents/file-uploader";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  const handleUploadComplete = (documentId?: string) => {
    if (documentId) {
      router.push(`/doc/${documentId}`);
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-white">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <svg className="h-24 w-24 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h2 className="text-2xl font-bold text-black mb-2">
            Upload a PDF to get started
          </h2>
          <p className="text-gray-600">
            Select a document from the sidebar or upload a new one
          </p>
        </div>
        <FileUploader onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  );
}

