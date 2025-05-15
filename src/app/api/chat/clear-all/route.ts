import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Define the history directory, assuming it's at the root of your project in a 'chathistory' folder
// Adjust this path if your chathistory directory is located elsewhere relative to the project root.
const HISTORY_DIR = path.join(process.cwd(), 'HISTORY');

export async function DELETE() {
  console.log(`[API DELETE /api/chat/clear-all] Received request to clear all chat history.`);
  try {
    // Check if the history directory exists
    try {
      await stat(HISTORY_DIR);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        console.log(`[API DELETE /api/chat/clear-all] History directory ${HISTORY_DIR} not found. Nothing to delete.`);
        return NextResponse.json({ message: 'Chat history directory not found. No chats to clear.' }, { status: 200 });
      }
      throw e; // Re-throw other errors
    }

    console.log(`[API DELETE /api/chat/clear-all] Reading files from: ${HISTORY_DIR}`);
    const files = await readdir(HISTORY_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log(`[API DELETE /api/chat/clear-all] No chat files found in ${HISTORY_DIR} to delete.`);
      return NextResponse.json({ message: 'No chat files to clear.' }, { status: 200 });
    }

    let deletedCount = 0;
    let errorCount = 0;

    for (const file of jsonFiles) {
      const filePath = path.join(HISTORY_DIR, file);
      try {
        await unlink(filePath);
        console.log(`[API DELETE /api/chat/clear-all] Deleted file: ${filePath}`);
        deletedCount++;
      } catch (error: any) {
        console.error(`[API DELETE /api/chat/clear-all] Error deleting file ${filePath}:`, error);
        errorCount++;
        // Continue to delete other files even if one fails
      }
    }

    if (errorCount > 0) {
      return NextResponse.json({ 
        message: `Successfully deleted ${deletedCount} chat(s). Failed to delete ${errorCount} chat(s).`,
        deletedCount,
        errorCount 
      }, { status: 207 }); // 207 Multi-Status if some deletions failed
    }

    console.log(`[API DELETE /api/chat/clear-all] Successfully cleared all ${deletedCount} chat file(s) from ${HISTORY_DIR}.`);
    return NextResponse.json({ message: 'All chat history cleared successfully.', deletedCount }, { status: 200 });

  } catch (error: any) {
    console.error(`[API DELETE /api/chat/clear-all] Error clearing all chat history:`, error);
    return NextResponse.json({ error: 'Failed to clear chat history', details: error.message }, { status: 500 });
  }
}
