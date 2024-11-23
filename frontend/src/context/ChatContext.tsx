import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Message, ChatSession, ChatContextType } from '../types';

interface ChatContextType {
  currentSession: ChatSession | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  createSession: () => Promise<void>;
  sendMessage: (formData: FormData) => Promise<void>;
  clearError: () => void;
  setMessages: (messages: Message[]) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/chat_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data: ChatSession = await response.json();
      setCurrentSession(data);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chat session');
      console.error('Error creating chat session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (formData: FormData) => {
    if (!currentSession?.id) {
      setError('No active chat session');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add session_id to FormData
      formData.append('session_id', currentSession.id);

      // Add current message to UI immediately for better UX
      const userMessage = formData.get('message') as string;
      if (userMessage?.trim()) {
        const newMessage = { type: 'user' as const, content: userMessage };
        setMessages(prev => [...prev, newMessage]);
      }

      const response = await fetch('/send_message', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      if (data.response) {
        setMessages(prev => [...prev, { type: 'bot', content: data.response }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: 'Failed to send message. Please try again.' 
      }]);
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession?.id]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    currentSession,
    messages,
    isLoading,
    error,
    createSession,
    sendMessage,
    clearError,
    setMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
