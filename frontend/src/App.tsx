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

  const fetchChatSessions = async () => {
    try {
      const response = await fetch('/api/chat_sessions');
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to fetch chat sessions:', data.error);
        return;
      }

      if (data.sessions && Array.isArray(data.sessions)) {
        const formattedChats = data.sessions.map((session: any) => ({
          id: session.id,
          title: session.title || 'New Chat',
          messages: [],
          timestamp: session.created_at
        }));
        setChats(formattedChats);
        
        // Set current chat if none selected
        if (!currentChatId && formattedChats.length > 0) {
          setCurrentChatId(formattedChats[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    }
  };

  const fetchHistories = async () => {
    try {
      setError(null);
      const [chatResponse, videoResponse] = await Promise.all([
        fetch('/api/chat_history' + (currentChatId ? `?session_id=${currentChatId}` : '')),
        fetch('/api/video_analysis_history')
      ]);

      const chatData = await chatResponse.json();
      const videoData = await videoResponse.json();
      
      console.log('Chat History Response:', chatData);
      console.log('Video History Response:', videoData);
      
      // Check for error in chat history response
      if (!chatResponse.ok) {
        console.error('Chat history error:', chatData.error);
        setError(chatData.error || 'Failed to fetch chat history');
        setChatHistory([]);
      } else {
        if (!chatData?.history || !Array.isArray(chatData.history)) {
          throw new Error('Invalid chat history data format');
        }
        setChatHistory(chatData.history);
        
        // Update current chat messages if we have a selected chat
        if (currentChatId) {
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === currentChatId
                ? { 
                    ...chat, 
                    messages: chatData.history.map((msg: any) => ({
                      type: msg.chat_type,
                      content: msg.message
                    }))
                  }
                : chat
            )
          );
        }
      }

      // Check for error in video history response
      if (!videoResponse.ok) {
        console.error('Video history error:', videoData.error);
        setVideoHistory([]);
      } else {
        if (!videoData?.history || !Array.isArray(videoData.history)) {
          throw new Error('Invalid video history data format');
        }
        setVideoHistory(videoData.history);
      }
    } catch (error) {
      console.error('Error fetching histories:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching data');
      setChatHistory([]);
      setVideoHistory([]);
    }
  };

  const handleNewChat = async () => {
    try {
      const formData = new FormData();
      formData.append('title', `New Chat ${chats.length + 1}`);

      const response = await fetch('/api/create_chat_session', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to create new chat');
      }

      const newChat = await response.json();
      setChats(prevChats => [{
        id: newChat.id,
        title: newChat.title,
        messages: [],
        timestamp: newChat.created_at
      }, ...prevChats]);
      setCurrentChatId(newChat.id);
    } catch (error) {
      console.error('Error creating new chat:', error);
      setError('Failed to create new chat');
    }
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const handleMessageSent = async (messages: Message[], chatId: string) => {
    try {
      // Update local state immediately for better UX
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId 
            ? { ...chat, messages }
            : chat
        )
      );

      // No need to fetch histories here since the ChatContainer component 
      // already handles the API call and response
    } catch (error) {
      console.error('Error updating chat:', error);
      setError('Failed to update chat');
    }
  };

  // Load chat sessions on mount
  React.useEffect(() => {
    fetchChatSessions();
  }, []);

  // Fetch histories when current chat changes
  React.useEffect(() => {
    if (currentChatId) {
      fetchHistories();
    }
  }, [currentChatId]);

  const currentChat = chats.find(chat => chat.id === currentChatId) || null;

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