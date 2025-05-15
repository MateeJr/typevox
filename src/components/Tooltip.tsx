"use client";

import React, { ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  theme: 'light' | 'dark';
  preferAbove?: boolean;
}

export default function Tooltip({ text, children, theme, preferAbove = false }: TooltipProps) {
  const tooltipBgColor = theme === 'light' ? 'bg-white' : 'bg-neutral-800';
  const tooltipTextColor = theme === 'light' ? 'text-neutral-700' : 'text-neutral-100';
  const tooltipBorderColor = theme === 'light' ? 'border-gray-200' : 'border-neutral-700';
  const arrowColor = theme === 'light' ? 'text-white' : 'text-neutral-800';
  const arrowBorderColor = theme === 'light' ? 'text-gray-200' : 'text-neutral-700';

  // Conditional positioning classes
  const positionClasses = preferAbove 
    ? "bottom-full left-1/2 -translate-x-1/2 mb-3" 
    : "top-full left-1/2 -translate-x-1/2 mt-3";

  // Conditional arrow classes
  const arrowContainerPosition = preferAbove ? "top-full" : "bottom-full";
  const arrowTranslateY = preferAbove ? "-translate-y-px" : "translate-y-px"; // Slight adjustment for border overlap
  const arrowPoints = preferAbove ? "M0,10 L10,0 L20,10 z" : "M0,0 L10,10 L20,0 z"; // Flipped for above

  return (
    <div className="relative flex items-center group">
      {children}
      <div 
        className={`absolute ${positionClasses} px-3 py-1.5 
                    ${tooltipBgColor} ${tooltipTextColor} ${tooltipBorderColor} border 
                    text-xs font-outfit-normal rounded-lg shadow-lg 
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-0 
                    transform scale-95 ${preferAbove ? '-translate-y-1' : 'translate-y-1'} 
                    transition-all duration-200 ease-out whitespace-nowrap z-50`}
      >
        {text}
        {/* Outer triangle for border */}
        <svg 
          className={`absolute left-1/2 -translate-x-1/2 h-3 w-3 ${arrowBorderColor} ${arrowContainerPosition} ${arrowTranslateY}`}
           viewBox="0 0 12 12"
        >
            <path d={arrowPoints} transform="scale(0.5,0.5)"/>
        </svg>
        {/* Inner triangle for background fill */}
        <svg 
          className={`absolute left-1/2 -translate-x-1/2 h-3 w-3 ${arrowColor} ${arrowContainerPosition} ${preferAbove ? 'top-[calc(100%-1px)]' : 'bottom-[calc(100%-1px)]'}`}
           viewBox="0 0 12 12"
        >
            <path d={arrowPoints} transform="scale(0.5,0.5)" />
        </svg>
      </div>
    </div>
  );
} 