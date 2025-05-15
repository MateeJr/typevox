import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Construct the path relative to the project's root directory
    const filePath = path.join(process.cwd(), 'system.txt');
    const systemPrompt = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error('Failed to read system prompt from system.txt:', error);
    // Provide a more specific error message to the client if needed
    return NextResponse.json({ error: 'Failed to load system prompt. Check server logs.' }, { status: 500 });
  }
}
