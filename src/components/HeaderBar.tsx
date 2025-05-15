"use client";

import React from 'react';
import ThemeToggle from './ThemeToggle'; // Import ThemeToggle

interface HeaderBarProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function HeaderBar({ theme, toggleTheme }: HeaderBarProps) {
  // Default to light theme for server-side rendering to ensure consistency
  // Client will hydrate with the correct theme after mounting
  const bgColor = theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-700';

  return (
    <header 
      className={`fixed top-0 left-0 right-0 h-18 ${bgColor} z-5 flex items-center justify-between px-4 transition-colors duration-300 ease-in-out`}
    >
      {/* Left side of Header (e.g., Logo or Title) - currently empty */}
      <div></div>

      {/* Right side of Header - ThemeToggle button */}
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
    </header>
  );
} 