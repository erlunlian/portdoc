"use client";

import { apiClient } from "@/lib/api/client";
import type { Document } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchCommand } from "./components/search-command";
import { Sidebar } from "./components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [showSearchCommand, setShowSearchCommand] = useState(false);


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
    // Refetch every 3 seconds if any document is processing
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.documents?.some(
        (doc: Document) => doc.status === "processing" || doc.status === "uploaded"
      );
      return hasProcessing ? 3000 : false;
    },
  });

  const documents = data?.documents || [];

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        documents={documents}
        isLoading={isLoading}
        onSearchClick={() => setShowSearchCommand(true)}
      />

      {/* Command Palette for Search */}
      <SearchCommand
        open={showSearchCommand}
        onOpenChange={setShowSearchCommand}
        documents={documents}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
