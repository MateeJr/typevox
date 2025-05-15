"use client";

import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'; // Using a solid icon

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
  theme?: 'light' | 'dark'; // Optional theme prop for styling consistency
}

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  theme = "light", // Default to light theme
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const bgColor = theme === 'light' ? 'bg-white' : 'bg-neutral-800';
  const textColor = theme === 'light' ? 'text-neutral-700' : 'text-neutral-200';
  const titleColor = theme === 'light' ? 'text-neutral-900' : 'text-white';
  const confirmButtonBase = "px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 cursor-pointer";
  const confirmButtonTheme = theme === 'light' 
    ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
    : "bg-red-700 text-white hover:bg-red-800 focus:ring-red-600";
  const cancelButtonTheme = theme === 'light'
    ? "bg-neutral-200 text-neutral-800 hover:bg-neutral-300 focus:ring-neutral-400"
    : "bg-neutral-600 text-neutral-100 hover:bg-neutral-500 focus:ring-neutral-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 transition-opacity duration-300 ease-in-out animate-fade-in">
      <div 
        className={`relative ${bgColor} p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out animate-scale-in`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogTitle"
        aria-describedby="dialogMessage"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-4 text-left">
            <h3 id="dialogTitle" className={`text-lg font-semibold leading-6 ${titleColor}`}>
              {title}
            </h3>
            <div className="mt-2">
              <p id="dialogMessage" className={`text-sm ${textColor}`}>
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-3 sm:space-x-reverse">
          <button
            type="button"
            className={`${confirmButtonBase} ${confirmButtonTheme} w-full sm:w-auto`}
            onClick={onConfirm}
          >
            {confirmButtonText}
          </button>
          <button
            type="button"
            className={`${confirmButtonBase} ${cancelButtonTheme} w-full sm:w-auto`}
            onClick={onCancel}
          >
            {cancelButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add some basic CSS animations (can be in a global CSS file or Tailwind config)
// For Tailwind, you might define these in tailwind.config.js
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.3s ease-out forwards; }
*/ 