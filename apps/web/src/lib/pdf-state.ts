import { apiClient } from "./api/client";
import type { DocumentReadState } from "@/types/api";

export const pdfStateManager = {
  // Get the saved page number for a document
  async getPageNumber(documentId: string): Promise<number | null> {
    try {
      const state = await apiClient.getReadState(documentId) as DocumentReadState;
      return state.last_page || null;
    } catch (error) {
      console.error("Error reading PDF state from API:", error);
      return null;
    }
  },

  // Save the current page number for a document
  async savePageNumber(documentId: string, page: number): Promise<void> {
    try {
      // Get current state to preserve scale
      const currentState = await apiClient.getReadState(documentId) as DocumentReadState;
      await apiClient.updateReadState(documentId, page, currentState.scale, currentState.is_read);
    } catch (error) {
      console.error("Error saving PDF state to API:", error);
    }
  },

  // Get the saved scale/zoom for a document
  async getScale(documentId: string): Promise<number | null> {
    try {
      const state = await apiClient.getReadState(documentId) as DocumentReadState;
      return state.scale || null;
    } catch (error) {
      console.error("Error reading PDF scale from API:", error);
      return null;
    }
  },

  // Save the scale/zoom for a document
  async saveScale(documentId: string, scale: number): Promise<void> {
    try {
      // Get current state to preserve page number
      const currentState = await apiClient.getReadState(documentId) as DocumentReadState;
      await apiClient.updateReadState(documentId, currentState.last_page, scale, currentState.is_read);
    } catch (error) {
      console.error("Error saving PDF scale to API:", error);
    }
  },

  // Save both page and scale at once (more efficient)
  async saveState(documentId: string, page: number, scale?: number): Promise<void> {
    try {
      const currentState = await apiClient.getReadState(documentId) as DocumentReadState;
      await apiClient.updateReadState(
        documentId, 
        page, 
        scale !== undefined ? scale : currentState.scale,
        currentState.is_read
      );
    } catch (error) {
      console.error("Error saving PDF state to API:", error);
    }
  },

  // Clear state for a specific document (not needed with API, but kept for compatibility)
  async clearState(documentId: string): Promise<void> {
    try {
      // Reset to defaults
      await apiClient.updateReadState(documentId, 1, null, false);
    } catch (error) {
      console.error("Error clearing PDF state from API:", error);
    }
  },

  // Clean up old states (no longer needed with database storage)
  cleanupOldStates(): void {
    // No-op - cleanup is handled by the database/backend
  },
};