"use client";

import React, { useState, ChangeEvent, KeyboardEvent, useRef, ClipboardEvent, useEffect, useCallback } from 'react';
import { FiSend, FiPlus, FiGlobe, FiBarChart2, FiSquare, FiXCircle, FiMaximize2, FiMinimize2, FiCheck, FiX } from 'react-icons/fi'; // Replaced FiSearch with FiGlobe
import Tooltip from './Tooltip'; // Import the Tooltip component
import { v4 as uuidv4 } from 'uuid'; // For unique IDs for staged images
import Quicklook from './Quicklook';

// Define a type for staged images (File object + preview data URL + local ID)
interface StagedImageFile {
  id: string; // Local unique ID for key prop and deletion
  file: File;
  name: string;
  previewUrl: string; // Data URL for <img src>
}

export interface ProcessedImage { // Renaming for clarity, to be passed up
  name: string;
  base64Data: string;
}

interface TextAreaProps {
  theme: 'light' | 'dark';
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (text: string, images?: ProcessedImage[]) => void;
  chatActive: boolean;
  isAiTyping: boolean;
  onStopGenerating: () => void;
  onReasonToggleChange?: (isReasonToggled: boolean) => void;
  initialReasonMode?: boolean;
  initialSearchUIMode?: 'auto' | 'on' | 'off';
  onSearchUIModeChange?: (mode: 'auto' | 'on' | 'off') => void;
  autoFocus?: boolean; // New prop to control autofocus behavior
}

export default function TextArea({ theme, value, onChange, onSubmit, chatActive, isAiTyping, onStopGenerating, onReasonToggleChange, initialReasonMode = false, initialSearchUIMode = 'auto', onSearchUIModeChange, autoFocus = true }: TextAreaProps) {
  const [reasonToggled, setReasonToggled] = useState(initialReasonMode);
  const [isTextAreahovered, setIsTextAreaHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaContainerRef = useRef<HTMLDivElement>(null); // Ref for the main container
  const [stagedImages, setStagedImages] = useState<StagedImageFile[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false); // State for textarea scrollability
  const textareaScrollableRef = useRef<HTMLTextAreaElement>(null);
  const [searchMode, setSearchMode] = useState<'auto' | 'on' | 'off'>(initialSearchUIMode); // Use new prop
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false); // Dropdown open state
  const searchButtonRef = useRef<HTMLButtonElement>(null); // Ref for click outside
  const searchDropdownContainerRef = useRef<HTMLDivElement>(null); // Ref for button+dropdown
  const [quicklookOpen, setQuicklookOpen] = useState(false);
  const [quicklookImage, setQuicklookImage] = useState<StagedImageFile | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for autofocus functionality

  // Focus the textarea when AI stops typing
  useEffect(() => {
    if (!isAiTyping && autoFocus && textareaRef.current && chatActive) {
      // Small delay to ensure the UI is fully updated
      const focusTimeout = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(focusTimeout);
    }
  }, [isAiTyping, autoFocus, chatActive]);

  useEffect(() => {
    // Check for mobile environment (coarse pointer) once on component mount
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);

    const setDynamicVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--dynamic-vh', `${vh}px`);
    };
    window.addEventListener('resize', setDynamicVh);
    setDynamicVh(); // Initial set

    // Click outside to collapse logic
    const handleClickOutside = (event: MouseEvent) => {
      // Ensure the click is outside the referenced container and not on the expand/collapse button itself.
      // The expand/collapse button is inside the container, so checking container is enough unless it has overlays.
      if (textAreaContainerRef.current && !textAreaContainerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('resize', setDynamicVh);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]); // Added isExpanded to dependency array for click outside logic

  // Effect to check if textarea is scrollable when not expanded
  useEffect(() => {
    if (!isExpanded && textareaScrollableRef.current) {
      const el = textareaScrollableRef.current;
      setIsScrollable(el.scrollHeight > el.clientHeight);
    } else if (isExpanded) {
      // When expanded, we don't need the scrollable check for button visibility,
      // as the minimize button should always show. Reset isScrollable if needed.
      setIsScrollable(false); 
    }
  }, [value, stagedImages, isExpanded]); // Check on value, stagedImages, or expansion change

  // Effect for custom scrollbar styling, theme-dependent
  useEffect(() => {
    const scrollbarStyleId = 'custom-textarea-scrollbar-style';
    let styleTag = document.getElementById(scrollbarStyleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = scrollbarStyleId;
      document.head.appendChild(styleTag);
    }

    const scrollbarThumbColor = theme === 'light' ? '#cbd5e1' : '#404040'; // slate-300 : neutral-700
    const scrollbarTrackColor = theme === 'light' ? '#f1f5f9' : '#171717'; // slate-100 : neutral-900
    
    // Use a unique class for the textarea to target scrollbar styles precisely
    const uniqueTextareaClass = "custom-scrollbar-textarea";
    if (textareaScrollableRef.current && !textareaScrollableRef.current.classList.contains(uniqueTextareaClass)) {
      textareaScrollableRef.current.classList.add(uniqueTextareaClass);
    }

    styleTag.textContent = `
      .${uniqueTextareaClass}::-webkit-scrollbar {
        width: 8px;
      }
      .${uniqueTextareaClass}::-webkit-scrollbar-track {
        background: ${scrollbarTrackColor};
        border-radius: 4px;
      }
      .${uniqueTextareaClass}::-webkit-scrollbar-thumb {
        background: ${scrollbarThumbColor};
        border-radius: 4px;
      }
      .${uniqueTextareaClass}::-webkit-scrollbar-thumb:hover {
        background: ${theme === 'light' ? '#94a3b8' : '#525252'}; /* slate-400 : neutral-600 */
      }
      /* For Firefox */
      .${uniqueTextareaClass} {
        scrollbar-width: thin;
        scrollbar-color: ${scrollbarThumbColor} ${scrollbarTrackColor};
      }
    `;

    return () => {
      // Optional: remove the class from textarea if it unmounts, though not strictly necessary
      // if (textareaScrollableRef.current && textareaScrollableRef.current.classList.contains(uniqueTextareaClass)) {
      //   textareaScrollableRef.current.classList.remove(uniqueTextareaClass);
      // }
      // Do not remove the style tag here, as other instances might use it.
      // Or manage it with a ref count if multiple TextAreas could exist with different themes simultaneously.
      // For a single TextArea, it's fine.
    };
  }, [theme]); // Rerun when theme changes

  // Click outside to close search dropdown
  useEffect(() => {
    if (!searchDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        searchDropdownContainerRef.current &&
        !searchDropdownContainerRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchDropdownOpen]);

  // Define colors based on theme
  const bgColor = theme === 'light' ? 'bg-white' : 'bg-neutral-800';
  const borderColor = theme === 'light' ? 'border-gray-300' : 'border-neutral-700';
  const textColor = theme === 'light' ? 'text-gray-700' : 'text-neutral-300';
  const placeholderColor = theme === 'light' ? 'placeholder-gray-400' : 'placeholder-neutral-500';
  const sendButtonIconColor = theme === 'light' ? 'text-gray-600' : 'text-neutral-400';
  const sendButtonHoverBg = theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700';
  const actionButtonTextColor = theme === 'light' ? 'text-gray-700' : 'text-neutral-200';
  const actionButtonBorderColor = theme === 'light' ? 'border-gray-300' : 'border-neutral-600';
  const actionButtonHoverBg = theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700';

  // Toggled-on styles
  const toggledOnBg = 'bg-sky-500';
  const toggledOnText = 'text-white font-semibold';
  const toggledOnBorder = 'border-sky-500';
  const toggledOnHoverBg = 'hover:bg-sky-600';

  const handleReasonToggle = () => {
    const newReasonState = !reasonToggled;
    setReasonToggled(newReasonState);
    onReasonToggleChange?.(newReasonState);
  };

  // Base classes for action buttons
  const baseActionButtonClasses = "px-3 py-2 rounded-xl border-2 text-sm flex items-center space-x-1 transition-colors duration-150 ease-in-out cursor-pointer";
  const basePlusButtonClasses = "p-2 rounded-xl border-2 flex items-center justify-center transition-colors duration-150 ease-in-out cursor-pointer";

  let shadowClass = 'shadow-none';
  if (isTextAreahovered) {
    shadowClass = theme === 'light' ? 'shadow-xl' : 'dark-mode-shadow-light';
  }

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageProcessingPromises: Promise<StagedImageFile | null>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Adjusted check to be more inclusive for HEIC/HEIF, relying on browser's ability to decode for <img>
      if (file.type.startsWith('image/') || 
          ['image/heic', 'image/heif'].includes(file.type.toLowerCase()) || 
          /\.(heic|heif)$/i.test(file.name) || 
          (file.type === '' && (/\.(heic|heif|png|jpg|jpeg|webp)$/i.test(file.name))) // For files with no type but common extensions
      ) {
        imageProcessingPromises.push(
          new Promise((resolve) => { // Changed reject to resolve(null) for Promise.allSettled like behavior
            const reader = new FileReader();
            reader.onload = (e_reader) => {
              const originalDataUrl = e_reader.target?.result as string;
              if (!originalDataUrl) {
                console.error('FileReader did not produce a data URL for:', file.name);
                resolve(null); // Resolve with null if FileReader fails
                return;
              }

              const img = new window.Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                  console.error('Failed to get canvas context for:', file.name);
                  // Fallback: use original image (no compression)
                  resolve({
                    id: uuidv4(),
                    file,
                    name: file.name,
                    previewUrl: originalDataUrl,
                  });
                  return;
                }
                
                // Use naturalWidth/Height for accurate dimensions
                canvas.width = img.naturalWidth; 
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                
                let compressedPreviewUrl: string;
                const quality = 0.8; // Compression quality

                const originalType = file.type.toLowerCase();

                if (originalType === 'image/png') {
                  try {
                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    if (webpDataUrl && webpDataUrl.startsWith('data:image/webp')) {
                      compressedPreviewUrl = webpDataUrl;
                    } else {
                      compressedPreviewUrl = canvas.toDataURL('image/png'); // Fallback to PNG
                    }
                  } catch (e) {
                    console.warn("Canvas toDataURL('image/webp') failed for PNG, falling back to PNG for file:", file.name, e);
                    compressedPreviewUrl = canvas.toDataURL('image/png');
                  }
                } else if (originalType === 'image/jpeg' || originalType === 'image/webp') {
                  try {
                    compressedPreviewUrl = canvas.toDataURL(originalType, quality);
                  } catch (e) {
                    console.warn(`Canvas toDataURL('${originalType}') failed, using original for file:`, file.name, e);
                    compressedPreviewUrl = originalDataUrl; // Fallback to original
                  }
                } else { // For other types like HEIC/HEIF (if loaded), or unknown image types
                  try {
                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    if (webpDataUrl && webpDataUrl.startsWith('data:image/webp')) {
                      compressedPreviewUrl = webpDataUrl;
                    } else {
                      compressedPreviewUrl = canvas.toDataURL('image/jpeg', quality); // Fallback to JPEG
                    }
                  } catch (e) {
                    console.warn("Canvas toDataURL for other type failed, falling back to JPEG for file:", file.name, e);
                    try {
                        compressedPreviewUrl = canvas.toDataURL('image/jpeg', quality);
                    } catch (e2) {
                        console.error("Critical: Canvas toDataURL for JPEG fallback failed for file:", file.name, e2);
                        compressedPreviewUrl = originalDataUrl; // Last resort fallback
                    }
                  }
                }
                
                resolve({
                  id: uuidv4(),
                  file,
                  name: file.name,
                  previewUrl: compressedPreviewUrl,
                });
              };
              img.onerror = () => {
                console.error(`Failed to load image into <img> for compression: ${file.name}. Using original data URL if available.`);
                resolve({ // Use original if <img> loading fails (e.g. browser can't decode HEIC)
                  id: uuidv4(),
                  file,
                  name: file.name,
                  previewUrl: originalDataUrl, 
                });
              };
              img.src = originalDataUrl;
            };
            reader.onerror = () => {
              console.error(`Failed to read file: ${file.name}`);
              resolve(null); // Resolve with null if FileReader fails
            };
            reader.readAsDataURL(file);
          })
        );
      } else {
        // Not an image type we're trying to process, or doesn't meet criteria
        // console.log("Skipping file (not a targeted image type):", file.name, file.type);
      }
    }

    if (imageProcessingPromises.length > 0) {
        const results = await Promise.all(imageProcessingPromises);
        const successfullyProcessedImages = results.filter(img => img !== null) as StagedImageFile[];
        if (successfullyProcessedImages.length > 0) {
          setStagedImages(prev => [...prev, ...successfullyProcessedImages]);
        }
    }
  };

  const handlePlusButtonClick = () => {
    fileInputRef.current?.click(); // Trigger click on hidden file input
  };

  const handleRemoveStagedImage = (imageIdToRemove: string) => {
    setStagedImages(prev => prev.filter(img => img.id !== imageIdToRemove));
  };

  const handleInternalSubmit = () => {
    // Map stagedImages to the structure expected by onSubmit
    const imagesToSubmit: ProcessedImage[] | undefined = stagedImages.length > 0 
      ? stagedImages.map(img => ({ name: img.name, base64Data: img.previewUrl }))
      : undefined;

    onSubmit(value, imagesToSubmit); // Pass current text value and processed images
    setStagedImages([]); // Clear staged images after submit
    // The parent component (ChatPage/FreshChatPage) is responsible for clearing the text input 'value' via its state
  };
  
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (items) {
      const filesToProcess: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            filesToProcess.push(file);
          }
        }
      }
      if (filesToProcess.length > 0) {
        event.preventDefault(); // Prevent pasting text if images are found
        // Create a FileList-like object to reuse handleFileSelection
        const dataTransfer = new DataTransfer();
        filesToProcess.forEach(file => dataTransfer.items.add(file));
        handleFileSelection(dataTransfer.files);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow Shift+Enter to create a newline by not preventing default
        return;
      }
      // Regular Enter pressed
      if (isMobile) {
        // On mobile, Enter should also just create a newline
        // So, we don't prevent default and don't submit
        return;
      }
      // On Desktop, Enter (without Shift) should submit
      e.preventDefault(); // Prevent newline in textarea
      if (!isAiTyping && (value.trim() !== "" || stagedImages.length > 0)) {
        handleInternalSubmit();
      }
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Base classes for the TextArea root div
  const textAreaBaseClasses = `relative flex flex-col p-3 rounded-3xl ${bgColor} border ${borderColor} transition-all duration-300 ease-in-out`;

  // Conditional classes for the TextArea root div
  const textAreaConditionalClasses = isExpanded
    ? `shadow-2xl w-[calc(100%-2rem)] max-w-2xl max-h-[calc(var(--dynamic-vh,1vh)_*_90_-_6rem)] z-45 overflow-hidden`
    : `mx-auto ${shadowClass} w-full max-w-2xl`;
  
  const expandedTextAreaClasses = isExpanded ? "flex-grow min-h-[100px]" : "";

  const shouldShowExpandButton = isExpanded || isScrollable;

  return (
    <div 
      ref={textAreaContainerRef}
      onMouseEnter={() => setIsTextAreaHovered(true)}
      onMouseLeave={() => setIsTextAreaHovered(false)}
      className={`${textAreaBaseClasses} ${textAreaConditionalClasses}`}
    >
      {/* Expand/Collapse Button */}
      {shouldShowExpandButton && (
        <button 
          onClick={toggleExpand}
          className={`absolute top-3 left-3 p-1 rounded ${theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-neutral-700'} z-50`}
          aria-label={isExpanded ? "Collapse textarea" : "Expand textarea"}
        >
          {isExpanded 
            ? <FiMinimize2 size={18} className={`${textColor} opacity-70`} /> 
            : <FiMaximize2 size={18} className={`${textColor} opacity-70`} />}
        </button>
      )}

      {/* Hidden file input */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileSelection(e.target.files)}
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif" // Specified types
        multiple // Allow multiple image selection
      />

      {/* Staged Images Preview Area */}
      {stagedImages.length > 0 && (
        <div className="mb-2 p-2 border-b border-dashed border-gray-300 dark:border-neutral-700 flex flex-wrap gap-2">
          {stagedImages.map(img => (
            <div key={img.id} className="relative group w-20 h-20 rounded overflow-hidden border border-gray-300 dark:border-neutral-600">
              <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover cursor-pointer" onClick={() => { setQuicklookImage(img); setQuicklookOpen(true); }} />
              <button 
                onClick={() => handleRemoveStagedImage(img.id)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                aria-label="Remove image"
              >
                <FiXCircle size={16} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs truncate px-1 py-0.5">
                {img.name}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`flex items-start w-full ${isExpanded ? 'flex-grow' : 'mb-2'}`}>
        <textarea
          ref={(el) => {
            // Assign to both refs
            textareaScrollableRef.current = el;
            textareaRef.current = el;
          }}
          rows={isExpanded ? 10 : 1}
          placeholder={stagedImages.length > 0 ? "Add a caption..." : "Ask anything"}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={`flex-grow py-3 px-5 bg-transparent ${textColor} ${placeholderColor} 
                     focus:outline-none text-lg resize-none leading-tight 
                     ${expandedTextAreaClasses}`}
          disabled={isAiTyping}
        />
        {/* Send Button with Tooltip */}
        <Tooltip text="Send message" theme={theme} preferAbove={chatActive}>
          <button 
            onClick={isAiTyping ? onStopGenerating : handleInternalSubmit}
            className={`p-3 rounded-full 
                        ${isAiTyping 
                          ? (theme === 'light' ? 'bg-red-100 hover:bg-red-200' : 'bg-red-900 hover:bg-red-800') 
                          : (theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700')} 
                        focus:outline-none transition-colors duration-150 ease-in-out 
                        ${((value.trim() === "" && stagedImages.length === 0) && !isAiTyping) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            aria-label={isAiTyping ? "Stop generation" : "Send message"}
            disabled={!isAiTyping && (value.trim() === "" && stagedImages.length === 0)}
          >
            {isAiTyping ? (
              <FiSquare size={24} className={`${theme === 'light' ? 'text-red-500' : 'text-red-400'} transform`}/>
            ) : (
              <FiSend size={24} className={`${sendButtonIconColor} transform active:scale-90`}/>
            )}
          </button>
        </Tooltip>
      </div>

      <div className="flex items-center space-x-2 px-3 py-1 relative"> {/* Make relative for dropdown positioning */}
        <Tooltip text="Attach files or images" theme={theme} preferAbove={chatActive}>
          <button 
            onClick={handlePlusButtonClick}
            className={`${basePlusButtonClasses} 
                        ${actionButtonBorderColor} ${actionButtonHoverBg}`}
          >
            <FiPlus size={20} className={`${actionButtonTextColor}`} />
          </button>
        </Tooltip>
        {/* Search Button with Dropdown */}
        <div className="relative" ref={searchDropdownContainerRef}>
          <Tooltip text="Search the web" theme={theme} preferAbove={chatActive}>
            <button
              ref={searchButtonRef}
              onClick={() => setSearchDropdownOpen((open) => !open)}
              className={`${baseActionButtonClasses} font-semibold 
                ${searchMode === 'on' ? 'bg-sky-500 text-white border-sky-500 hover:bg-sky-600' :
                  searchMode === 'auto' ? 'bg-blue-100 text-blue-700 border-blue-400 hover:bg-blue-200' :
                  (theme === 'light'
                    ? 'bg-red-100 text-red-600 border-red-400 hover:bg-red-200'
                    : 'bg-red-900 text-red-200 border-red-700 hover:bg-red-800')
                }
              `}
            >
              <FiGlobe size={16} />
              <span className="ml-1">
                {searchMode === 'auto' ? 'Search (A)' :
                 searchMode === 'on' ? 'Search ' : 
                 'Search '}
              </span>
              {searchMode === 'on' && <FiCheck size={14} className="ml-1" />}
              {searchMode === 'off' && <FiX size={14} className="ml-1" />}
            </button>
          </Tooltip>
          {/* Dropdown menu */}
          {searchDropdownOpen && (
            <div className={`absolute left-0 ${chatActive ? 'bottom-full mb-2' : 'mt-2'} min-w-[160px] rounded-xl shadow-xl z-50 
              ${theme === 'light' ? 'bg-white border border-gray-200' : 'bg-neutral-800 border border-neutral-700'}
              animate-fade-in overflow-hidden`}
              style={{animation: 'fadeIn 0.15s'}}
            >
              {[
                { key: 'auto', label: 'Auto', description: 'Context-aware search' },
                { key: 'on', label: 'Always On', description: 'Enable for all messages' },
                { key: 'off', label: 'Always Off', description: 'Disable searching' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { 
                    const newMode = opt.key as 'auto' | 'on' | 'off';
                    setSearchMode(newMode); 
                    onSearchUIModeChange?.(newMode); // Call the new handler
                    setSearchDropdownOpen(false); 
                  }}
                  className={`w-full text-left px-4 py-2 font-outfit-normal text-sm transition-colors duration-150 flex items-center justify-between
                    ${searchMode === opt.key
                      ? (theme === 'light' ? 'bg-sky-100 text-sky-700 font-semibold' : 'bg-sky-900 text-sky-200 font-semibold')
                      : (theme === 'light' ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-neutral-700 text-neutral-200')}
                  `}
                  style={{outline: 'none'}}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className={`text-xs opacity-60 mt-0.5 ${searchMode === opt.key ? 'font-normal' : ''}`}>
                      {opt.description}
                    </span>
                  </div>
                  {searchMode === opt.key && (
                    <FiCheck size={16} className={searchMode === opt.key ? 'text-sky-500' : 'text-gray-400'} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <Tooltip text="Think before responding" theme={theme} preferAbove={chatActive}>
          <button 
            onClick={handleReasonToggle}
            disabled={isAiTyping}
            className={`${baseActionButtonClasses} font-semibold 
                        ${reasonToggled 
                          ? 'bg-sky-500 text-white border-sky-500 hover:bg-sky-600' 
                          : `${actionButtonBorderColor} ${actionButtonHoverBg} ${actionButtonTextColor}`}
                        ${isAiTyping ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
          >
            <FiBarChart2 size={16} /> 
            <span>Reason</span>
          </button>
        </Tooltip>
      </div>

      {/* Quicklook Modal for staged images */}
      <Quicklook 
        open={quicklookOpen} 
        onClose={() => setQuicklookOpen(false)} 
        image={quicklookImage ? { 
          name: quicklookImage.name, 
          previewUrl: quicklookImage.previewUrl 
        } : undefined} 
      />
    </div>
  );
} 