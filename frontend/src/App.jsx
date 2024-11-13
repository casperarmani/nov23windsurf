import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChatContainer from './components/ChatContainer';
import VideoUpload from './components/VideoUpload';
import History from './components/History';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.baseURL = '/'; // Use relative URLs for API calls

function App() {
  const [user, setUser] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [videoHistory, setVideoHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistories();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth_status');
      if (response.data.authenticated) {
        setUser(response.data.user);
        setError(null);
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setError('Authentication failed. Please try again.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  };

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

  const handleLogout = async () => {
    try {
      await axios.post('/logout');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Logout failed. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          {error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          ) : (
            <div className="animate-pulse">Loading...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Video Analysis Chatbot</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
      
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

export default App;
