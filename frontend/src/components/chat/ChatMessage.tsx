import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`flex ${message.chat_type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start max-w-[80%] ${message.chat_type === 'user' ? 'flex-row-reverse' : ''}`}>
        <Avatar className="w-8 h-8 bg-white/10">
          <AvatarFallback className="text-white/80">
            {message.chat_type === 'user' ? 'ME' : 'AI'}
          </AvatarFallback>
        </Avatar>
        <div className={`mx-3 p-4 rounded-2xl ${
          message.chat_type === 'user' 
            ? 'bg-white/10 backdrop-blur-lg' 
            : 'bg-black/20 backdrop-blur-lg'
        }`}>
          <p className="text-white/90 text-sm leading-relaxed">{message.message}</p>
          <p className="text-xs text-white/50 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}