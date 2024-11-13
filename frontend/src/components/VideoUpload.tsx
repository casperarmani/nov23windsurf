import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FileInfo {
  name: string;
  type: string;
  size: string;
  isValidType: boolean;
}

const VALID_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'];

export const VideoUpload: React.FC = () => {
  const [files, setFiles] = React.useState<FileInfo[]>([]);
  
  const validateFile = (file: File): FileInfo => {
    return {
      name: file.name,
      type: file.type,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      isValidType: VALID_VIDEO_TYPES.includes(file.type)
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      const filesArray = Array.from(fileList);
      const validatedFiles = filesArray.map(validateFile);
      setFiles(validatedFiles);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <label htmlFor="videos" className="text-sm font-medium">
            Upload Videos (optional)
          </label>
          <Input
            id="videos"
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileChange}
          />
        </div>
        
        {files.length > 0 && (
          <div className="bg-secondary/10 p-4 rounded-md">
            <p className="text-sm mb-2">Selected files: {files.length}</p>
            <ul className="space-y-1">
              {files.map((file, index) => (
                <li 
                  key={index}
                  className={`text-sm ${!file.isValidType ? 'text-destructive' : ''}`}
                >
                  {file.name} ({file.size})
                  {!file.isValidType && ' - Invalid file type'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoUpload;
