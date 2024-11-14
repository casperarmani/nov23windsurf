import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';
import { ChatHistory, VideoHistory } from './types';
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const { toast } = useToast();
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [videoHistory, setVideoHistory] = useState<VideoHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistories = async () => {
    setIsLoading(true);
    try {
      const [chatResponse, videoResponse] = await Promise.all([
        fetch('/chat_history'),
        fetch('/video_analysis_history')
      ]);

      if (!chatResponse.ok || !videoResponse.ok) {
        throw new Error('Failed to fetch history data');
      }

      const chatData = await chatResponse.json();
      const videoData = await videoResponse.json();
      
      if (Array.isArray(chatData.history)) {
        setChatHistory(chatData.history.map((item: any) => ({
          TIMESTAMP: item.TIMESTAMP,
          chat_type: item.chat_type,
          message: item.message,
          id: item.id
        })));
      }
      
      if (Array.isArray(videoData.history)) {
        setVideoHistory(videoData.history.map((item: any) => ({
          TIMESTAMP: item.TIMESTAMP,
          upload_file_name: item.upload_file_name,
          analysis: item.analysis,
          id: item.id,
          video_duration: item.video_duration,
          video_format: item.video_format
        })));
      }
    } catch (error) {
      console.error('Error fetching histories:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load history data. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistories();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <ChatContainer onMessageSent={fetchHistories} />
              <VideoUpload onUploadComplete={fetchHistories} />
            </div>
            <div>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <History 
                  chatHistory={chatHistory} 
                  videoHistory={videoHistory} 
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;
