import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';

function App() {
  const fetchHistories = () => {
    console.log('Fetching histories');
  };

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
              <History chatHistory={[]} videoHistory={[]} />
            </div>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;