import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // Using promises version for async/await
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), 'HISTORY');

interface ChatListItem {
  id: string;
  title: string; // Will use a snippet of the first message as title
  lastModified: number; // Timestamp
}

export async function GET() {
  console.log('[API /chat/list] Received request');
  try {
    // Ensure HISTORY directory exists, if not, return empty list
    try {
      await fs.access(HISTORY_DIR);
      console.log('[API /chat/list] HISTORY directory exists.');
    } catch (e) {
      console.log('[API /chat/list] HISTORY directory does not exist. Returning empty list.');
      return NextResponse.json([], { status: 200 }); // Directory doesn't exist
    }

    const files = await fs.readdir(HISTORY_DIR);
    console.log(`[API /chat/list] Files in HISTORY directory: ${files.join(', ') || 'None'}`);
    const chatList: ChatListItem[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        console.log(`[API /chat/list] Processing file: ${file}`);
        const filePath = path.join(HISTORY_DIR, file);
        try {
          const fileContent = await fs.readFile(filePath, 'utf8');
          // Add a check for genuinely empty or whitespace-only files before parsing
          if (fileContent.trim() === '' || fileContent.trim() === '[]') {
            console.log(`[API /chat/list] File ${file} is empty or contains just []. Treating as Empty Chat.`);
            const stats = await fs.stat(filePath);
            chatList.push({
              id: file.replace('.json', ''),
              title: "Empty Chat",
              lastModified: stats.mtime.getTime(),
            });
            continue; // Move to the next file
          }

          const messages = JSON.parse(fileContent);
          const stats = await fs.stat(filePath);

          let title = "Chat (no text)"; // Default if first message has no text
          if (Array.isArray(messages) && messages.length > 0 && messages[0] && typeof messages[0].text === 'string' && messages[0].text.trim() !== '') {
            title = messages[0].text.trim().substring(0, 50);
            if (messages[0].text.trim().length > 50) title += '...';
          } else if (Array.isArray(messages) && messages.length > 0) {
            title = "Chat (media/no text)"; // If message exists but no text
          } else { // Handles empty array from JSON.parse("[]") if not caught by trim() check earlier, or other structures
            title = "Empty Chat";
          }
          
          console.log(`[API /chat/list] Successfully processed ${file}, title: '${title}'`);
          chatList.push({
            id: file.replace('.json', ''),
            title,
            lastModified: stats.mtime.getTime(),
          });
        } catch (err: any) {
          console.error(`[API /chat/list] Error processing file ${file}: ${err.message}. Skipping file.`);
        }
      } else {
        console.log(`[API /chat/list] Skipping non-JSON file: ${file}`);
      }
    }

    // Sort by last modified descending (newest first)
    chatList.sort((a, b) => b.lastModified - a.lastModified);
    console.log(`[API /chat/list] Returning chat list with ${chatList.length} items.`);
    return NextResponse.json(chatList, { status: 200 });
  } catch (error: any) {
    console.error(`[API /chat/list] General error: ${error.message}`);
    return NextResponse.json({ error: 'Failed to list chats', details: error.message }, { status: 500 });
  }
} 