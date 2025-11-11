"use client";

import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/types/api";
import { MoreVertical, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SidebarProps {
  documents: Document[];
  isLoading: boolean;
  onSearchClick: () => void;
}

export function Sidebar({ documents, isLoading, onSearchClick }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deleteDialogDoc, setDeleteDialogDoc] = useState<Document | null>(null);

  const selectedDocId = pathname.startsWith("/doc/") ? pathname.split("/")[2] : null;

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    if (savedState) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  return (
    <>
      <aside
        className={`${isCollapsed ? "w-12" : "w-60"} relative flex flex-col transition-all duration-300`}
      >
        <div className="bg-background/95 my-6 flex flex-1 flex-col overflow-hidden rounded-r-3xl shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="p-2">
            <div
              className={`mb-2 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} pt-2`}
            >
              <button
                onClick={() => (isCollapsed ? setIsCollapsed(false) : router.push("/"))}
                className={`hover:bg-muted group relative flex items-center rounded-xl transition-colors ${isCollapsed ? "justify-center p-1.5" : "gap-2 px-3 py-1.5"}`}
                title={isCollapsed ? "Expand sidebar" : "Go to homepage"}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white transition-opacity ${
                    isCollapsed ? "group-hover:opacity-0 " : ""
                  }`}
                >
                  P
                </div>
                {isCollapsed && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                      />
                    </svg>
                  </div>
                )}
                <span
                  className={`text-sm font-semibold transition-all duration-300 ${isCollapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100 delay-150"}`}
                >
                  PortDoc
                </span>
              </button>
              {!isCollapsed && (
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hover:bg-muted rounded-xl p-1.5 transition-colors"
                  title="Collapse sidebar"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* New Document Button */}
            <button
              onClick={() => router.push("/")}
              className={`mb-1 flex w-full items-center ${isCollapsed ? "justify-center px-2 py-2" : "justify-start px-3 py-2"} hover:bg-muted gap-2 rounded-xl transition-colors`}
              title="Upload new PDF"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span
                className={`text-sm transition-all duration-300 ${isCollapsed ? "absolute w-0 overflow-hidden opacity-0" : "opacity-100 delay-150"}`}
              >
                New document
              </span>
            </button>

            {/* Search Button */}
            <button
              onClick={onSearchClick}
              className={`flex w-full items-center ${isCollapsed ? "justify-center px-2 py-2" : "justify-start px-3 py-2"} hover:bg-muted gap-2 rounded-xl transition-colors`}
              title="Search documents"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <span
                className={`text-sm transition-all duration-300 ${isCollapsed ? "absolute w-0 overflow-hidden opacity-0" : "opacity-100 delay-150"}`}
              >
                Search documents
              </span>
            </button>
          </div>

          {/* PDF List */}
          <div className="flex-1 overflow-y-auto">
            <div
              className={`px-4 py-2 transition-all duration-300 ${isCollapsed ? "h-0 overflow-hidden opacity-0" : "opacity-100 delay-150"}`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Documents
              </h3>
            </div>
            {isLoading ? (
              <div className="space-y-1 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-muted h-8 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">No PDFs uploaded yet</div>
            ) : !isCollapsed ? (
              <div className="px-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`hover:bg-muted group relative flex w-full items-center rounded-xl transition-colors ${
                      selectedDocId === doc.id ? "bg-muted" : ""
                    }`}
                  >
                    <button
                      onClick={() => router.push(`/doc/${doc.id}`)}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                    >
                      <div className="truncate pr-2">{doc.title}</div>
                      {doc.status === "processing" && (
                        <div className="mt-0.5 text-xs text-gray-400">Processing...</div>
                      )}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="hover:bg-muted/50 mr-2 flex-shrink-0 rounded-xl p-1 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setDeleteDialogDoc(doc);
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Delete Document Dialog */}
      {deleteDialogDoc && (
        <DeleteDocumentDialog
          documentId={deleteDialogDoc.id}
          documentTitle={deleteDialogDoc.title}
          isCurrentDocument={selectedDocId === deleteDialogDoc.id}
          open={!!deleteDialogDoc}
          onOpenChange={(open) => {
            if (!open) setDeleteDialogDoc(null);
          }}
          onDelete={() => setDeleteDialogDoc(null)}
        />
      )}
    </>
  );
}
