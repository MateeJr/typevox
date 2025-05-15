"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FiMenu, FiX, FiEdit, FiTrash2 } from "react-icons/fi"; // Added FiTrash2
import Tooltip from './Tooltip'; // Added Tooltip import
import { useRouter, usePathname } from 'next/navigation'; // Added useRouter and usePathname
import ConfirmationDialog from './ConfirmationDialog'; // Import the new dialog

interface ChatListItem {
  id: string;
  title: string;
  lastModified: number;
}

interface GroupedChats {
  [groupName: string]: ChatListItem[];
}

interface SideBarProps {
  theme: 'light' | 'dark';
  onNewChat: () => void; // Added onNewChat prop
}

// Helper function to categorize chats by date
const getChatGroup = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (date.toDateString() === now.toDateString()) return "Today";
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  if (diffDays <= 7) return "Previous 7 Days";
  if (diffDays <= 30) return "Previous 30 Days";
  return "Older";
};

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"];

export default function SideBar({ theme, onNewChat }: SideBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarWidthClass = "w-64"; // Fixed width: 16rem or 256px
  const router = useRouter();
  const pathname = usePathname(); // To get current chat ID for highlighting

  const [chatHistory, setChatHistory] = useState<ChatListItem[]>([]);
  const [groupedChats, setGroupedChats] = useState<GroupedChats>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null); // Renamed for clarity

  // State for button animation
  const [buttonScaleClass, setButtonScaleClass] = useState("scale-100 opacity-100");
  const [hamburgerPositionClass, setHamburgerPositionClass] = useState("left-4"); // Renamed for clarity
  const [newChatButtonPositionClass, setNewChatButtonPositionClass] = useState("left-16"); // Added for new chat button
  const [isAnimating, setIsAnimating] = useState(false);

  // Updated to use fixed width for button positioning when open
  const hamburgerLeftWhenOpen = `left-[calc(theme('spacing.64')_+_theme('spacing.4'))]`; 
  const hamburgerLeftWhenClosed = "left-4";
  const newChatLeftWhenOpen = `left-[calc(theme('spacing.64')_+_theme('spacing.16'))]`; // Position for new chat button when open
  const newChatLeftWhenClosed = "left-16"; // Position for new chat button when closed

  const buttonAnimationDuration = 100; // Duration for button scale up/down
  const sidebarAnimationDuration = 300; // Duration for sidebar slide (must match CSS)

  const fetchChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/chat/list');
      if (response.ok) {
        const data: ChatListItem[] = await response.json();
        setChatHistory(data);        
        const groups: GroupedChats = {};
        data.forEach(chat => {
          const groupName = getChatGroup(chat.lastModified);
          if (!groups[groupName]) groups[groupName] = [];
          groups[groupName].push(chat);
        });
        setGroupedChats(groups);
      } else {
        console.error("Failed to fetch chat history - API response not OK:", response.status);
        setChatHistory([]); setGroupedChats({});
      }
    } catch (error) {
      console.error("Failed to fetch chat history - Exception:", error);
      setChatHistory([]); setGroupedChats({});
    }
    setIsLoadingHistory(false);
  }, []);

  useEffect(() => { if (isOpen) fetchChatHistory(); }, [isOpen, fetchChatHistory]);
  useEffect(() => { fetchChatHistory(); }, [fetchChatHistory]);

  const toggleSideBar = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    const willOpen = !isOpen;

    // Hide buttons immediately
    setButtonScaleClass("scale-0 opacity-0");

    // Set the sidebar state to start its animation
    setIsOpen(willOpen); // Sidebar animation starts now

    // After the sidebar animation completes, update button positions and make them visible
    setTimeout(() => {
      if (willOpen) {
        setHamburgerPositionClass(hamburgerLeftWhenOpen);
        setNewChatButtonPositionClass(newChatLeftWhenOpen);
      } else {
        setHamburgerPositionClass(hamburgerLeftWhenClosed);
        setNewChatButtonPositionClass(newChatLeftWhenClosed);
      }
      // Make buttons visible again
      setButtonScaleClass("scale-100 opacity-100");
      setIsAnimating(false); // Animation sequence finished
    }, sidebarAnimationDuration);

  }, [
    isOpen,
    isAnimating,
    hamburgerLeftWhenOpen,
    newChatLeftWhenOpen,
    hamburgerLeftWhenClosed,
    newChatLeftWhenClosed,
    sidebarAnimationDuration
    // Note: buttonAnimationDuration is removed from dependencies as it's no longer directly used in this revised logic.
    // State setter functions (setButtonScaleClass, setIsOpen, etc.) have stable identities and don't need to be in the dependency array.
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the sidebar panel AND outside the hamburger button
      // The new chat button is positioned with the hamburger, so this check should cover it implicitly when sidebar is closed.
      // When sidebar is open, both buttons are outside the panel, but clicks on them shouldn't close it.
      const isClickOnHamburger = hamburgerButtonRef.current && hamburgerButtonRef.current.contains(event.target as Node);
      // Assuming newChatButton is always near hamburger and doesn't need its own ref for this check if logic is simplified
      // For simplicity, if the click is on any of the control buttons, we don't close.
      // This check might need refinement if the new chat button moves independently in a complex way.

      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && !isClickOnHamburger) {
         // A more robust check for the new chat button might involve giving it a ref too and checking here.
         // For now, let's assume the new chat button click events are handled by its own onClick, and this
         // effect is primarily for clicks on the document body / overlay.
        if (isOpen) {
          // Check if the target is one of the control buttons that should NOT close the sidebar
          // This part can be tricky if there are multiple external controls.
          // The primary intent is: click outside the *panel* closes it, unless it's on a button meant to control the panel.
          toggleSideBar();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, toggleSideBar]); // Removed sidebarRef and hamburgerButtonRef from dependencies

  // Conditional styles based on theme
  const sidebarBgColor = theme === 'light' ? 'bg-gray-200' : 'bg-neutral-900'; // Darker: bg-neutral-900
  const sidebarTextColor = theme === 'light' ? 'text-gray-900' : 'text-gray-100';
  const buttonBgColor = theme === 'light' ? 'bg-neutral-50' : 'bg-neutral-800'; // Darker: bg-neutral-800
  const buttonHoverBgColor = theme === 'light' ? 'hover:bg-neutral-300' : 'hover:bg-neutral-700'; // Darker hover: hover:bg-neutral-700
  const buttonIconColor = theme === 'light' ? 'text-black' : 'text-gray-200'; // Or specific color for dark mode icons
  const listItemHoverBg = theme === 'light' ? 'hover:bg-gray-300' : 'hover:bg-neutral-800';
  const activeListItemBg = theme === 'light' ? 'bg-gray-400' : 'bg-neutral-700'; // Made active slightly more distinct
  const borderColor = theme === 'light' ? 'border-gray-300' : 'border-neutral-700';
  const deleteIconColor = theme === 'light' ? 'text-gray-500 hover:text-red-500' : 'text-neutral-500 hover:text-red-400';

  // Common classes for both buttons
  const commonButtonClasses = `fixed top-4 z-30 p-2 ${buttonBgColor} ${buttonIconColor} rounded-md ${buttonHoverBgColor} transition-transform transition-opacity duration-${buttonAnimationDuration} ease-in-out transition-colors duration-300 ${buttonScaleClass}`;

  const currentChatId = pathname.split('/').pop(); // Extract ID from /chat/ID

  const handleChatNavigation = (chatId: string) => {
    router.push(`/chat/${chatId}`);
    if (isOpen) setTimeout(() => toggleSideBar(), 50); 
  };

  const handleDeleteChat = async (chatIdToDelete: string, event: React.MouseEvent) => {
    event.stopPropagation(); 
    // Optional: Add a confirmation dialog here
    // if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const response = await fetch(`/api/chat/${chatIdToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log(`Chat ${chatIdToDelete} deleted successfully.`);
        // Refresh chat history
        fetchChatHistory(); 

        // If the currently viewed chat is deleted, navigate to the new chat page
        const currentChatIdOnPage = pathname.split('/').pop();
        if (chatIdToDelete === currentChatIdOnPage) {
          router.push('/');
        }
      } else {
        const errorData = await response.json();
        console.error(`Failed to delete chat ${chatIdToDelete}:`, response.status, errorData.error);
        // Optionally, show an error message to the user
      }
    } catch (error) {
      console.error(`Exception while deleting chat ${chatIdToDelete}:`, error);
      // Optionally, show an error message to the user
    }
  };

  const handleClearAllHistory = async () => {
    // // Confirmation dialog - Replaced by custom dialog
    // if (!window.confirm("Are you sure you want to delete ALL chat history? This action cannot be undone.")) {
    //   return;
    // }
    // setShowClearConfirmDialog(false); // Close dialog first

    try {
      const response = await fetch('/api/chat/clear-all', {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log("All chat history deleted successfully.");
        fetchChatHistory(); 
        if (pathname.startsWith("/chat/")) {
            router.push('/');
        }
        if (isOpen) toggleSideBar(); 
      } else {
        const errorData = await response.json();
        console.error("Failed to clear all chat history:", response.status, errorData.error);
      }
    } catch (error) {
      console.error("Exception while clearing all chat history:", error);
    }
    setShowClearConfirmDialog(false); // Ensure dialog is closed after action
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        ref={hamburgerButtonRef} // Use renamed ref
        onClick={toggleSideBar}
        className={`${commonButtonClasses} ${hamburgerPositionClass}`}
        aria-label="Toggle sidebar"
      >
        {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* New Chat Button - Wrapped for correct tooltip positioning */}
      <div className={`${commonButtonClasses} ${newChatButtonPositionClass}`}>
        <Tooltip text="New Chat" theme={theme} preferAbove={false}>
          <button
            onClick={onNewChat}
            className={`w-full h-full flex items-center justify-center bg-transparent border-none focus:outline-none text-inherit rounded-md`} // Added rounded-md to make sure hover effect from parent looks good
            aria-label="New Chat"
          >
            <FiEdit size={24} /> {/* Icon color will be inherited from parent div's text color (buttonIconColor) */}
          </button>
        </Tooltip>
      </div>

      {/* Sidebar Panel */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full ${sidebarBgColor} ${sidebarTextColor} shadow-lg z-20 transform transition-transform duration-${sidebarAnimationDuration} ease-in-out 
                    transition-colors duration-300
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                    ${sidebarWidthClass} flex flex-col`}
      >
        {/* Header for the sidebar */}
        <div className={`px-4 py-3 border-b ${borderColor} flex-shrink-0`}> {/* Adjusted padding and ensure it doesn't shrink */}
          <h2 className={`text-lg font-semibold font-outfit-semibold ${sidebarTextColor}`}>Chat History</h2> {/* Changed title and size */}
        </div>

        {/* List of chat history items */}
        <div className="flex-grow overflow-y-auto p-2 space-y-1"> {/* Added space-y-1 and adjusted padding */}
          {isLoadingHistory ? (
            <p className={`p-3 text-sm text-center ${sidebarTextColor} opacity-75`}>Loading history...</p>
          ) : Object.keys(groupedChats).length === 0 && chatHistory.length === 0 ? (
            <p className={`p-3 text-sm text-center ${sidebarTextColor} opacity-75`}>No chats yet.</p>
          ) : (
            GROUP_ORDER.map(groupName => (
              groupedChats[groupName] && groupedChats[groupName].length > 0 && (
                <div key={groupName} className="mb-2">
                  <h3 className={`px-2.5 pt-2 pb-1 text-xs font-semibold ${theme === 'light' ? 'text-gray-600' : 'text-neutral-400'} font-outfit-semibold`}>{groupName}</h3>
                  {groupedChats[groupName].map((chat) => (
                    <button
                      key={chat.id}
                      onClick={(e) => {
                        handleChatNavigation(chat.id);
                        e.stopPropagation();
                      }}
                      className={`group w-full text-left p-2.5 rounded-lg text-sm truncate flex items-center justify-between
                                  ${sidebarTextColor} 
                                  ${chat.id === currentChatId 
                                    ? activeListItemBg 
                                    : listItemHoverBg}
                                  transition-colors duration-150 ease-in-out cursor-pointer`}
                      title={chat.title}
                    >
                      <span className="truncate">{chat.title}</span>
                      <FiTrash2 
                        size={16} 
                        className={`ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${deleteIconColor} cursor-pointer`}
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                      />
                    </button>
                  ))}
                </div>
              )
            ))
          )}
        </div>

        {/* Footer for Clear All button */}
        {isOpen && chatHistory.length > 0 && (
          <div className={`px-3 py-3 border-t ${borderColor} flex-shrink-0`}>
            <button 
              onClick={() => setShowClearConfirmDialog(true)} // Show custom dialog
              className={`w-full flex items-center justify-center p-2 rounded-md text-sm font-medium 
                          text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900 
                          transition-colors duration-150 ease-in-out cursor-pointer`}
              title="Clear all chat history"
            >
              <FiTrash2 className="mr-2 h-4 w-4" /> {/* Using FiTrash2 for consistency, could be specific clear icon */}
              Clear All History
            </button>
          </div>
        )}
      </div>

      {/* Custom Confirmation Dialog for Clearing History */}
      <ConfirmationDialog
        isOpen={showClearConfirmDialog}
        title="Clear All Chat History?"
        message="Are you sure you want to delete ALL chat history? This action cannot be undone."
        onConfirm={handleClearAllHistory} // Updated: This will now directly call the API part
        onCancel={() => setShowClearConfirmDialog(false)}
        confirmButtonText="Yes, Clear All"
        theme={theme}
      />

      {/* Overlay for content when sidebar is open (for mobile, and now also helps with click outside logic for consistency if it were visible) */}
      {isOpen && (
        <div
          onClick={toggleSideBar} // This existing overlay can also trigger close, mainly for mobile UX
          className="fixed inset-0 bg-black opacity-50 z-10 md:hidden"
        ></div>
      )}
    </>
  );
} 