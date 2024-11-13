import React, { useState } from 'react';
import axios from 'axios';

function VideoUpload({ onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('videos', file);
    });
    formData.append('message', 'Analyze these videos');

    try {
      await axios.post('/send_message', formData);
      setFiles([]);
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <form onSubmit={handleUpload}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Upload Videos
          </label>
          <input
            type="file"
            multiple
            accept="video/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {files.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Selected Files:</h4>
            <ul className="text-sm text-gray-600">
              {files.map((file, index) => (
                <li key={index}>
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={files.length === 0 || uploading}
          className={`w-full px-4 py-2 text-white rounded-lg ${
            files.length === 0 || uploading
              ? 'bg-gray-400'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {uploading ? 'Uploading...' : 'Upload Videos'}
        </button>
      </form>
    </div>
  );
}

export default VideoUpload;
