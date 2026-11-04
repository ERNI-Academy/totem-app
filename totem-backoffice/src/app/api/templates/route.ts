import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
export const runtime="nodejs";
export async function GET(){try{const auth=await requireUser();if(auth.error)return auth.error;const db=await getDb();const r=await db.request().query("SELECT Id AS id,Name AS name,Description AS description,DocumentJson AS documentJson,IsSystem AS isSystem FROM dbo.Templates ORDER BY IsSystem DESC,Name");return NextResponse.json({templates:r.recordset.map((x:{documentJson:string;[key:string]:unknown})=>{const {documentJson,...other}=x;return {...other,document:JSON.parse(documentJson)}})});}catch(error){return apiError(error);}}
