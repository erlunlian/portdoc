"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Document } from "@/types/api";
import { useRouter } from "next/navigation";

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
}

export function SearchCommand({ open, onOpenChange, documents }: SearchCommandProps) {
  const router = useRouter();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search PDFs..." />
      <CommandList>
        <CommandEmpty>No PDFs found.</CommandEmpty>
        <CommandGroup heading="Documents">
          {documents.map((doc) => (
            <CommandItem
              key={doc.id}
              onSelect={() => {
                router.push(`/doc/${doc.id}`);
                onOpenChange(false);
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
  );
}