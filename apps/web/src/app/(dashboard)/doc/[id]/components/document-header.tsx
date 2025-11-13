"use client";

import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

interface DocumentHeaderProps {
  title: string;
  documentId: string;
}

export function DocumentHeader({ title, documentId }: DocumentHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!editedTitle.trim() || editedTitle === title || isSaving) {
      setEditedTitle(title);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateDocument(documentId, editedTitle.trim());
      // Invalidate the document query to refetch with new title
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      // Also invalidate the documents list to update the sidebar
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update document title:", error);
      setEditedTitle(title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-background/95 w-full rounded-full border border-gray-300 px-6 py-3 shadow-2xl backdrop-blur-xl">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className={cn(
              "w-full bg-transparent text-base font-semibold outline-none",
              isSaving && "opacity-50"
            )}
            placeholder="Document title"
          />
        ) : (
          <h1
            onClick={() => setIsEditing(true)}
            className="hover:text-primary/80 cursor-text truncate text-base font-semibold transition-colors"
            title="Click to edit"
          >
            {title}
          </h1>
        )}
      </div>
    </div>
  );
}
