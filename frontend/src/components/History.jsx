import React from 'react';

function History({ chatHistory, videoHistory }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Chat History</h3>
        <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
          {chatHistory.length > 0 ? (
            chatHistory.map((msg, index) => (
              <div key={index} className="mb-4">
                <div className="text-xs text-gray-500">
                  {new Date(msg.TIMESTAMP).toLocaleString()}
                </div>
                <div className="font-medium">
                  {msg.chat_type === 'bot' ? 'Chatbot' : 'You'}:
                </div>
                <div className="text-gray-700">{msg.message}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No chat history available</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Video Analysis History</h3>
        <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
          {videoHistory.length > 0 ? (
            videoHistory.map((analysis, index) => (
              <div key={index} className="mb-4">
                <div className="text-xs text-gray-500">
                  {new Date(analysis.TIMESTAMP).toLocaleString()}
                </div>
                <div className="font-medium">File: {analysis.upload_file_name}</div>
                <div className="text-gray-700">{analysis.analysis}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No video analysis history available</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default History;
