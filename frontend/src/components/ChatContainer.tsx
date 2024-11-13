import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface Message {
  type: 'user' | 'bot' | 'error';
  content: string;
}

interface ChatContainerProps {
  onMessageSent?: () => void;
}

function ChatContainer({ onMessageSent }: ChatContainerProps) {
  const [message, setMessage] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const formData = new FormData();
    formData.append('message', message);

    try {
      const response = await axios.post('/send_message', formData);
      
      setChatMessages(prev => [
        ...prev,
        { type: 'user', content: message },
        { type: 'bot', content: response.data.response }
      ]);
      
      setMessage('');
      if (onMessageSent) onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages(prev => [
        ...prev,
        { type: 'error', content: 'Failed to send message. Please try again.' }
      ]);
    }
  };

  return (
    <div className="mb-6">
      <div
        ref={chatContainerRef}
        className="rounded-lg p-4 mb-4 h-96 overflow-y-auto bg-background"
      >
        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${
              msg.type === 'user' ? 'flex justify-end' : 'flex justify-start'
            }`}
          >
            <Card className={`max-w-[80%] ${
              msg.type === 'error' ? 'bg-destructive text-destructive-foreground' : ''
            }`}>
              <CardContent className="p-4 flex items-start gap-3">
                {msg.type !== 'user' && (
                  <Avatar>
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">{msg.content}</div>
                {msg.type === 'user' && (
                  <Avatar>
                    <AvatarFallback>ME</AvatarFallback>
                  </Avatar>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-4">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit" className="self-end">
          Send
        </Button>
      </form>
    </div>
  );
}

export default ChatContainer;
