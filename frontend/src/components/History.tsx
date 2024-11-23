import { ChatMessage, ChatSession, VideoHistory } from '../types';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useChat } from '../context/ChatContext';
import { Button } from './ui/button';

interface HistoryProps {
  videoHistory: VideoHistory[];
}

function History({ videoHistory }: HistoryProps) {
  const { messages, currentSession, setCurrentSession, createNewSession } = useChat();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button
              onClick={() => createNewSession()}
              className="text-xs"
              variant="outline"
            >
              New Chat
            </Button>
          </div>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            {messages.length > 0 ? (
              messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={`mb-4 p-2 rounded ${
                    currentSession?.id === msg.session_id
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : ''
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleString()}
                  </div>
                  <div className="font-medium">
                    {msg.chat_type === 'assistant' ? 'AI' : 'You'}:
                  </div>
                  <div className="text-sm">{msg.message}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No chat history available
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video Analysis History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            {videoHistory.length > 0 ? (
              videoHistory.map((analysis, index) => (
                <div key={index} className="mb-4">
                  <div className="text-xs text-muted-foreground">
                    {new Date(analysis.TIMESTAMP).toLocaleString()}
                  </div>
                  <div className="font-medium">
                    File: {analysis.upload_file_name}
                  </div>
                  <div className="text-sm">{analysis.analysis}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No video analysis history available
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default History;
