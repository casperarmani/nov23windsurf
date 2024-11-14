import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Upload } from 'lucide-react';

interface VideoUploadProps {
  onUploadComplete?: () => void;
}

function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    
    // Mock upload for UI development
    setTimeout(() => {
      setFiles([]);
      if (onUploadComplete) onUploadComplete();
      setUploading(false);
    }, 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Videos</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-upload">Select Videos</Label>
            <input
              id="video-upload"
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-100 file:text-slate-700
                hover:file:bg-slate-200
                focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {files.length > 0 && (
            <div className="rounded-md bg-slate-50 p-4">
              <h4 className="text-sm font-medium mb-2">Selected Files:</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                {files.map((file, index) => (
                  <li key={index}>
                    {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="submit"
            disabled={files.length === 0 || uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Videos'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default VideoUpload;