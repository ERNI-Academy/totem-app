import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const KEY_LENGTH=64;
function derive(password:string,salt:Buffer){
  return new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,KEY_LENGTH,{N:32768,r:8,p:1,maxmem:96*1024*1024},(error,key)=>error?reject(error):resolve(key as Buffer)));
}
export async function hashPassword(password:string){
  const salt=randomBytes(16);
  const key=await derive(password,salt);
  return `scrypt$32768$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function verifyPassword(password:string,stored:string){
  const [algorithm,cost,salt,key]=stored.split("$");
  if(algorithm!=="scrypt"||cost!=="32768"||!salt||!key)return false;
  const expected=Buffer.from(key,"base64url");
  if(expected.length!==KEY_LENGTH)return false;
  const actual=await derive(password,Buffer.from(salt,"base64url"));
  return timingSafeEqual(actual,expected);
}
