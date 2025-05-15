"use client";

import React, { useEffect, useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid'; // Using a solid icon for the toast

interface ToastNotificationProps {
  message: string;
  show: boolean;
  onClose: () => void; // To allow parent to know when toast is hiding due to timeout
  duration?: number;
}

export default function ToastNotification({ 
  message, 
  show, 
  onClose,
  duration = 2000 // Default duration 2 seconds
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose(); // Notify parent after animation would typically finish
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false); // Instantly hide if show becomes false externally
    }
  }, [show, duration, onClose]);

  // Base classes for the toast
  const toastBaseClasses = "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 rounded-lg shadow-2xl flex items-center space-x-3 z-50 transition-all duration-300 ease-in-out";
  
  // Theme for a success toast (can be expanded for error, info, etc.)
  const successThemeClasses = "bg-green-600 text-white"; // Premium green

  // Animation classes
  const animationClasses = isVisible 
    ? "opacity-100 scale-100" // Enter animation
    : "opacity-0 scale-90";   // Exit animation

  if (!show && !isVisible) { // Don't render if not supposed to be shown and already hidden
    return null;
  }
  
  return (
    <div 
      className={`${toastBaseClasses} ${successThemeClasses} ${animationClasses}`}
      role="alert"
    >
      <CheckCircleIcon className="h-6 w-6" />
      <span>{message}</span>
    </div>
  );
} 