"use client";

import React, { useEffect, useRef } from 'react';
import ChatBubble, { Message } from './ChatBubble';

interface ChatDisplayProps {
  messages: Message[];
  theme: 'light' | 'dark';
  // Add the handlers passed from the parent page
  onDeleteMessage: (messageId: string) => void;
  // onEditMessage: (messageId: string) => void; // Replaced by onConfirmEdit
  onConfirmEdit?: (messageId: string, newText: string) => void; // For in-bubble editing
  onRegenerateResponse: (messageId: string) => void;
  onCopyMessage?: (text: string) => void; // Added for copying message text
  isAiTyping?: boolean; // Added
  streamingAiMessageId?: string | null; // Added
  isReasonModeActive?: boolean; // Added for reason toggle
}

export default function ChatDisplay({ messages, theme, onDeleteMessage, onConfirmEdit, onRegenerateResponse, onCopyMessage, isAiTyping, streamingAiMessageId, isReasonModeActive }: ChatDisplayProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use setTimeout to ensure scroll happens after DOM is updated
    const timerId = setTimeout(() => {
      endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
    }, 0);

    // Cleanup the timeout if messages change before it fires or component unmounts
    return () => clearTimeout(timerId);
  }, [JSON.stringify(messages)]); // Use JSON.stringify to create a stable dependency

  return (
    <>
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* For IE, Edge and Firefox */
        .hide-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
      <div className="w-full max-w-5xl mx-auto px-4 pt-4 pb-2 flex-grow flex flex-col overflow-y-auto hide-scrollbar">
        {messages.map((msg) => (
          <ChatBubble 
            key={msg.id} 
            message={msg} 
            theme={theme} 
            onDeleteMessage={onDeleteMessage} // Pass down the handler from props
            onConfirmEdit={onConfirmEdit} // Pass down the new handler
            onRegenerateResponse={onRegenerateResponse} // Pass down the handler from props
            onCopyMessage={onCopyMessage} // Pass down the copy handler
            isAiGenerating={isAiTyping && streamingAiMessageId === msg.id} // Pass down isAiGenerating
            isReasoning={isReasonModeActive} // Pass down reason mode
          />
        ))}
        <div ref={endOfMessagesRef} /> {/* Invisible element to scroll to */}
      </div>
    </>
  );
} 