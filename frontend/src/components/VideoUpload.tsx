import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Upload } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface VideoUploadProps {
  onUploadComplete?: () => void;
}

const VALID_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const { toast } = useToast();

  const validateFile = (file: File) => {
    if (!VALID_VIDEO_TYPES.includes(file.type)) {
      return `${file.name} is not a supported video format`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const errors: string[] = [];
    const validFiles: File[] = [];

    selectedFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      toast({
        variant: "destructive",
        title: "Invalid files",
        description: errors.join('\n'),
      });
    }

    setFiles(validFiles);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('message', 'Video upload');
    files.forEach(file => {
      formData.append('videos', file);
    });

    try {
      const response = await fetch('/send_message', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: "Videos uploaded successfully",
      });

      setFiles([]);
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
      });
    } finally {
      setUploading(false);
    }
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
              disabled={uploading}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-100 file:text-slate-700
                hover:file:bg-slate-200
                focus:outline-none focus:ring-2 focus:ring-slate-200
                disabled:opacity-50 disabled:cursor-not-allowed"
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
