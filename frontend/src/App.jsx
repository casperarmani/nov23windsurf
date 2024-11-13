import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginForm from './components/LoginForm';
import ProtectedRoute from './components/ProtectedRoute';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.baseURL = '/';

function MainContent() {
  const [chatHistory, setChatHistory] = React.useState([]);
  const [videoHistory, setVideoHistory] = React.useState([]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    fetchHistories();
  }, []);

  const fetchHistories = async () => {
    try {
      const [chatRes, videoRes] = await Promise.all([
        axios.get('/chat_history'),
        axios.get('/video_analysis_history')
      ]);
      setChatHistory(chatRes.data.history);
      setVideoHistory(videoRes.data.history);
      setError(null);
    } catch (error) {
      console.error('Error fetching histories:', error);
      setError('Failed to load history. Please refresh the page.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <ChatContainer onMessageSent={fetchHistories} />
          <VideoUpload onUploadComplete={fetchHistories} />
        </div>
        
        <div>
          <History
            chatHistory={chatHistory}
            videoHistory={videoHistory}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainContent />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;