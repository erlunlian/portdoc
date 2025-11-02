"use client";

import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface DocumentCardProps {
  document: any;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const statusColors = {
    uploaded: "bg-blue-100 text-blue-800",
    processing: "bg-yellow-100 text-yellow-800",
    ready: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <Link
      href={`/doc/${document.id}`}
      className="block rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {document.title}
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            statusColors[document.status as keyof typeof statusColors]
          }`}
        >
          {document.status}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">{document.original_filename}</p>

      {document.pages && (
        <p className="mt-1 text-sm text-gray-500">{document.pages} pages</p>
      )}

      <div className="mt-4 text-xs text-gray-400">
        Added {formatDate(document.created_at)}
      </div>
    </Link>
  );
}

