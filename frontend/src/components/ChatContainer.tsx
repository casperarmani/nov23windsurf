import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Message } from '../types';
import { Send } from 'lucide-react';

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

    setChatMessages(prev => [
      ...prev,
      { type: 'user', content: message },
      { type: 'bot', content: 'This is a mock response for UI development.' }
    ]);
    
    setMessage('');
    if (onMessageSent) onMessageSent();
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex items-start gap-3 max-w-[80%] ${
                msg.type === 'error' ? 'bg-destructive text-destructive-foreground' : ''
              }`}>
                {msg.type !== 'user' && (
                  <Avatar>
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div className={`rounded-lg p-3 ${
                  msg.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {msg.content}
                </div>
                {msg.type === 'user' && (
                  <Avatar>
                    <AvatarFallback>ME</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full gap-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

export default ChatContainer;