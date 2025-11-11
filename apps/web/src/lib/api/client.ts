import { createClient } from "@/lib/supabase/client";
import type { UploadURLResponse } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

export class APIClient {
  private async getAuthToken(): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    if (!session) {
      return null;
    }

    return session.access_token || null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      throw new Error("Authentication required. Please log in.");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        const supabase = createClient();
        // Try to refresh the session
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          // Redirect to login
          if (typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
          throw new Error("Session expired. Please log in again.");
        }

        // Retry the request with the new token
        headers["Authorization"] = `Bearer ${refreshedSession.access_token}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ detail: "Request failed" }));
          throw new Error(error.detail || `HTTP ${retryResponse.status}`);
        }

        if (retryResponse.status === 204) {
          return {} as T;
        }

        return retryResponse.json();
      }

      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      throw new Error("Authentication required. Please log in.");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        const supabase = createClient();
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          if (typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
          throw new Error("Session expired. Please log in again.");
        }

        // Retry the request with the new token
        headers["Authorization"] = `Bearer ${refreshedSession.access_token}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ detail: "Request failed" }));
          throw new Error(error.detail || `HTTP ${retryResponse.status}`);
        }

        return retryResponse.json();
      }

      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Documents
  async uploadDocument(file: File, title?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (title) {
      formData.append("title", title);
    }
    return this.uploadFile<UploadURLResponse>("/documents/upload", formData);
  }

  async getDocuments(statusFilter?: string) {
    const params = statusFilter ? `?status_filter=${statusFilter}` : "";
    return this.request(`/documents${params}`);
  }

  async getDocument(id: string) {
    return this.request(`/documents/${id}`);
  }

  async ingestDocument(id: string) {
    return this.request(`/documents/${id}/ingest`, { method: "POST" });
  }

  async getReadState(documentId: string) {
    return this.request(`/documents/${documentId}/read-state`);
  }

  async updateReadState(
    documentId: string,
    lastPage: number,
    scale: number | null | undefined,
    isRead: boolean
  ) {
    return this.request(`/documents/${documentId}/read-state`, {
      method: "PUT",
      body: JSON.stringify({
        last_page: lastPage,
        scale: scale,
        is_read: isRead,
      }),
    });
  }

  async deleteDocument(documentId: string) {
    return this.request(`/documents/${documentId}`, { method: "DELETE" });
  }

  // Highlights
  async getHighlights(documentId: string) {
    return this.request(`/documents/${documentId}/highlights`);
  }

  async createHighlight(documentId: string, data: any) {
    return this.request(`/documents/${documentId}/highlights`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteHighlight(highlightId: string) {
    return this.request(`/highlights/${highlightId}`, { method: "DELETE" });
  }

  // Threads
  async createThread(documentId: string, title?: string) {
    return this.request("/threads", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, title }),
    });
  }

  async getThreads(documentId?: string) {
    const params = documentId ? `?document_id=${documentId}` : "";
    return this.request(`/threads${params}`);
  }

  async getMessages(threadId: string) {
    return this.request(`/threads/${threadId}/messages`);
  }

  async updateThread(threadId: string, title: string) {
    return this.request(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  async deleteThread(threadId: string) {
    return this.request(`/threads/${threadId}`, { method: "DELETE" });
  }

  async startChat(documentId: string, query: string, pageContext?: number) {
    const params = new URLSearchParams({
      document_id: documentId,
      query: query,
    });
    if (pageContext) {
      params.append("page_context", pageContext.toString());
    }

    // This returns a streaming response, so we'll handle it differently
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/threads/start-chat?${params}`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response;
  }

  // Search
  async search(documentId: string, query: string, k: number = 8) {
    return this.request("/search", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, query, k }),
    });
  }
}

export const apiClient = new APIClient();
