import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() { try { const user = await getCurrentUser(); return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 }); } catch (error) { return apiError(error); } }
