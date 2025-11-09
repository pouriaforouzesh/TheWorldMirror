

import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  accept: string;
  label: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, accept, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileUpload(files[0]);
      setFileName(files[0].name);
    }
  };

  const onDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, [handleFileChange]);

  return (
    <label
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-slate-800 border-2 border-slate-600 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-400 focus:outline-none ${isDragging ? 'border-indigo-400' : ''}`}
    >
      <span className="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        <span className="font-medium text-gray-300">
          {fileName || <>Drop files to Attach, or <span className="text-indigo-400 underline">browse</span></>}
        </span>
      </span>
      <p className="text-sm text-slate-500">{label}</p>
      <input type="file" name="file_upload" className="hidden" accept={accept} onChange={(e) => handleFileChange(e.target.files)} />
    </label>
  );
};

export default FileUpload;
