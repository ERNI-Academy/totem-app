import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb,sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiError } from "@/lib/http";
export const runtime="nodejs";
export async function POST(request:Request){try{const body=z.object({token:z.string().min(20),password:z.string().min(12).max(128)}).parse(await request.json());const db=await getDb();const tx=new sql.Transaction(db);await tx.begin();try{const hash=createHash("sha256").update(body.token).digest("hex");const record=await new sql.Request(tx).input("hash",sql.Char(64),hash).query("SELECT TOP 1 Id,UserId FROM dbo.OneTimeTokens WITH (UPDLOCK,ROWLOCK) WHERE TokenHash=@hash AND Purpose='activation' AND UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()");if(!record.recordset[0]){await tx.rollback();return NextResponse.json({error:"This activation link is invalid, expired or already used."},{status:400});}const password=await hashPassword(body.password);await new sql.Request(tx).input("user",sql.UniqueIdentifier,record.recordset[0].UserId).input("password",sql.NVarChar(300),password).query("UPDATE dbo.Users SET PasswordHash=@password,IsActive=1,UpdatedAt=SYSUTCDATETIME() WHERE Id=@user");await new sql.Request(tx).input("id",sql.UniqueIdentifier,record.recordset[0].Id).query("UPDATE dbo.OneTimeTokens SET UsedAt=SYSUTCDATETIME() WHERE Id=@id");await tx.commit();return NextResponse.json({ok:true});}catch(error){await tx.rollback();throw error;}}catch(error){return apiError(error);}}
