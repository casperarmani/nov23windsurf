export interface Message {
  type: 'user' | 'bot' | 'error';
  content: string;
  timestamp?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
}

export interface ChatHistory {
  id: string;
  user_id: string;
  session_id: string;
  message: string;
  chat_type: 'user' | 'bot';
  TIMESTAMP: string;
}

export interface VideoHistory {
  TIMESTAMP: string;
  upload_file_name: string;
  analysis: string;
  id?: string;
  video_duration?: string;
  video_format?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ChatSessionResponse {
  sessions: ChatSession[];
  error?: string;
}