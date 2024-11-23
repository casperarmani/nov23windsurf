import React from 'react';
import ChatContainer from './components/ChatContainer';
import History from './components/History';
import { Sidebar } from './components/Sidebar';
import { ChatHistory, VideoHistory, ApiResponse, Chat, Message } from './types';

interface SessionCache {
  [sessionId: string]: ChatHistory[];
}

function App() {
  const [chatHistory, setChatHistory] = React.useState<ChatHistory[]>([]);
  const [videoHistory, setVideoHistory] = React.useState<VideoHistory[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
  const [sessionCache, setSessionCache] = React.useState<SessionCache>({});

  const fetchHistories = async (sessionId?: string) => {
    try {
      setError(null);
      
      // Check cache for session-specific messages
      if (sessionId && sessionCache[sessionId]) {
        console.log('Using cached messages for session:', sessionId);
        setChatHistory(sessionCache[sessionId]);
        return;
      }

      const url = sessionId ? `/chat_history?session_id=${sessionId}` : '/chat_history';
      const [chatResponse, videoResponse] = await Promise.all([
        fetch(url),
        fetch('/video_analysis_history')
      ]);

      console.log('Response Status:', {
        chat: chatResponse.status,
        video: videoResponse.status
      });

      // Process chat history response
      let chatHistory: ChatHistory[] = [];
      try {
        const chatData = await chatResponse.json();
        chatHistory = Array.isArray(chatData) ? chatData : [];
        console.log('Raw Chat History:', chatHistory);

        // Update cache if session-specific
        if (sessionId) {
          setSessionCache(prev => ({
            ...prev,
            [sessionId]: chatHistory
          }));
        }
      } catch (error) {
        console.error('Error parsing chat response:', error);
        setError('Failed to load chat history');
      }

      // Handle video history
      let videoHistory: VideoHistory[] = [];
      try {
        const videoData = await videoResponse.json();
        videoHistory = Array.isArray(videoData) ? videoData : [];
        console.log('Raw Video History:', videoHistory);
      } catch (error) {
        console.error('Error parsing video response:', error);
        setError('Failed to load video history');
      }

      // Convert to Chat objects only if needed for current session
      const convertedChats = chatHistory
        .filter(chat => !sessionId || chat.session_id === sessionId)
        .map(chatItem => {
          try {
            return {
              id: chatItem.id || crypto.randomUUID(),
              title: chatItem.message?.slice(0, 30) || 'Untitled Chat',
              messages: [{
                type: chatItem.chat_type === 'text' ? 'user' : chatItem.chat_type,
                content: chatItem.message || ''
              }],
              timestamp: chatItem.TIMESTAMP,
              session_id: chatItem.session_id
            };
          } catch (error) {
            console.error('Error converting chat item:', error, chatItem);
            return null;
          }
        })
        .filter((chat): chat is Chat => chat !== null);

      console.log('Converted Chats:', convertedChats);

      // Sanitize histories with comprehensive fallback values
      const sanitizedChatHistory = chatHistory.length > 0 
        ? chatHistory.map(chat => ({
            TIMESTAMP: chat.TIMESTAMP || chat.timestamp || new Date().toISOString(),
            chat_type: chat.chat_type || 'user',
            message: chat.message || '',
            id: chat.id || crypto.randomUUID()
          }))
        : [];

      const sanitizedVideoHistory = videoHistory.map(video => ({
        TIMESTAMP: video.TIMESTAMP || video.timestamp || new Date().toISOString(),
        upload_file_name: video.upload_file_name || 'Unknown File',
        analysis: video.analysis || 'No analysis available',
        id: video.id || crypto.randomUUID()
      }));

      // Sorting chats by timestamp to ensure chronological order
      const sortedChats = convertedChats.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      console.log('Sorted Chats:', sortedChats);
      console.log('Sanitized Chat History:', sanitizedChatHistory);

      // Update states with sorted and sanitized data
      setChatHistory(sanitizedChatHistory);
      setVideoHistory(sanitizedVideoHistory);
      setChats(sortedChats);

      // Optional: Set current chat to most recent if no current chat
      if (!currentChatId && sortedChats.length > 0) {
        setCurrentChatId(sortedChats[0].id);
      }

    } catch (error) {
      console.error('Complete Error in fetchHistories:', error);
      
      // More informative error handling
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while fetching data';
      
      setError(errorMessage);
      
      // Ensure clean state even on error
      setChatHistory([]);
      setVideoHistory([]);
      setChats([]);
    }
  };

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: `New Chat ${chats.length + 1}`,
      messages: [],
      timestamp: new Date().toISOString()
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    if (chat?.session_id) {
      fetchHistories(chat.session_id);
    }
  };

  const handleMessageSent = (messages: Message[], chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, messages, title: messages[0]?.content.slice(0, 30) || chat.title }
          : chat
      )
    );
    fetchHistories();
  };

  const currentChat = chats.find(chat => chat.id === currentChatId) || null;

  React.useEffect(() => {
    fetchHistories();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-300">
      <Sidebar 
        className="border-r" 
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
      />
      <main className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://cdn.discordapp.com/attachments/1109371168147914752/1307892127791054878/clear_tree.png?ex=673fe976&is=673e97f6&hm=11dc4f696c3649b07b95b10eadd1d0747d19b7021704a32189492ccab073baa7&')] bg-cover bg-center">
          <div className="h-full overflow-auto">
            <div className="container mx-auto px-4 py-8">
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-8">
                <ChatContainer 
                  key={currentChatId || 'new'} 
                  chatId={currentChatId}
                  initialMessages={currentChat?.messages || []}
                  onMessageSent={handleMessageSent}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;