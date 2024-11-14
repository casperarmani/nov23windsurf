import { useState, useRef, useEffect } from 'react';
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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connectWebSocket = () => {
    if (isConnecting) return;

    setIsConnecting(true);
    const clientId = Math.random().toString(36).substring(7);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/ws/${clientId}`);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setSocket(ws);
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setChatMessages(prev => [...prev, { type: 'bot', content: data.content }]);
      } else if (data.type === 'error') {
        setChatMessages(prev => [...prev, { type: 'error', content: data.content }]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setSocket(null);
      setIsConnecting(false);
      
      // Attempt to reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    // Add user message to chat
    const userMessage = { type: 'user' as const, content: message };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Send message through WebSocket
    socket.send(JSON.stringify({ message, type: 'message' }));
    
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
          <div ref={chatContainerRef}>
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
          </div>
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
          <Button 
            type="submit" 
            size="icon" 
            disabled={!socket || isConnecting}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

export default ChatContainer;
