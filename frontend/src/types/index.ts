export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  message: string;
  chat_type: 'user' | 'assistant';
  timestamp: string;
  user_id: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  sessions: ChatSession[];
}

export interface ChatContextType {
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;
  messages: ChatMessage[];
  sendMessage: (message: string) => Promise<void>;
  createNewSession: () => Promise<void>;
}
export interface Message {
  type: 'user' | 'bot' | 'error';
  content: string;
}

export interface ChatHistory {
  TIMESTAMP: string;
  chat_type: 'user' | 'bot';
  message: string;
  id?: string;
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
  history: T[];
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string;
}