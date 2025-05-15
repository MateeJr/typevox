import { NextRequest, NextResponse } from 'next/server';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), 'HISTORY');
const defaultSettings = {
  isReasonModeActive: false,
  searchUIMode: 'auto' as 'auto' | 'on' | 'off',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
  }

  const filePath = path.join(HISTORY_DIR, `${chatId}.json`);
  try {
    await fsPromises.access(filePath);
    const fileContent = await fsPromises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    if (Array.isArray(parsed)) {
      console.log(`[GET /chat/${chatId}] migrating old format`);
      return NextResponse.json({ messages: parsed, settings: defaultSettings });
    }

    if (parsed?.messages) {
      const loaded = parsed.settings || {};
      const settings = {
        isReasonModeActive: loaded.isReasonModeActive ?? defaultSettings.isReasonModeActive,
        searchUIMode: ['auto','on','off'].includes(loaded.searchUIMode)
          ? loaded.searchUIMode
          : defaultSettings.searchUIMode,
      };
      return NextResponse.json({ messages: parsed.messages, settings });
    }

    console.error(`[GET /chat/${chatId}] corrupted format`);
    return NextResponse.json({ messages: [], settings: defaultSettings });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log(`[GET /chat/${chatId}] not found, new chat`);
      return NextResponse.json({ messages: [], settings: defaultSettings });
    }
    console.error(`Error GET /chat/${chatId}:`, err);
    return NextResponse.json(
      { messages: [], settings: defaultSettings, error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
  }

  const filePath = path.join(HISTORY_DIR, `${chatId}.json`);
  try {
    await fsPromises.access(filePath);
    await fsPromises.unlink(filePath);
    console.log(`[DELETE /chat/${chatId}] deleted`);
    return NextResponse.json({ message: 'Chat deleted successfully' });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    console.error(`Error DELETE /chat/${chatId}:`, err);
    return NextResponse.json(
      { error: 'Failed to delete chat', details: err.message },
      { status: 500 }
    );
  }
}
