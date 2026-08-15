import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { buildAppState } from '@/lib/appState';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await readDb();
  return NextResponse.json(buildAppState(db));
}
