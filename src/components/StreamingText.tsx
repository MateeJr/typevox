"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

// Add global styles to prevent KaTeX from causing layout shifts
const katexStyles = `
  .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    padding-top: 0.5em;
    padding-bottom: 0.5em;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
  .katex {
    font-size: 1.1em;
  }
`;
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { Check, Copy, WrapText, ArrowLeftRight } from 'lucide-react';

interface StreamingTextProps {
  text: string; // This will be the incrementally updated full text
  isAiMessage: boolean;
  messageId: string; // Used as a key for resetting state when message changes
  shouldRenderMarkdown?: boolean;
}

// Helper function to preprocess LaTeX content (adapted from friend's code)
const preprocessLaTeX = (content: string) => {
  // First, handle escaped delimiters to prevent double processing
  let processedContent = content
    .replace(/\\\[/g, '___BLOCK_OPEN___')
    .replace(/\\\]/g, '___BLOCK_CLOSE___')
    .replace(/\\\(/g, '___INLINE_OPEN___')
    .replace(/\\\)/g, '___INLINE_CLOSE___');

  // Process block equations
  processedContent = processedContent.replace(
    /___BLOCK_OPEN___([\s\S]*?)___BLOCK_CLOSE___/g,
    (_, equation) => `$$${equation.trim()}$$`
  );

  // Process inline equations
  processedContent = processedContent.replace(
    /___INLINE_OPEN___([\s\S]*?)___INLINE_CLOSE___/g,
    (_, equation) => `$${equation.trim()}$`
  );

  // Handle common LaTeX expressions not wrapped in delimiters (optional, can be adjusted)
  processedContent = processedContent.replace(
    /(\b[A-Z](?:_\{[^{}]+\}|\^[^{}]+|_[a-zA-Z\d]|\^[a-zA-Z\d])+)/g,
    (match) => `$${match}$`
  );

  // Handle any remaining escaped delimiters that weren't part of a complete pair
  processedContent = processedContent
    .replace(/___BLOCK_OPEN___/g, '\\[')
    .replace(/___BLOCK_CLOSE___/g, '\\]')
    .replace(/___INLINE_OPEN___/g, '\\(')
    .replace(/___INLINE_CLOSE___/g, '\\)');

  return processedContent;
};

interface CodeBlockProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CustomCodeBlock: React.FC<CodeBlockProps> = ({ node, inline, className, children }) => {
  const { theme } = useTheme();
  const [isCopied, setIsCopied] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);

  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1] ? match[1] : '';
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [codeText]);

  const toggleWrap = useCallback(() => {
    setIsWrapped(prev => !prev);
  }, []);

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  // If the language is math or latex, render with Latex component
  if (lang === 'math' || lang === 'latex') {
    // The `prose` class provides some default styling that might affect KaTeX.
    // We render LaTeX in a plain div and apply specific styling if needed.
    // KaTeX CSS should handle the core rendering.
    // We also ensure the container allows KaTeX to take full width if needed.
    // Wrap with $$ for block display with react-latex-next
    const latexContent = `$$${codeText.trim()}$$`;
    return (
      <div className="latex-block-container my-4 text-base text-left" style={{ minHeight: '2em', position: 'relative', overflow: 'hidden' }}>
        <Latex>{latexContent}</Latex>
      </div>
    );
  }

  // Otherwise, use SyntaxHighlighter for other code languages
  return (
    <div className="group my-4 relative text-sm">
      <div className="rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="px-2 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {lang || 'text'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleWrap}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${isWrapped ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'} hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1`}
              aria-label="Toggle line wrapping"
            >
              {isWrapped ? <ArrowLeftRight className="h-3 w-3" /> : <WrapText className="h-3 w-3" />}
              <span className="hidden sm:inline">{isWrapped ? 'Unwrap' : 'Wrap'}</span>
            </button>
            <button
              onClick={handleCopy}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${isCopied ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'} hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1`}
              aria-label="Copy code"
            >
              {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
        <SyntaxHighlighter
          language={lang}
          style={theme === 'dark' ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: '0.75rem',
            backgroundColor: theme === 'dark' ? '#262626' /* neutral-800 */ : '#f5f5f5' /* neutral-100 */,
            borderRadius: '0 0 0.375rem 0.375rem',
            fontFamily: 'monospace', 
          }}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.25em',
            paddingRight: '1em',
            textAlign: 'right',
            color: theme === 'dark' ? '#a3a3a3' /* neutral-400 */ : '#737373' /* neutral-500 */,
            userSelect: 'none',
          }}
          wrapLongLines={isWrapped}
          codeTagProps={{
            style: {
              fontFamily: 'monospace',
              fontSize: '0.875em',
              lineHeight: '1.5',
              whiteSpace: isWrapped ? 'pre-wrap' : 'pre',
              overflowWrap: isWrapped ? 'break-word' : 'normal',
              wordBreak: isWrapped ? 'break-all' : 'normal', // break-all for wrapped lines
            }
          }}
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const StreamingText: React.FC<StreamingTextProps> = ({ text, isAiMessage, messageId, shouldRenderMarkdown = true }) => {
  // Add KaTeX styles to prevent layout shifts
  useEffect(() => {
    // Add KaTeX styles to head if not already present
    if (!document.getElementById('katex-custom-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'katex-custom-styles';
      styleElement.textContent = katexStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        // Clean up is optional here since we want these styles to persist
      };
    }
  }, []);
  // Default enableMarkdown to true for AI messages, false for user messages
  const shouldRenderMarkdownFinal = shouldRenderMarkdown !== undefined ? shouldRenderMarkdown : isAiMessage;
  const [displayedContent, setDisplayedContent] = useState<React.ReactNode[]>([]);
  const processedTextLengthRef = useRef<number>(0);
  // animationElementCountRef can still be useful for generating unique keys if needed, 
  // especially if words themselves can repeat within a short span and messageId isn't enough.
  const elementKeyCounterRef = useRef<number>(0);

  useEffect(() => {
    setDisplayedContent([]);
    processedTextLengthRef.current = 0;
    elementKeyCounterRef.current = 0;
  }, [messageId]);

  useEffect(() => {
    if (!isAiMessage) {
      // For user messages, render with markdown if enabled
      if (shouldRenderMarkdownFinal) {
        setDisplayedContent([
          <ReactMarkdown key={`${messageId}-md`} remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>
        ]);
      } else {
        setDisplayedContent([text]);
      }
      processedTextLengthRef.current = text.length;
      return;
    }

    if (text.length <= processedTextLengthRef.current && text.length > 0) {
      return;
    }
    
    const newTextPortion = text.substring(processedTextLengthRef.current);

    if (newTextPortion.length === 0 && text.length > 0) {
      return;
    }
    
    if (text.length === 0) {
        setDisplayedContent([]);
        processedTextLengthRef.current = 0;
        elementKeyCounterRef.current = 0;
        return;
    }

    // For streaming text or when markdown is disabled, use the word-by-word animation
    const newElements = newTextPortion.split(/(\s+)/).filter(s => s.length > 0);
    const newNodes: React.ReactNode[] = [];

    newElements.forEach((element) => {
      const currentKeyCount = elementKeyCounterRef.current;
      if (element.match(/^\s+$/)) { 
        newNodes.push(element); 
      } else { 
        newNodes.push(
          <span key={`${messageId}-word-${currentKeyCount}`}
                className="animate-word-fade-in">
            {element}
          </span>
        );
      }
      elementKeyCounterRef.current++; 
    });

    if (newNodes.length > 0) {
        setDisplayedContent(prevContent => [...prevContent, ...newNodes]);
    }
    processedTextLengthRef.current = text.length;

  }, [text, isAiMessage, messageId]);

  // When the streaming is complete and markdown is enabled, replace the content with properly rendered markdown
  useEffect(() => {
    if (isAiMessage && shouldRenderMarkdownFinal && processedTextLengthRef.current === text.length && text.length > 0) {
      // Small delay to ensure all animations have completed
      // Use requestAnimationFrame to ensure DOM updates are complete before rendering LaTeX
      const timer = setTimeout(() => {
        // Calculate current scroll position
        const scrollPosition = window.scrollY;
        const processedTextForMarkdown = preprocessLaTeX(text);
        setDisplayedContent([
          <ReactMarkdown
            key={`${messageId}-md-final`}
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code: CustomCodeBlock,
              // Handling for LaTeX, react-markdown with remark-math wraps math in `span` or `div` with class `math-inline` or `math-display`
              span: ({ node, className, children, ...props }) => {
                if (className === 'math-inline') {
                  return <span className="latex-inline-container" style={{ display: 'inline-block', minHeight: '1.2em' }}><Latex>{`$${String(children)}$`}</Latex></span>;
                }
                return <span className={className} {...props}>{children}</span>;
              },
              div: ({ node, className, children, ...props }) => {
                if (className === 'math-display') {
                  return <div className="latex-block-container" style={{ minHeight: '2em', position: 'relative', overflow: 'hidden' }}><Latex>{`$$${String(children)}$$`}</Latex></div>;
                }
                return <div className={className} {...props}>{children}</div>;
              },
              // Explicit handling for tables to ensure they're properly styled
              table: ({ node, children, ...props }) => {
                return <table className="border-collapse w-full my-4" {...props}>{children}</table>;
              },
              thead: ({ node, children, ...props }) => {
                return <thead {...props}>{children}</thead>;
              },
              tbody: ({ node, children, ...props }) => {
                return <tbody {...props}>{children}</tbody>;
              },
              tr: ({ node, children, ...props }) => {
                return <tr className="border-b border-gray-200 dark:border-gray-700" {...props}>{children}</tr>;
              },
              th: ({ node, children, ...props }) => {
                return <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-left font-semibold" {...props}>{children}</th>;
              },
              td: ({ node, children, ...props }) => {
                return <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left" {...props}>{children}</td>;
              },
              p: ({ node, children }) => {
                // Check if any of the paragraph's children are CustomCodeBlock components
                // or contain elements that shouldn't be in paragraphs
                const childArray = React.Children.toArray(children);
                
                // Check if any child is a code block or contains elements that can't be in a paragraph
                const hasInvalidNesting = childArray.some(child => {
                  return (
                    (React.isValidElement(child) && 
                     (child.type === CustomCodeBlock || 
                      (typeof child.type === 'string' && 
                       ['div', 'pre', 'table'].includes(child.type)))) ||
                    (typeof child === 'string' && child.includes('```'))
                  );
                });
                
                if (hasInvalidNesting) {
                  // If there's invalid nesting, render without a <p> wrapper
                  return <>{children}</>;
                }
                
                // Otherwise, render as a normal paragraph
                return <p>{children}</p>;
              },
            }}
          >
            {processedTextForMarkdown}
          </ReactMarkdown>
        ]);
        // After rendering, restore scroll position if it changed
        requestAnimationFrame(() => {
          if (window.scrollY !== scrollPosition) {
            window.scrollTo({
              top: scrollPosition,
              behavior: 'auto'
            });
          }
        });
      }, 100); 
      return () => clearTimeout(timer);
    }
  }, [text, isAiMessage, messageId, shouldRenderMarkdownFinal]);

  return <div className="prose dark:prose-invert max-w-none overflow-x-auto">{displayedContent}</div>;
};

export default StreamingText; 