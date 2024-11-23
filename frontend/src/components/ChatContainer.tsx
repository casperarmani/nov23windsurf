import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Message, ChatSession } from '../types';
import { ChatHeader } from './chat/ChatHeader';
import { ChatWelcome } from './chat/ChatWelcome';
import { ChatMessage } from './chat/ChatMessage';
import { ChatInput } from './chat/ChatInput';
import { Upload, X } from 'lucide-react';
import { useChat } from '../context/ChatContext';

interface ChatContainerProps {
  initialMessages?: Message[];
  onCreateSession?: () => void;
  onMessageSent?: (messages: Message[], sessionId: string) => void;
}

function ChatContainer({ initialMessages = [], onCreateSession }: ChatContainerProps) {
  const { currentSession, messages, isLoading, sendMessage } = useChat();
  const [message, setMessage] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && files.length === 0) || isLoading) return;

    const formData = new FormData();
    formData.append('message', message.trim());
    
    files.forEach((file) => {
      formData.append('videos', file);
    });

    if (currentSession?.id) {
      formData.append('session_id', currentSession.id);
    }

    await sendMessage(formData);
    setMessage('');
    setFiles([]);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('video/')
    );

    if (droppedFiles.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    }
  };

  return (
    <div className="flex flex-col h-[800px] rounded-3xl bg-black/10 backdrop-blur-xl border border-white/10">
      <ChatHeader session={currentSession} />
      {messages.length === 0 && <ChatWelcome />}
      
      <ScrollArea className="flex-grow px-6">
        <div className="space-y-6">
          {messages.map((msg: Message, index: number) => (
            <ChatMessage key={index} message={msg} />
          ))}
        </div>
      </ScrollArea>

      <ChatInput
        message={message}
        isLoading={isLoading}
        onMessageChange={(e) => setMessage(e.target.value)}
        onSubmit={handleSubmit}
      />

      <div className="px-6 pb-4">
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-3 transition-all duration-200 ${
            isDragging
              ? 'border-white/40 bg-white/5'
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex flex-col items-center justify-center text-white/60">
            <Upload className="w-5 h-5 mb-1.5" />
            <p className="text-sm mb-1">Drag and drop video files here</p>
            <p className="text-xs">or</p>
            <label className="mt-2 px-3 py-1.5 bg-white/10 rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
              <span className="text-sm">Browse files</span>
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2 max-h-32 overflow-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white/5 rounded-lg p-2"
              >
                <div className="flex items-center text-white/80">
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-white/40 ml-2">
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatContainer;