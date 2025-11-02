const PDF_STATE_KEY = "pdf_reader_states";

interface PdfState {
  page: number;
  scale?: number;
  lastUpdated: number;
}

interface PdfStates {
  [documentId: string]: PdfState;
}

export const pdfStateManager = {
  // Get the saved page number for a document
  getPageNumber(documentId: string): number | null {
    if (typeof window === "undefined") return null;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      if (!states) return null;
      
      const parsed: PdfStates = JSON.parse(states);
      const state = parsed[documentId];
      
      // Return the page if it exists and was updated within the last 30 days
      if (state && state.lastUpdated > Date.now() - 30 * 24 * 60 * 60 * 1000) {
        return state.page;
      }
      
      return null;
    } catch (error) {
      console.error("Error reading PDF state from localStorage:", error);
      return null;
    }
  },

  // Save the current page number for a document
  savePageNumber(documentId: string, page: number): void {
    if (typeof window === "undefined") return;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      const parsed: PdfStates = states ? JSON.parse(states) : {};
      
      parsed[documentId] = {
        ...parsed[documentId],
        page,
        lastUpdated: Date.now(),
      };
      
      localStorage.setItem(PDF_STATE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error("Error saving PDF state to localStorage:", error);
    }
  },

  // Get the saved scale/zoom for a document
  getScale(documentId: string): number | null {
    if (typeof window === "undefined") return null;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      if (!states) return null;
      
      const parsed: PdfStates = JSON.parse(states);
      const state = parsed[documentId];
      
      return state?.scale || null;
    } catch (error) {
      console.error("Error reading PDF scale from localStorage:", error);
      return null;
    }
  },

  // Save the scale/zoom for a document
  saveScale(documentId: string, scale: number): void {
    if (typeof window === "undefined") return;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      const parsed: PdfStates = states ? JSON.parse(states) : {};
      
      parsed[documentId] = {
        ...parsed[documentId],
        scale,
        lastUpdated: Date.now(),
      };
      
      localStorage.setItem(PDF_STATE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error("Error saving PDF scale to localStorage:", error);
    }
  },

  // Clear state for a specific document
  clearState(documentId: string): void {
    if (typeof window === "undefined") return;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      if (!states) return;
      
      const parsed: PdfStates = JSON.parse(states);
      delete parsed[documentId];
      
      localStorage.setItem(PDF_STATE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error("Error clearing PDF state from localStorage:", error);
    }
  },

  // Clean up old states (older than 30 days)
  cleanupOldStates(): void {
    if (typeof window === "undefined") return;
    
    try {
      const states = localStorage.getItem(PDF_STATE_KEY);
      if (!states) return;
      
      const parsed: PdfStates = JSON.parse(states);
      const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      
      Object.keys(parsed).forEach(documentId => {
        if (parsed[documentId].lastUpdated < cutoffTime) {
          delete parsed[documentId];
        }
      });
      
      localStorage.setItem(PDF_STATE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error("Error cleaning up PDF states:", error);
    }
  },
};