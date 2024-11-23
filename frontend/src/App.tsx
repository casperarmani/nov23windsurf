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

      console.log('Chat Response Status:', chatResponse.status);
      console.log('Video Response Status:', videoResponse.status);

      if (!chatResponse.ok || !videoResponse.ok) {
        const chatText = await chatResponse.text();
        const videoText = await videoResponse.text();
        console.error('Chat Response Text:', chatText);
        console.error('Video Response Text:', videoText);
        throw new Error('Failed to fetch history data');
      }

      const chatData: ApiResponse<ChatHistory> = await chatResponse.json();
      const videoData: ApiResponse<VideoHistory> = await videoResponse.json();
      
      console.log('Raw Chat Data:', JSON.stringify(chatData, null, 2));
      console.log('Raw Video Data:', JSON.stringify(videoData, null, 2));

      // Detailed validation with more informative error messages
      if (!chatData) {
        throw new Error('No chat history data received');
      }

      // Check if chatData is an array or has a history property
      const chatHistory = Array.isArray(chatData) ? chatData : chatData.history;

      if (!Array.isArray(chatHistory)) {
        console.error('Invalid chat history format:', chatData);
        throw new Error('Invalid chat history data format');
      }

      // Similar checks for video data
      const videoHistory = Array.isArray(videoData) ? videoData : videoData.history;

      if (!Array.isArray(videoHistory)) {
        console.error('Invalid video history format:', videoData);
        throw new Error('Invalid video history data format');
      }

      // Convert chat history to chats
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

      // Sanitize and set states
      const sanitizedChatHistory = chatHistory.map(chat => ({
        TIMESTAMP: chat.TIMESTAMP || chat.timestamp || new Date().toISOString(),
        chat_type: chat.chat_type || 'user',
        message: chat.message || '',
        id: chat.id || crypto.randomUUID()
      }));

      const sanitizedVideoHistory = videoHistory.map(video => ({
        TIMESTAMP: video.TIMESTAMP || video.timestamp || new Date().toISOString(),
        upload_file_name: video.upload_file_name || 'Unknown File',
        analysis: video.analysis || 'No analysis available',
        id: video.id || crypto.randomUUID()
      }));

      // Update states
      setChatHistory(sanitizedChatHistory);
      setVideoHistory(sanitizedVideoHistory);
      setChats(convertedChats);

      console.log('Converted Chats:', convertedChats);
      console.log('Sanitized Chat History:', sanitizedChatHistory);
      console.log('Sanitized Video History:', sanitizedVideoHistory);
    } catch (error) {
      console.error('Complete Error Object:', error);
      console.error('Error Name:', error instanceof Error ? error.name : 'Unknown Error');
      console.error('Error Message:', error instanceof Error ? error.message : 'No message');
      
      setError(error instanceof Error ? error.message : 'An unexpected error occurred while fetching data');
      
      // Set empty arrays to prevent undefined errors
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