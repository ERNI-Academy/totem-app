import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createBlobSas } from "@/lib/blobStorage";
import { originalResource } from "@/lib/totemOriginal";

export const runtime = "nodejs";

const templateMedia = new Set([
  "better-ask-erni.png",
  "erni-logo.png",
  "hero-poster.jpg",
  "hero.mp4",
  "sifu-robot-piano.jpg",
  "sifu.mp4",
  "talent-arena.mp4",
]);

type Context = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const { name } = await params;
    if (!templateMedia.has(name)) return NextResponse.json({ error: "Media not found." }, { status: 404 });
    const resource = originalResource(`media/${name}`);
    if (!resource) return NextResponse.json({ error: "Media not found." }, { status: 404 });

    return NextResponse.redirect(createBlobSas(resource.blobName, "r", 120), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return apiError(error);
  }
}
