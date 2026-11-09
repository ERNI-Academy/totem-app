import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createBlobSas } from '@/lib/blobStorage';
import { apiError } from '@/lib/http';
import { originalResource } from '@/lib/totemOriginal';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const entry = originalResource((await params).path.join('/'));
    if (!entry) return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
    return NextResponse.redirect(createBlobSas(entry.blobName, 'r', 120), { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) { return apiError(error); }
}
