import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';
import { ChatHistory, VideoHistory, ApiResponse } from './types';

function App() {
  const [chatHistory, setChatHistory] = React.useState<ChatHistory[]>([]);
  const [videoHistory, setVideoHistory] = React.useState<VideoHistory[]>([]);

  const fetchHistories = async () => {
    try {
      const [chatResponse, videoResponse] = await Promise.all([
        fetch('/api/chat_history'),
        fetch('/api/video_analysis_history')
      ]);

      if (chatResponse.ok && videoResponse.ok) {
        const chatData: ApiResponse<ChatHistory> = await chatResponse.json();
        const videoData: ApiResponse<VideoHistory> = await videoResponse.json();
        
        setChatHistory(chatData.history);
        setVideoHistory(videoData.history);
      }
    } catch (error) {
      console.error('Error fetching histories:', error);
    }
  };

  React.useEffect(() => {
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
              <History chatHistory={chatHistory} videoHistory={videoHistory} />
            </div>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;