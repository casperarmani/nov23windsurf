import React from 'react';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';
import { ChatHistory, VideoHistory, ApiResponse } from './types';

function App() {
  const [chatHistory, setChatHistory] = React.useState<ChatHistory[]>([]);
  const [videoHistory, setVideoHistory] = React.useState<VideoHistory[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchHistories = async () => {
    try {
      setError(null);
      const [chatResponse, videoResponse] = await Promise.all([
        fetch('/chat_history'),
        fetch('/video_analysis_history')
      ]);

      if (!chatResponse.ok || !videoResponse.ok) {
        throw new Error('Failed to fetch history data');
      }

      const chatData: ApiResponse<ChatHistory> = await chatResponse.json();
      const videoData: ApiResponse<VideoHistory> = await videoResponse.json();
      
      // Add type checking and null checks for the API response
      if (!chatData?.history || !Array.isArray(chatData.history)) {
        throw new Error('Invalid chat history data format');
      }

      if (!videoData?.history || !Array.isArray(videoData.history)) {
        throw new Error('Invalid video history data format');
      }

      setChatHistory(chatData.history);
      setVideoHistory(videoData.history);
    } catch (error) {
      console.error('Error fetching histories:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching data');
    }
  };

  React.useEffect(() => {
    fetchHistories();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
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
  );
}

export default App;
