import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const r = await getDb().query("SELECT id,name,description,document_json AS document, is_system AS \"isSystem\" FROM templates ORDER BY is_system DESC,name");
    return NextResponse.json({ templates: r.rows });
  } catch (error) { return apiError(error); }
}
