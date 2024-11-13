import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function ChatContainer({ onMessageSent }) {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const formData = new FormData();
    formData.append('message', message);

    try {
      const response = await axios.post('/send_message', formData);
      
      setChatMessages(prev => [
        ...prev,
        { type: 'user', content: message },
        { type: 'bot', content: response.data.response }
      ]);
      
      setMessage('');
      if (onMessageSent) onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages(prev => [
        ...prev,
        { type: 'error', content: 'Failed to send message. Please try again.' }
      ]);
    }
  };

  return (
    <div className="mb-6">
      <div
        ref={chatContainerRef}
        className="bg-gray-100 rounded-lg p-4 mb-4 h-96 overflow-y-auto"
      >
        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${
              msg.type === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block px-4 py-2 rounded-lg ${
                msg.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.type === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-300'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatContainer;
