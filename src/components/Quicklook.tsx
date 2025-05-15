import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

export interface QuicklookImage {
  name: string;
  previewUrl?: string; // For staged images
  base64Data?: string; // For chat images
}

interface QuicklookProps {
  open: boolean;
  onClose: () => void;
  image?: QuicklookImage;
  alt?: string;
}

const Quicklook: React.FC<QuicklookProps> = ({ open, onClose, image, alt }) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsAnimatingOut(false);
      // Prevent body scrolling when Quicklook is open
      document.body.style.overflow = 'hidden';
    } else if (isVisible) {
      // Start exit animation
      setIsAnimatingOut(true);
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, 200); // Match this with the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [open, isVisible]);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  const handleClose = () => {
    setIsAnimatingOut(true);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 150);
  };

  if (!isVisible || !image) return null;

  // Use either previewUrl or base64Data depending on what's available
  const imageUrl = image.previewUrl || image.base64Data;
  if (!imageUrl) return null;

  const content = (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-[999] flex items-center justify-center backdrop-blur-md transition-all duration-200 ease-in-out
        ${isAnimatingOut 
          ? 'opacity-0 backdrop-blur-none' 
          : 'opacity-100'} 
        bg-black/60`}
      onClick={e => {
        if (e.target === backdropRef.current) handleClose();
      }}
    >
      <div 
        className={`relative bg-white/90 dark:bg-neutral-900/90 rounded-2xl shadow-2xl p-4 max-w-full max-h-[90vh] 
          flex flex-col items-center backdrop-blur-sm transition-all duration-200 ease-in-out
          ${isAnimatingOut 
            ? 'opacity-0 scale-95' 
            : 'opacity-100 scale-100'}`}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white dark:text-neutral-200 z-10 transition-colors"
          aria-label="Close preview"
        >
          <FiX size={22} />
        </button>
        <img
          src={imageUrl}
          alt={alt || image.name}
          className="max-h-[75vh] max-w-[85vw] rounded-xl object-contain border border-gray-200/60 dark:border-neutral-700/60"
        />
        <div className="mt-3 text-sm text-center text-gray-700 dark:text-neutral-200 font-outfit-normal truncate max-w-[80vw]">
          {image.name}
        </div>
      </div>
    </div>
  );

  // Use createPortal to render directly to the document body
  return createPortal(content, document.body);
};

export default Quicklook; 