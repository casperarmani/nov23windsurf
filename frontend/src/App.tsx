import React from 'react';
import ChatContainer from './components/ChatContainer';
import History from './components/History';
import { Sidebar } from './components/Sidebar';
import { ChatHistory, VideoHistory, ApiResponse, Chat, Message } from './types';

function App() {
  const [chatHistory, setChatHistory] = React.useState<ChatHistory[]>([]);
  const [videoHistory, setVideoHistory] = React.useState<VideoHistory[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);

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

      // Ensure consistent data format
      const chatHistory = Array.isArray(chatData.history) 
        ? chatData.history 
        : (chatData.history || []);

      const videoHistory = Array.isArray(videoData.history) 
        ? videoData.history 
        : (videoData.history || []);

      console.log('Raw Chat History:', chatHistory);

      // More robust chat history conversion
      const convertedChats: Chat[] = chatHistory.map(chatItem => ({
        id: chatItem.id || crypto.randomUUID(),
        title: chatItem.message.length > 30 
          ? chatItem.message.slice(0, 30) + '...' 
          : (chatItem.message || 'Untitled Chat'),
        messages: [{
          type: chatItem.chat_type || 'user',
          content: chatItem.message || ''
        }],
        timestamp: chatItem.TIMESTAMP || new Date().toISOString()
      }));

      console.log('Converted Chats:', convertedChats);

      // Sanitize histories with comprehensive fallback values
      const sanitizedChatHistory = chatHistory.map(chat => ({
        TIMESTAMP: chat.TIMESTAMP || chat.timestamp || new Date().toISOString(),
        chat_type: chat.chat_type || 'user',
        message: chat.message || '',
        id: chat.id || crypto.randomUUID()
      }));

      console.log('Sanitized Chat History:', sanitizedChatHistory);

      const sanitizedVideoHistory = videoHistory.map(video => ({
        TIMESTAMP: video.TIMESTAMP || video.timestamp || new Date().toISOString(),
        upload_file_name: video.upload_file_name || 'Unknown File',
        analysis: video.analysis || 'No analysis available',
        id: video.id || crypto.randomUUID()
      }));

      // Sorting chats by timestamp to ensure chronological order
      convertedChats.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Update states with sorted and sanitized data
      setChatHistory(sanitizedChatHistory);
      setVideoHistory(sanitizedVideoHistory);
      setChats(convertedChats);

      // Optional: Set current chat to most recent if no current chat
      if (!currentChatId && convertedChats.length > 0) {
        setCurrentChatId(convertedChats[0].id);
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