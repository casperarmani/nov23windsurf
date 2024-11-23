import React, { createContext, useContext, useState, useCallback } from 'react';
import { ChatContextType, ChatSession, ChatMessage } from '../types';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(async (message: string) => {
    if (!currentSession) return;

    try {
      const response = await fetch('/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: currentSession.id,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setMessages(prev => [...prev, data.message]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [currentSession]);

  const createNewSession = useCallback(async () => {
    try {
      const response = await fetch('/create_chat_session', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const session = await response.json();
      setCurrentSession(session);
      setMessages([]);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        currentSession,
        setCurrentSession,
        messages,
        sendMessage,
        createNewSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
