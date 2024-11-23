import React from 'react';
import ChatContainer from './components/ChatContainer';
import History from './components/History';
import { Sidebar } from './components/Sidebar';
import { ChatProvider } from './context/ChatContext';
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
        fetch('/api/chat_history'),
        fetch('/api/video_analysis_history')
      ]);

      if (!chatResponse.ok || !videoResponse.ok) {
        throw new Error('Failed to fetch history data');
      }

      const chatData = await chatResponse.json();
      const videoData = await videoResponse.json();
      
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

  const handleNewChat = async () => {
    try {
      const response = await fetch('/api/chat_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `New Chat ${chats.length + 1}`
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const newSession = await response.json();
      const newChat: Chat = {
        id: newSession.id,
        title: newSession.title,
        messages: [],
        timestamp: newSession.created_at
      };
      
      setChats([newChat, ...chats]);
      setCurrentChatId(newChat.id);
    } catch (error) {
      console.error('Error creating chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat session');
    }
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
    <ChatProvider>
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
                  initialMessages={chatHistory.map(ch => ({
                    type: ch.chat_type as 'user' | 'bot' | 'error',
                    content: ch.message
                  }))}
                  onCreateSession={handleNewChat}
                  onMessageSent={handleMessageSent}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </ChatProvider>
  );
}

export default App;