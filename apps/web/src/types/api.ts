// API Response Types
export interface Document {
  id: string;
  owner_id: string;
  title: string;
  original_filename: string;
  storage_path: string;
  pages: number | null;
  size_bytes: number | null;
  status: "uploaded" | "processing" | "ready" | "error";
  created_at: string;
  updated_at: string;
}

export interface DocumentReadState {
  id: string;
  user_id: string;
  document_id: string;
  last_page: number;
  is_read: boolean;
  updated_at: string;
}

export interface UploadURLResponse {
  document_id: string;
  upload_url: string;
  storage_path: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  document_id: string;
  page: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  text: string;
  created_at: string;
}

export interface Thread {
  id: string;
  user_id: string;
  document_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  metadata: {
    pages?: number[];
    chunk_ids?: string[];
  } | null;
  created_at: string;
}
