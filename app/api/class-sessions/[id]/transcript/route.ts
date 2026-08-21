import { NextResponse } from 'next/server';
import { fetchClassSessionTranscriptFromDb } from '@/lib/db/repository-pg';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ status: 'error', message: 'Session ID is required' }, { status: 400 });
    }

    const result = await fetchClassSessionTranscriptFromDb(id);

    if (!result) {
      return NextResponse.json({ transcript_text: null }, { status: 404 });
    }

    return NextResponse.json({ transcript_text: result.transcript_text });
  } catch (error: any) {
    console.error('Error fetching class session transcript:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
