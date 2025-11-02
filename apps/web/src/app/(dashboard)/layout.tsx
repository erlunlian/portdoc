"use client";

import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchCommand, setShowSearchCommand] = useState(false);
  const [deleteDialogDoc, setDeleteDialogDoc] = useState<Document | null>(null);

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

  const { data, isLoading } = useQuery<{
    documents: Document[];
    total: number;
  }>({
    queryKey: ["documents"],
    queryFn: () =>
      apiClient.getDocuments() as Promise<{
        documents: Document[];
        total: number;
      }>,
  });

  const documents = data?.documents || [];

  const selectedDocId = pathname.startsWith("/doc/") ? pathname.split("/")[2] : null;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - PDF List */}
      <aside
        className={`${isCollapsed ? "w-16" : "w-64"} relative flex flex-col border-r border-gray-200 bg-white transition-all duration-300`}
      >
        {/* Header */}
        <div className="p-2">
          <div className="mb-2 flex items-center justify-between px-2 pt-2">
            <button
              onClick={() => router.push("/")}
              className={`flex items-center gap-2 rounded-lg transition-colors hover:bg-gray-100 ${
                isCollapsed ? "p-1.5" : "p-1"
              }`}
              title="Go to homepage"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                P
              </div>
              {!isCollapsed && <span className="text-sm font-semibold">PortDoc</span>}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          </div>

          {/* New Document Button */}
          <button
            onClick={() => router.push("/")}
            className={`mb-1 flex w-full items-center ${isCollapsed ? "justify-center p-2" : "justify-start px-3 py-2"} gap-2 rounded-lg transition-colors hover:bg-gray-100`}
            title="Upload new PDF"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
            {!isCollapsed && <span className="text-sm">New document</span>}
          </button>

          {/* Search Button */}
          <button
            onClick={() => setShowSearchCommand(true)}
            className={`flex w-full items-center ${isCollapsed ? "justify-center p-2" : "justify-start px-3 py-2"} gap-2 rounded-lg transition-colors hover:bg-gray-100`}
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
            {!isCollapsed && <span className="text-sm">Search documents</span>}
          </button>
        </div>

        {/* PDF List */}
        <div className="flex-1 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Documents
              </h3>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-1 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">No PDFs uploaded yet</div>
          ) : (
            <div className={`${isCollapsed ? "hidden" : "px-2"}`}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`group relative flex w-full items-center rounded-lg transition-colors hover:bg-gray-100 ${
                    selectedDocId === doc.id ? "bg-gray-100" : ""
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
                        className="mr-2 flex-shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
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
          )}
        </div>

        {/* Profile Section at Bottom */}
        <div className="border-t border-gray-200 p-2">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`flex w-full items-center ${isCollapsed ? "justify-center p-2" : "justify-start px-3 py-2"} gap-3 rounded-lg transition-colors hover:bg-gray-100`}
              title="Profile menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-medium text-white">
                e
              </div>
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">erlun lian</div>
                </div>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div
                className={`absolute bottom-full mb-1 ${isCollapsed ? "left-full ml-2" : "left-2 right-2"} rounded-lg border border-gray-200 bg-white py-1 shadow-lg`}
              >
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Command Palette for Search */}
      <CommandDialog open={showSearchCommand} onOpenChange={setShowSearchCommand}>
        <CommandInput placeholder="Search PDFs..." />
        <CommandList>
          <CommandEmpty>No PDFs found.</CommandEmpty>
          <CommandGroup heading="Documents">
            {documents.map((doc) => (
              <CommandItem
                key={doc.id}
                onSelect={() => {
                  router.push(`/doc/${doc.id}`);
                  setShowSearchCommand(false);
                }}
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>{doc.title}</span>
                {doc.status === "processing" && (
                  <span className="ml-auto text-xs text-gray-400">Processing...</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>

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
    </div>
  );
}
