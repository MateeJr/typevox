"use client";

import React, { useState, useEffect, useRef } from 'react';
import Quicklook, { QuicklookImage } from './Quicklook';
import ChatToolbar from './ChatToolbar';
import StreamingText from './StreamingText';

export interface MessageImage {
  name: string;
  base64Data: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  images?: MessageImage[];
  cancelled?: boolean;
}

interface ChatBubbleProps {
  message: Message;
  theme: 'light' | 'dark';
  onDeleteMessage: (messageId: string) => void;
  onConfirmEdit?: (messageId: string, newText: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onCopyMessage?: (text: string) => void;
  isAiGenerating?: boolean;
  isReasoning?: boolean;
}

export default function ChatBubble({ message, theme, onDeleteMessage, onConfirmEdit, onRegenerateResponse, onCopyMessage, isAiGenerating, isReasoning }: ChatBubbleProps) {
  const isUser = message.sender === 'user';
  const isCancelledAI = message.sender === 'ai' && message.cancelled;

  // State for Quicklook modal
  const [quicklookOpen, setQuicklookOpen] = useState(false);
  const [quicklookImage, setQuicklookImage] = useState<QuicklookImage | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Copied State
  const [justCopied, setJustCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditing) {
      setEditText(message.text); // Reset editText if message.text changes while editing (e.g. prop update)
      editTextAreaRef.current?.focus();
      editTextAreaRef.current?.setSelectionRange(editText.length, editText.length); // Move cursor to end
    }
  }, [isEditing, message.text]); // Only message.text, not editText itself

  // User bubble styles
  const userBubbleClasses = theme === 'light' 
    ? "bg-gray-200 text-neutral-800 self-end shadow" 
    : "bg-neutral-700 text-neutral-100 self-end shadow";
  
  // AI bubble styles
  let aiBubbleText = theme === 'light' ? 'text-neutral-800' : 'text-neutral-100';
  if (isCancelledAI) {
    aiBubbleText = theme === 'light' ? 'text-neutral-500' : 'text-neutral-400';
  }
  const thinkingTextClasses = theme === 'light' 
    ? 'text-red-500 animate-pulse'  // Test with animate-pulse
    : 'text-blue-400 animate-pulse'; // Test with animate-pulse (dark mode)
  
  const aiBubbleClasses = `${aiBubbleText} self-start`;

  const bubbleBaseClasses = "max-w-[70%] md:max-w-[60%] p-3 rounded-2xl font-outfit-normal text-1xl leading-relaxed";

  // Opens Quicklook for the clicked image
  const handleImageClick = (image: MessageImage) => {
    setQuicklookImage(image);
    setQuicklookOpen(true);
  };

  // Dummy functions for the toolbar actions
  const handleDelete = () => {
    // console.log("Delete clicked for message:", message.id);
    onDeleteMessage(message.id); 
  };

  const handleInitiateEdit = () => {
    if (isUser) {
      setIsEditing(true);
      // setEditText(message.text); // useEffect now handles this
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.text); // Reset to original text on cancel
  };

  const handleSaveEdit = () => {
    if (editText.trim() === "") return; // Prevent saving empty message
    onConfirmEdit?.(message.id, editText);
    setIsEditing(false);
  };

  const handleCopy = () => {
    if (message.text) {
      onCopyMessage?.(message.text); // This will trigger the actual copy and potential toast
      setJustCopied(true);
      
      // Clear any existing timeout to prevent conflicts if clicked multiple times
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setJustCopied(false);
        copyTimeoutRef.current = null;
      }, 2000); // Revert icon after 2 seconds
    }
  };
  
  const handleEditKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSaveEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  };

  const handleRegenerate = () => {
    // console.log("Regenerate clicked for AI message:", message.id);
    onRegenerateResponse?.(message.id); // Call prop if it exists
  };

  const editButtonClasses = theme === 'light' 
    ? "bg-sky-500 hover:bg-sky-600 text-white" 
    : "bg-sky-600 hover:bg-sky-700 text-white";
  const cancelButtonClasses = theme === 'light' 
    ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-700" 
    : "bg-neutral-600 hover:bg-neutral-500 text-neutral-100";

  if (isUser && isEditing) {
    return (
      <div className={`flex flex-col mb-3 items-end w-full`}>
        <div className={`${bubbleBaseClasses} ${userBubbleClasses} p-2 w-full`}>
          <textarea
            ref={editTextAreaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className={`w-full p-2 rounded-md resize-none bg-transparent text-3xl font-outfit-normal leading-relaxed focus:outline-none ${theme === 'light' ? 'text-neutral-800' : 'text-neutral-100'}`}
            rows={3} // Adjust rows as needed, consider auto-sizing
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button 
              onClick={handleCancelEdit}
              className={`px-3 py-1 text-xs rounded transition-colors ${cancelButtonClasses}`}
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveEdit}
              disabled={editText.trim() === ""}
              className={`px-3 py-1 text-xs rounded transition-colors ${editText.trim() === "" ? "opacity-50 cursor-not-allowed" : editButtonClasses }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col mb-3 ${isUser ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`${bubbleBaseClasses} ${isUser ? userBubbleClasses : aiBubbleClasses} whitespace-pre-line`}
      >
        {/* Render images if present */}
        {message.images && message.images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.images.map((image, index) => (
              <img 
                key={index} 
                src={image.base64Data} 
                alt={image.name}
                className="max-w-[100px] max-h-[100px] h-auto w-auto object-contain rounded-md border border-gray-300 dark:border-neutral-700 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handleImageClick(image)}
              />
            ))}
          </div>
        )}
        {/* Conditionally render StreamingText for AI messages or "Thinking..." placeholder */}
        {message.sender === 'ai' && isAiGenerating && message.text === "" && !isCancelledAI && isReasoning ? (
          <p className={thinkingTextClasses}>Thinking...</p>
        ) : (
          <div className="markdown-bubble">
            <StreamingText 
              text={message.text} 
              isAiMessage={message.sender === 'ai'} 
              messageId={message.id} 
              shouldRenderMarkdown={true} 
            />
          </div>
        )}
      </div>
      {/* Chat Toolbar */}
      {!isCancelledAI && !isAiGenerating && (
        <ChatToolbar
          isUser={isUser}
          theme={theme}
          onDelete={handleDelete}
          onEdit={isUser ? handleInitiateEdit : undefined} 
          onRegenerate={!isUser ? handleRegenerate : undefined}
          onCopy={handleCopy}
          isCopied={justCopied}
          forceVisible={isUser ? isHovered || isEditing : true}
        />
      )}

      {/* Quicklook Modal */}
      <Quicklook
        open={quicklookOpen}
        onClose={() => setQuicklookOpen(false)}
        image={quicklookImage || undefined}
      />
    </div>
  );
} 