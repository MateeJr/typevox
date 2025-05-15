"use client"; // Ensure this is at the top if not already

import { useState, ChangeEvent, useEffect, useRef, use } from "react";
import { useRouter } from 'next/navigation'; // Added for navigation
import Image from "next/image";
import SideBar from "@/components/SideBar"; // Assuming components are in src/components
import HeaderBar from "@/components/HeaderBar"; // Import the new HeaderBar
import ThemeToggle from "@/components/ThemeToggle"; // Import ThemeToggle
import TextArea, { ProcessedImage } from "@/components/TextArea"; // Import TextArea and ProcessedImage
import ChatDisplay from "@/components/ChatDisplay"; // Import ChatDisplay
import { Message, MessageImage } from "@/components/ChatBubble"; // Import Message type
import { v4 as uuidv4 } from 'uuid'; // For generating unique message IDs
import ToastNotification from "@/components/ToastNotification"; // Import ToastNotification
import { getGeminiResponse } from "../../../../geminiService"; // Adjust path as needed
import { Content } from "@google/generative-ai"; // Import Content
import Cookies from 'js-cookie'; // Import js-cookie

// Helper function to format messages for Gemini
const formatMessagesForGemini = (messages: Message[]): Content[] => {
  return messages
    .filter(msg => !msg.cancelled && msg.text.trim() !== '') // Ensure message is not cancelled and has content
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }], // Assuming text-only for history
    }));
};

// This will be the new dynamic page for individual chats
export default function ChatPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise); // Unwrap the promise using React.use()
  const chatId = params.id;
  const router = useRouter(); // For navigation

  // Helper function to get initial theme (client-side only)
  const getInitialTheme = (): 'light' | 'dark' => {
    // Always return a default theme for the initial server-side render
    // The actual theme will be applied on the client after hydration
    return 'light'; // Default to light for consistent server rendering
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [inputValue, setInputValue] = useState("");
  const [chatActive, setChatActive] = useState(false); // Will likely be true by default if messages load
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingAiMessageId, setStreamingAiMessageId] = useState<string | null>(null); // Added for streaming
  const aiResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialChat = useRef(false); // To prevent saving an empty chat on first load before messages are fetched
  const [isLoadingChat, setIsLoadingChat] = useState(true); // Added loading state
  const [isReasonModeActive, setIsReasonModeActive] = useState(false); // Added for reason toggle
  const [searchUIMode, setSearchUIMode] = useState<'auto' | 'on' | 'off'>('auto'); // For detailed search mode
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
      document.documentElement.className = theme; // Apply theme class to <html> (e.g., for tailwind dark mode via class)
      Cookies.set('theme', theme, { expires: 365 }); // Save/update cookie
    }
  }, [theme, mounted]); // Run whenever theme state changes and after mounting

  // Function to save chat messages
  const saveChat = async (currentChatId: string, currentMessages: Message[], currentSettings: { isReasonModeActive: boolean, searchUIMode: 'auto' | 'on' | 'off' }) => {
    if (!currentChatId || (currentMessages.length === 0 && !hasLoadedInitialChat.current) ){
        // Avoid saving if chatId is not yet available or if it's an empty array for an existing chat that hasn't loaded
        // Or if messages are empty and it's NOT a new chat (hasLoadedInitialChat is true)
        if (currentMessages.length === 0 && hasLoadedInitialChat.current && !isLoadingChat) return;
        // Allow saving empty messages for a brand new chat (hasLoadedInitialChat is false)
        if (currentMessages.length === 0 && !hasLoadedInitialChat.current && !isLoadingChat) { /* allow */ }
        else if (currentMessages.length === 0) return;
    }
    try {
      await fetch('/api/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: currentChatId, messages: currentMessages, settings: currentSettings }),
      });
      // console.log('Chat saved');
    } catch (error) {
      console.error("Failed to save chat:", error);
    }
  };

  // useEffect to load chat messages on component mount
  useEffect(() => {
    const loadChat = async () => {
      if (!chatId) {
        setIsLoadingChat(false);
        hasLoadedInitialChat.current = true; // Mark as loaded even if no chatId (should be rare due to redirect)
        return;
      }
      setIsLoadingChat(true);
      try {
        const response = await fetch(`/api/chat/${chatId}`);
        if (response.ok) {
          const data = await response.json(); // Expect { messages: Message[], settings: {...} }
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            setChatActive(true); 
          }
          // Set toggle states from loaded settings, defaulting to false if not present
          setIsReasonModeActive(data.settings?.isReasonModeActive ?? false);
          setSearchUIMode(data.settings?.searchUIMode ?? 'auto'); // Default to 'auto'
        } else {
          // Handle case where chat doesn't exist (e.g., new chat ID in URL)
          // No messages to load, so it's a new chat.
          setMessages([]);
          // Default settings for a new or non-existent chat
          setIsReasonModeActive(false);
          setSearchUIMode('auto');
        }
      } catch (error) {
        console.error("Failed to load chat:", error);
        setMessages([]); // Start fresh if loading fails
      }
      setIsLoadingChat(false);
      hasLoadedInitialChat.current = true; // Mark initial load as complete
    };

    loadChat();
  }, [chatId]); // Rerun when chatId changes (e.g., navigation)

  // useEffect to save chat whenever messages change
  useEffect(() => {
    // Only save if initial chat has been loaded/processed and not currently loading
    if (hasLoadedInitialChat.current && !isLoadingChat) { 
      saveChat(chatId, messages, { isReasonModeActive, searchUIMode });
    }
  }, [messages, chatId, isLoadingChat, isReasonModeActive, searchUIMode]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const addMessage = (text: string, sender: 'user' | 'ai', images?: MessageImage[], cancelled: boolean = false): string => {
    const newMessageId = uuidv4();
    const newMessage: Message = { id: newMessageId, text, sender, images, cancelled };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    return newMessageId;
  };

  const updateAIMessageChunk = (messageId: string, chunk: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, text: msg.text + chunk, cancelled: false } // Ensure not cancelled while streaming
          : msg
      )
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return prevMessages; // Message not found

      const messageToDelete = prevMessages[messageIndex];

      // If a user message is deleted, remove it and all subsequent messages.
      if (messageToDelete.sender === 'user') {
        return prevMessages.slice(0, messageIndex);
      }
      
      // If an AI message is deleted, only remove that message.
      // (The previous logic for deleting user + subsequent AI is now covered by the above)
      return prevMessages.filter(msg => msg.id !== messageId);
    });
  };

  const handleConfirmEdit = async (messageId: string, newText: string) => {
    let precedingUserMessageText = ""; // To store the text for triggering AI
    let historyForGemini: Content[] = [];

    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1 || prevMessages[messageIndex].sender !== 'user') {
        return prevMessages; // Should not happen if called correctly
      }

      // Create the updated message object
      const updatedMessage = { 
        ...prevMessages[messageIndex], 
        text: newText 
      };
      precedingUserMessageText = newText; // Store the new text

      const messagesUpToEdit = prevMessages.slice(0, messageIndex);
      historyForGemini = formatMessagesForGemini(messagesUpToEdit);

      // Return messages up to and including the edited one
      return [...messagesUpToEdit, updatedMessage]; 
    });

    // Trigger AI response based on the new text
    if (precedingUserMessageText) {
      // Stop any ongoing generation first
      if (aiResponseTimeoutRef.current) {
          clearTimeout(aiResponseTimeoutRef.current);
          aiResponseTimeoutRef.current = null;
      }
      setIsAiTyping(true); // Should be set before adding placeholder AI message

      // Similar logic to handleSendMessage or handleRegenerateResponse
      const newAiMessageId = addMessage("", 'ai'); // Add placeholder for AI response
      setStreamingAiMessageId(newAiMessageId);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        for await (const chunk of getGeminiResponse(historyForGemini, precedingUserMessageText, signal)) {
          updateAIMessageChunk(newAiMessageId, chunk);
        }
      } catch (error) {
        console.error("Error getting Gemini response in handleConfirmEdit:", error);
         if ((error as Error).message === "CANCELLED") {
          // Already handled in handleStopGenerating or similar, ensure UI updates if needed.
          // The message might be left as "AI Message Cancelled" or similar by handleStopGenerating
          return; 
        }
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === newAiMessageId
              ? { ...msg, text: "Sorry, I couldn't generate a response. Please try again.", cancelled: true }
              : msg
          )
        );
      } finally {
        setIsAiTyping(false);
        setStreamingAiMessageId(null);
        if (aiResponseTimeoutRef.current) { 
            clearTimeout(aiResponseTimeoutRef.current);
            aiResponseTimeoutRef.current = null;
        }
      }
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastInfo({ message: "Copied!", show: true });
    } catch (err) {
      console.error("Failed to copy message: ", err);
      setToastInfo({ message: "Failed to copy!", show: true }); // Optional: show error toast
    }
  };

  const handleRegenerateResponse = async (aiMessageIdToRegenerate: string) => {
    const aiMessageIndex = messages.findIndex(msg => msg.id === aiMessageIdToRegenerate);

    if (aiMessageIndex === -1 || messages[aiMessageIndex].sender !== 'ai') return;
    if (aiMessageIndex === 0) return; // Cannot regenerate if AI message is the first message

    const precedingUserMessage = messages[aiMessageIndex - 1];
    if (precedingUserMessage.sender !== 'user') return; // Should be a user message

    // Stop any ongoing AI generation
    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
      aiResponseTimeoutRef.current = null;
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController(); // Create a new AbortController for this request
    const { signal } = abortControllerRef.current;

    // Determine thinking budget based on reason mode
    const thinkingBudget = isReasonModeActive ? 8192 : 0;

    // setIsAiTyping(false); // Should be set to true before new AI message placeholder

    // Messages up to the one *before* the precedingUserMessage will form the history.
    // The precedingUserMessage.text will be the new prompt.
    const historyMessages = messages.slice(0, aiMessageIndex - 1);
    const formattedHistory = formatMessagesForGemini(historyMessages);
    
    // Set messages to be up to the preceding user message (which contains the prompt)
    setMessages(prevMessages => prevMessages.slice(0, aiMessageIndex)); 
    setIsAiTyping(true); // Set before adding new AI message

    const newAiMessageId = addMessage("", 'ai'); 
    setStreamingAiMessageId(newAiMessageId);

    try {
      for await (const chunk of getGeminiResponse(formattedHistory, precedingUserMessage.text, signal, thinkingBudget)) {
        updateAIMessageChunk(newAiMessageId, chunk);
      }
    } catch (error) {
      console.error("Error getting Gemini response in handleRegenerateResponse:", error);
      
      // Check if this was a cancellation
      if ((error as Error).message === "CANCELLED") {
        // Already handled in handleStopGenerating, no need to update the message again
        return;
      }
      
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === newAiMessageId
            ? { ...msg, text: "Sorry, I couldn't regenerate the response. Please try again.", cancelled: true }
            : msg
        )
      );
    } finally {
      setIsAiTyping(false);
      setStreamingAiMessageId(null);
      if (aiResponseTimeoutRef.current) { 
          clearTimeout(aiResponseTimeoutRef.current);
          aiResponseTimeoutRef.current = null;
      }
    }
  };

  const handleSendMessage = async (text: string, images?: ProcessedImage[]) => {
    if ((text.trim() === "" && (!images || images.length === 0)) || isAiTyping) return;

    const currentInput = text; // Use the text parameter
    const currentMessages = messages; // Capture current messages state BEFORE adding new user message

    addMessage(currentInput, 'user', images); // Pass images to addMessage
    setIsAiTyping(true);
    
    if (!chatActive && messages.length === 0) { 
      setChatActive(true);
    }
    setInputValue(""); // Clear the input field state

    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); 
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Determine thinking budget based on reason mode
    const thinkingBudget = isReasonModeActive ? 8192 : 0;

    // Format history from messages *before* the current user input
    const formattedHistory = formatMessagesForGemini(currentMessages);

    const newAiMessageId = addMessage("", 'ai'); 
    setStreamingAiMessageId(newAiMessageId); 

    try {
      for await (const chunk of getGeminiResponse(formattedHistory, currentInput, signal, thinkingBudget)) {
        updateAIMessageChunk(newAiMessageId, chunk);
      }
    } catch (error) {
      console.error("Error getting Gemini response in handleSendMessage:", error);
      
      // Check if this was a cancellation
      if ((error as Error).message === "CANCELLED") {
        // Already handled in handleStopGenerating, no need to update the message again
        return;
      }
      
      // Update the streaming message with an error
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === newAiMessageId
            ? { ...msg, text: "Sorry, I couldn't get a response. Please try again.", cancelled: true }
            : msg
        )
      );
    } finally {
      setIsAiTyping(false);
      setStreamingAiMessageId(null); // Clear the streaming ID
      if (aiResponseTimeoutRef.current) { 
          clearTimeout(aiResponseTimeoutRef.current);
          aiResponseTimeoutRef.current = null;
      }
    }
  };

  const handleStopGenerating = () => {
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
    // The getGeminiResponse stream doesn't have a built-in cancel. 
    // This will stop appending chunks to the UI and mark the message.
    if (streamingAiMessageId) {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === streamingAiMessageId
            ? { ...msg, text: "AI Message Cancelled", cancelled: true }
            : msg
        )
      );
      setStreamingAiMessageId(null); // Clear the ID as we've handled it
    } else {
      // Fallback if no specific streaming message ID, though this case should be rare with new logic
      addMessage("AI Response cancelled", 'ai', undefined, true);
    }
  };

  const handleNewChat = () => {
    if (isAiTyping) {
      // Current chat (with ID) will save its "cancelled" state via useEffect on messages update.
      handleStopGenerating();
    }
    
    // Cancel any ongoing request before redirecting
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsReasonModeActive(false); // Reset reason mode on new chat
    router.push('/'); // Navigate to the root page for a fresh chat
  };

  const pageBgColor = theme === 'light' ? "bg-white" : "bg-black";
  const titleColor = theme === 'light' ? "text-neutral-800" : "text-neutral-200";

  // If messages are loaded, chat should be considered active for layout purposes
  const isChatLayoutActive = chatActive || messages.length > 0;

  const centralContainerPosition = isChatLayoutActive 
    ? "translate-y-0 bottom-6"
    : "top-1/2 -translate-y-1/2";
  const centralContainerBaseClasses = `fixed left-1/2 -translate-x-1/2 w-full flex flex-col items-center z-1 pointer-events-none transition-all duration-500 ease-in-out`;

  const chatDisplayPaddingBottom = isChatLayoutActive ? "pb-[170px]" : "pb-4";

  // Conditional rendering for loading state
  if (isLoadingChat && !hasLoadedInitialChat.current) { // Show loading only on initial load
    // During server-side rendering and initial client render, always use light theme for consistency
    // This prevents hydration mismatch
    const loadingBgColor = mounted ? (theme === 'dark' ? 'bg-black' : 'bg-white') : 'bg-white';
    const loadingTextColor = mounted ? (theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800') : 'text-neutral-800';
    
    return (
      <div className={`h-screen flex items-center justify-center ${loadingBgColor}`}>
        <p className={`${loadingTextColor}`}>Loading chat...</p>
      </div>
    );
  }

  return (
    <>
      <HeaderBar theme={theme} toggleTheme={toggleTheme} /> 
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
            // This title should ideally not show if a chat ID exists and messages are just empty.
            // It's more for the truly new chat state on the root page.
            // For /chat/[id] with no messages, it just means an empty loaded chat.
            <h2 className={`text-3xl font-semibold ${titleColor} mb-6 text-center transition-colors duration-300 ease-in-out`}>
                Chat not Found.
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