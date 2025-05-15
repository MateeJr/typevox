import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the path for the HISTORY directory
const HISTORY_DIR = path.join(process.cwd(), 'HISTORY');

export async function POST(request: NextRequest) {
  try {
    // Ensure the HISTORY directory exists
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const body = await request.json();
    // Expect messages and settings (which includes isReasonModeActive and isSearchModeActive)
    const { chatId, messages, settings } = body;

    if (!chatId || !messages || settings === undefined) { // Check for settings presence
      return NextResponse.json({ error: 'chatId, messages, and settings are required' }, { status: 400 });
    }

    // Validate settings object structure (updated for searchUIMode)
    if (typeof settings.isReasonModeActive !== 'boolean' || 
        (settings.searchUIMode !== 'auto' && settings.searchUIMode !== 'on' && settings.searchUIMode !== 'off')
    ) {
        return NextResponse.json({ error: 'Invalid settings object structure' }, { status: 400 });
    }

    const filePath = path.join(HISTORY_DIR, `${chatId}.json`);
    // Store as an object containing messages and settings
    const fileData = { messages, settings };
    const fileContent = JSON.stringify(fileData, null, 2); // Pretty print JSON

    fs.writeFileSync(filePath, fileContent, 'utf8');

    return NextResponse.json({ message: 'Chat saved successfully' }, { status: 200 });
  } catch (error) {
    console.error("Error saving chat:", error);
    return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
  }
} 