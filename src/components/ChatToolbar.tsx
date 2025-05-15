"use client";

import React from 'react';
import { PencilSquareIcon, TrashIcon, ArrowPathIcon, DocumentDuplicateIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

interface ChatToolbarProps {
  isUser: boolean;
  theme: 'light' | 'dark';
  onDelete: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
  forceVisible?: boolean;
}

export default function ChatToolbar({ isUser, theme, onDelete, onEdit, onRegenerate, onCopy, isCopied, forceVisible }: ChatToolbarProps) {
  const buttonBaseClasses = "px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity cursor-pointer";
  const lightThemeButtonClasses = "text-neutral-600 hover:bg-neutral-200";
  const darkThemeButtonClasses = "text-neutral-400 hover:bg-neutral-700";

  const themeButtonClasses = theme === 'light' ? lightThemeButtonClasses : darkThemeButtonClasses;

  if (!isUser) {
    return (
      <div className={`flex items-center mt-1 justify-start space-x-1`}>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className={`${buttonBaseClasses} ${themeButtonClasses}`}
            title="Regenerate"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className={`${buttonBaseClasses} ${themeButtonClasses}`}
            title="Copy"
          >
            {isCopied ? <CheckCircleIcon className="h-4 w-4 text-green-500" /> : <DocumentDuplicateIcon className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={onDelete}
          className={`${buttonBaseClasses} ${themeButtonClasses}`}
          title="Delete"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (isUser && forceVisible) {
    return (
      <div className={`flex items-center mt-1 justify-end space-x-1`}>
        {onEdit && (
          <button
            onClick={onEdit}
            className={`${buttonBaseClasses} ${themeButtonClasses}`}
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className={`${buttonBaseClasses} ${themeButtonClasses}`}
            title="Copy"
          >
            {isCopied ? <CheckCircleIcon className="h-4 w-4 text-green-500" /> : <DocumentDuplicateIcon className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={onDelete}
          className={`${buttonBaseClasses} ${themeButtonClasses}`}
          title="Delete"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return <div className="h-[24px] mt-1"></div>;
} 