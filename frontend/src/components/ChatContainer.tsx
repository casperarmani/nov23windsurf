import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Message } from '../types';
import { Send, Loader2 } from 'lucide-react';

interface ChatContainerProps {
  onMessageSent?: () => void;
}

function ChatContainer({ onMessageSent }: ChatContainerProps) {
  const [message, setMessage] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('message', message.trim());

      const response = await fetch('/send_message', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setChatMessages(prev => [
        ...prev,
        { type: 'user', content: message.trim() },
        { type: 'bot', content: data.response }
      ]);
      
      setMessage('');
      if (onMessageSent) onMessageSent();
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to send message. Please try again.');
      setChatMessages(prev => [
        ...prev,
        { type: 'user', content: message.trim() },
        { type: 'error', content: 'Failed to send message. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea ref={chatContainerRef} className="h-[400px] w-full rounded-md border p-4">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex items-start gap-3 max-w-[80%] ${
                msg.type === 'error' ? 'bg-destructive/10 text-destructive' : ''
              }`}>
                {msg.type !== 'user' && (
                  <Avatar>
                    <AvatarFallback>{msg.type === 'bot' ? 'AI' : '!'}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`rounded-lg p-3 ${
                  msg.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : msg.type === 'error'
                    ? 'bg-destructive/10 text-destructive'
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
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

export default ChatContainer;
