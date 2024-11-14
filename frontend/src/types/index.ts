export interface Message {
  type: 'user' | 'bot' | 'error';
  content: string;
}

export interface ChatHistory {
  TIMESTAMP: string;
  chat_type: 'user' | 'bot';
  message: string;
}

export interface VideoHistory {
  TIMESTAMP: string;
  upload_file_name: string;
  analysis: string;
}