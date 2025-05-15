"use client"; // Ensure this is at the top if not already

import { useState, ChangeEvent, useEffect, useRef } from "react";
import Image from "next/image";
import SideBar from "@/components/SideBar"; // Assuming components are in src/components
import HeaderBar from "@/components/HeaderBar"; // Import the new HeaderBar
import ThemeToggle from "@/components/ThemeToggle"; // Import ThemeToggle
import TextArea, { ProcessedImage } from "@/components/TextArea"; // Import TextArea and ProcessedImage
import ChatDisplay from "@/components/ChatDisplay"; // Import ChatDisplay
import { Message, MessageImage } from "@/components/ChatBubble"; // Import Message and MessageImage types
import { v4 as uuidv4 } from 'uuid'; // For generating unique message IDs
import { useRouter } from 'next/navigation';
import ToastNotification from "@/components/ToastNotification"; // Import ToastNotification
import { getGeminiResponse } from "../../geminiService"; // Corrected path
import Cookies from 'js-cookie'; // Import js-cookie

// This is the main page for starting a new chat
export default function FreshChatPage() {
  const router = useRouter();

  // Helper function to get initial theme (client-side only)
  const getInitialTheme = (): 'light' | 'dark' => {
    // Always return a default theme for the initial server-side render
    // The actual theme will be applied on the client after hydration
    return 'light'; // Default to light for consistent server rendering
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [inputValue, setInputValue] = useState("");
  const [chatActive, setChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingAiMessageId, setStreamingAiMessageId] = useState<string | null>(null); // Added for streaming
  const aiResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null); // To hold ID once generated
  const [isReasonModeActive, setIsReasonModeActive] = useState(false); // Added for reason toggle
  const [searchUIMode, setSearchUIMode] = useState<'auto' | 'on' | 'off'>('auto'); // New state
  const abortControllerRef = useRef<AbortController | null>(null); // Added for request cancellation
  const [mounted, setMounted] = useState(false); // Track if component is mounted

  // Toast State
  const [toastInfo, setToastInfo] = useState<{ message: string; show: boolean }>({ message: "", show: false });

  // Theme persistence useEffects
  
  // First useEffect: Handle initial client-side mounting and theme loading
  useEffect(() => {
    setMounted(true);
    
    // Only access cookies on the client side
    const cookieTheme = Cookies.get('theme') as 'light' | 'dark' | undefined;
    if (cookieTheme) {
      setTheme(cookieTheme);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Second useEffect: Update document class and save to cookie whenever theme state changes
  useEffect(() => {
    if (mounted) { // Only update cookies after mounting to avoid hydration issues
      document.documentElement.className = theme;
      Cookies.set('theme', theme, { expires: 365 }); // Save/update cookie
    }
  }, [theme, mounted]); // Run whenever theme state changes and after mounting

  // Function to save the initial chat messages before redirecting
  const saveInitialChat = async (chatIdToSave: string, messagesToSave: Message[], settingsToSave: { isReasonModeActive: boolean, searchUIMode: 'auto' | 'on' | 'off' }) => {
    if (!chatIdToSave || messagesToSave.length === 0) return;
    try {
      await fetch('/api/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: chatIdToSave, messages: messagesToSave, settings: settingsToSave }),
      });
    } catch (error) {
      console.error("Failed to save initial chat:", error);
      // Potentially handle error, e.g., by not redirecting or showing a message
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const addMessageToState = (text: string, sender: 'user' | 'ai', images?: MessageImage[], cancelled: boolean = false): string => {
    const newMessageId = uuidv4();
    const newMessage: Message = { id: newMessageId, text, sender, images, cancelled };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    return newMessageId; // Return the new message ID
  };

  const updateAIMessageChunkInState = (messageId: string, chunk: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, text: msg.text + chunk, cancelled: false }
          : msg
      )
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return prevMessages; // Message not found

      const messageToDelete = prevMessages[messageIndex];
      let updatedMessages: Message[]; // Explicitly typed

      if (messageToDelete.sender === 'user') {
        // If user's first message is deleted, clear all messages and stop AI if typing
        updatedMessages = [];
        if (isAiTyping && aiResponseTimeoutRef.current) {
          clearTimeout(aiResponseTimeoutRef.current);
          aiResponseTimeoutRef.current = null;
          setIsAiTyping(false);
        }
      } else {
        // If AI message is deleted, just filter it out
        updatedMessages = prevMessages.filter(msg => msg.id !== messageId);
      }
      
      if (updatedMessages.length === 0) {
        setChatActive(false);
        setCurrentChatId(null); 
      }
      return updatedMessages;
    });
  };

  // Renamed from handleEditMessage, adapted for FreshChatPage
  const handleConfirmEdit = (messageId: string, newText: string) => {
    // On FreshChatPage, editing effectively means resubmitting with new text.
    // We expect at most two messages here: user's original, and AI's first response.
    // If user edits their message, we essentially replace it and re-trigger the AI.

    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(msg => msg.id === messageId && msg.sender === 'user');
      if (messageIndex === -1) return prevMessages; // Should be the user's first message
      
      // If AI was typing, stop it
      if (aiResponseTimeoutRef.current) {
        clearTimeout(aiResponseTimeoutRef.current);
        aiResponseTimeoutRef.current = null;
      }
      setIsAiTyping(false);
      setCurrentChatId(null); // Editing resets the pending chat ID generation process
      setInputValue(newText); // Set input value for handleSendMessage to pick up
      
      // Clear existing messages, new interaction will start with edited text
      return []; 
    });
    
    // Call handleSendMessage with the new text. 
    // It will generate a new chat ID, save, and redirect.
    // We need to ensure inputValue is updated before handleSendMessage is called.
    // A slight delay or direct call might be needed if setInputValue is async regarding state update.
    // For now, assuming handleSendMessage will pick up the latest inputValue if called in a subsequent microtask.
    
    // To ensure `inputValue` is set before `handleSendMessage` is called, 
    // we can call `handleSendMessage` in a `useEffect` that depends on `messages` 
    // being empty and `inputValue` having the new text, or more directly call 
    // handleSendMessage, but need to make sure `newText` is what's used.

    // For a more direct approach:
    // Clear messages, set new input value, then trigger send.
    // The setInputValue is done inside the setMessages callback for atomicity before clearing messages.
    // Then we directly call handleSendMessage.
    
    // The setMessages above already clears messages and sets inputValue implicitly by making the user re-type.
    // More accurate: set the input field and let the user press send again. Or, auto-send.
    // For auto-send after edit:
    handleSendMessage(newText, undefined); // Assuming no images on edit for simplicity here
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastInfo({ message: "Copied!", show: true });
    } catch (err) {
      console.error("Failed to copy message (FreshChatPage): ", err);
      setToastInfo({ message: "Failed to copy!", show: true }); // Optional: show error toast
    }
  };

  const handleRegenerateResponse = async (aiMessageId: string) => {
    const aiMessageIndex = messages.findIndex(msg => msg.id === aiMessageId && msg.sender === 'ai');
    if (aiMessageIndex < 1) return; // Needs a preceding user message

    const precedingUserMessage = messages[aiMessageIndex - 1];
    if (precedingUserMessage.sender !== 'user') return;

    // Stop current AI generation if any (though unlikely here as redirect is fast)
    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
      // No need to set to null here as the try/finally in the new Gemini call will do it
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    // Remove the old AI message
    const messagesUpToUser = messages.slice(0, aiMessageIndex -1);
    // Keep only user message in state temporarily before adding new AI response
    setMessages([...messagesUpToUser, precedingUserMessage]); 

    setCurrentChatId(null); // Ensure any pending chatId is cleared, new one on send
    setIsAiTyping(true);
    setChatActive(true); // Ensure chat layout is active

    const newChatIdForRedirect = uuidv4(); // Generate a new chat ID for this regenerated interaction
    setCurrentChatId(newChatIdForRedirect); // Set it for saving

    // Add placeholder for AI response and track its ID
    const newAiMessageId = addMessageToState("", 'ai');
    setStreamingAiMessageId(newAiMessageId);
    let streamedAiText = ""; // Accumulate streamed text

    try {
      // For FreshChatPage, history is empty, userInput is the first prompt.
      for await (const chunk of getGeminiResponse([], precedingUserMessage.text, signal)) {
        streamedAiText += chunk;
        updateAIMessageChunkInState(newAiMessageId, chunk);
      }
      // Save and redirect with the new AI message
      const finalAIMessage: Message = { id: newAiMessageId, text: streamedAiText, sender: 'ai', images: undefined, cancelled: false };
      await saveInitialChat(newChatIdForRedirect, [precedingUserMessage, finalAIMessage], { isReasonModeActive, searchUIMode });
      router.push(`/chat/${newChatIdForRedirect}`);
    } catch (error) {
      console.error("Error getting Gemini response in handleRegenerateResponse (FreshChatPage):", error);
      
      // Check if this was a cancellation
      if ((error as Error).message === "CANCELLED") {
        // Already handled in handleStopGenerating, no need to update the message again
        return;
      }
      
      const errorMessage = "Sorry, I couldn't regenerate the response. Please try again.";
      // Update the streaming message with an error text
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === newAiMessageId
            ? { ...msg, text: errorMessage, cancelled: true }
            : msg
        )
      );
      const errorAIMessage: Message = { id: newAiMessageId, text: errorMessage, sender: 'ai', images: undefined, cancelled: true };
      await saveInitialChat(newChatIdForRedirect, [precedingUserMessage, errorAIMessage], { isReasonModeActive, searchUIMode });
      router.push(`/chat/${newChatIdForRedirect}`);
    } finally {
      setIsAiTyping(false);
      setStreamingAiMessageId(null);
      // aiResponseTimeoutRef is not directly used for Gemini calls, so no need to clear here
    }
  };

  const handleSendMessage = async (text: string, images?: ProcessedImage[]) => {
    if ((text.trim() === "" && (!images || images.length === 0)) || isAiTyping) return;

    const userInput = text; // Use the text parameter
    setInputValue(""); // Clear input immediately

    // This is the first message of a new session
    const newChatId = uuidv4();
    setCurrentChatId(newChatId); // Set it for saving
    setChatActive(true);

    const userMessageId = addMessageToState(userInput, 'user', images); // Pass images here
    const userMessageForSave: Message = { id: userMessageId, text: userInput, sender: 'user', images, cancelled: false };
    
    setIsAiTyping(true);
    if (aiResponseTimeoutRef.current) { 
      clearTimeout(aiResponseTimeoutRef.current);
      // aiResponseTimeoutRef.current = null; // Optional: clear ref immediately
    }

    // Create a new AbortController for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Cancel any previous request
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const newAiMessageId = addMessageToState("", 'ai');
    setStreamingAiMessageId(newAiMessageId);
    let streamedAiText = ""; // Accumulate streamed text

    try {
      // For FreshChatPage, history is empty, userInput is the first prompt.
      for await (const chunk of getGeminiResponse([], userInput, signal)) {
        streamedAiText += chunk;
        updateAIMessageChunkInState(newAiMessageId, chunk);
      }
      const finalAIMessage: Message = { id: newAiMessageId, text: streamedAiText, sender: 'ai', images: undefined, cancelled: false };
      await saveInitialChat(newChatId, [userMessageForSave, finalAIMessage], { isReasonModeActive, searchUIMode });
      router.push(`/chat/${newChatId}`);
    } catch (error) {
      console.error("Error getting Gemini response in handleSendMessage (FreshChatPage):", error);
      
      // Check if this was a cancellation
      if ((error as Error).message === "CANCELLED") {
        // Already handled in handleStopGenerating, no need to update the message again
        return;
      }
      
      const errorMessage = "Sorry, I couldn't get a response. Please try starting a new chat or try again.";
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === newAiMessageId
            ? { ...msg, text: errorMessage, cancelled: true }
            : msg
        )
      );
      const errorAIMessage: Message = { id: newAiMessageId, text: errorMessage, sender: 'ai', images: undefined, cancelled: true };
      await saveInitialChat(newChatId, [userMessageForSave, errorAIMessage], { isReasonModeActive, searchUIMode });
      router.push(`/chat/${newChatId}`);
    } finally {
      setIsAiTyping(false);
      setStreamingAiMessageId(null);
      if (aiResponseTimeoutRef.current) {
        clearTimeout(aiResponseTimeoutRef.current);
        aiResponseTimeoutRef.current = null;
      }
      // Don't clear abortControllerRef here, as it might be needed for cleanup
    }
    setCurrentChatId(null);
    setIsReasonModeActive(false); // Reset reason mode on new chat
    setSearchUIMode('auto'); // Reset search UI mode on new chat
  };

  const handleStopGenerating = () => {
    // For this page, stop just cancels the local AI response for the *first* message.
    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
      aiResponseTimeoutRef.current = null;
    }
    
    // Abort the current request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // Clear the reference
    }
    
    setIsAiTyping(false);
    if (streamingAiMessageId) {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === streamingAiMessageId
            ? { ...msg, text: "AI Message Cancelled", cancelled: true }
            : msg
        )
      );
      // Since this is FreshChatPage, stopping generation before redirect might mean we don't want to save or redirect.
      // Or, we save the partial cancelled response and redirect.
      // For now, just updating the UI state. The redirect happens on successful completion or error in send/regenerate.
      // If user stops, they stay on page with the cancelled message.
      setCurrentChatId(null); // Clear chatId as the interaction is incomplete for a new chat.
      setStreamingAiMessageId(null);
    } 
    // No new message added like "AI Response cancelled" because we modify the existing one.
  };

  const handleNewChat = () => {
    // User is already on the "new chat" page, so just reset local state.
    if (isAiTyping && aiResponseTimeoutRef.current) {
        clearTimeout(aiResponseTimeoutRef.current);
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setMessages([]); 
    setInputValue(""); 
    setChatActive(false);
    setIsAiTyping(false);
    setCurrentChatId(null);
    setIsReasonModeActive(false); // Reset reason mode on new chat
    setSearchUIMode('auto'); // Reset search UI mode on new chat
  };

  const pageBgColor = theme === 'light' ? "bg-white" : "bg-black";
  const titleColor = theme === 'light' ? "text-neutral-800" : "text-neutral-200";
  const isChatLayoutActive = chatActive || messages.length > 0;
  const centralContainerPosition = isChatLayoutActive ? "translate-y-0 bottom-6" : "top-1/2 -translate-y-1/2";
  const centralContainerBaseClasses = `fixed left-1/2 -translate-x-1/2 w-full flex flex-col items-center z-1 pointer-events-none transition-all duration-500 ease-in-out`;
  const chatDisplayPaddingBottom = isChatLayoutActive ? "pb-[170px]" : "pb-4";

  return (
    <>
      <HeaderBar theme={theme} toggleTheme={toggleTheme} /> 
      {/* SideBar's onNewChat on this page will just reset the view */}
      <SideBar theme={theme} onNewChat={handleNewChat} /> 
      <ToastNotification 
        message={toastInfo.message}
        show={toastInfo.show}
        onClose={() => setToastInfo({ message: "", show: false })}
      />
      
      <div 
        className={`h-screen ${pageBgColor} pt-18 overflow-y-auto transition-colors duration-300 ease-in-out flex flex-col ${chatDisplayPaddingBottom}`}
      >
        {messages.length > 0 && <ChatDisplay 
                                    messages={messages} 
                                    theme={theme}
                                    onDeleteMessage={handleDeleteMessage}
                                    onConfirmEdit={handleConfirmEdit}
                                    onRegenerateResponse={handleRegenerateResponse}
                                    onCopyMessage={handleCopyMessage}
                                    isAiTyping={isAiTyping}
                                    streamingAiMessageId={streamingAiMessageId}
                                    isReasonModeActive={isReasonModeActive}
                                  />}
      </div>

      <div className={`${centralContainerBaseClasses} ${centralContainerPosition}`}>
        <div className={`w-full px-4 flex flex-col items-center pointer-events-auto 
                        transition-opacity duration-300 ease-in-out 
                        ${isChatLayoutActive ? 'opacity-0 h-0 invisible' : 'opacity-100 visible'}`}>
         {messages.length === 0 && !isChatLayoutActive && (
            <h2 className={`text-3xl font-semibold ${titleColor} mb-6 text-center transition-colors duration-300 ease-in-out`}>
                What can I help you today?
            </h2>
         )}
        </div>
        
        <div className="w-full px-4 flex flex-col items-center pointer-events-auto">
            <TextArea 
                theme={theme} 
                value={inputValue} 
                onChange={handleInputChange} 
                onSubmit={handleSendMessage}
                chatActive={isChatLayoutActive}
                isAiTyping={isAiTyping}
                onStopGenerating={handleStopGenerating}
                onReasonToggleChange={setIsReasonModeActive}
                initialReasonMode={isReasonModeActive} 
                onSearchUIModeChange={setSearchUIMode}
                initialSearchUIMode={searchUIMode}
            />
        </div>
    </div>
    </>
  );
}
