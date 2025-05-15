"use client";

import { FiSun, FiMoon } from 'react-icons/fi';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function ThemeToggle({ theme, toggleTheme }: ThemeToggleProps) {
  // Use a state to control client-side rendering
  const [mounted, setMounted] = useState(false);
  
  // Only show the UI after first render on the client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const lightModeHoverBg = "hover:bg-gray-300";
  const darkModeHoverBg = "hover:bg-neutral-800";
  const hoverBgClass = theme === 'dark' ? darkModeHoverBg : lightModeHoverBg;

  const moonIconClasses = "text-gray-700 hover:text-black";
  const sunIconClasses = "text-neutral-300 hover:text-neutral-100"; // Lighter for dark bg

  // During SSR and first render, return a placeholder with same dimensions
  if (!mounted) {
    return (
      <div className="p-2 rounded-md w-10 h-10"></div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-md focus:outline-none cursor-pointer ${hoverBgClass} transition-colors duration-300 ease-in-out`}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? (
        <FiSun size={24} className={`${sunIconClasses} transition-colors duration-300 ease-in-out`} />
      ) : (
        <FiMoon size={24} className={`${moonIconClasses} transition-colors duration-300 ease-in-out`} />
      )}
    </button>
  );
} 