import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { readFile } from "node:fs/promises";
import manifest from "../../../../../packages/totem-original/manifest.json";
import type { VisualisationDocument } from "@/types/content";
export async function GET() {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const r = await getDb().query("SELECT id,name,description,document_json AS document, is_system AS \"isSystem\" FROM templates ORDER BY is_system DESC,name");
    const sourceDocument=JSON.parse(await readFile(new URL("../../../../../packages/totem-original/document.json",import.meta.url),"utf8")) as VisualisationDocument;
    sourceDocument.webTemplate={id:"totem-original",sourceSha256:manifest.sourceSha256,webSha256:manifest.webSha256,sourceFiles:manifest.webFiles,overrides:{}};
    return NextResponse.json({ templates: [{id:"totem-original",name:"Totem original",description:"Exact HTML/CSS/JavaScript source project",document:sourceDocument,isSystem:true},...r.rows.filter(x=>x.name!=="Totem original")] });
  } catch (error) { return apiError(error); }
}
