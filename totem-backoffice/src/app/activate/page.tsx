import { Activation } from "@/features/auth/Activation";
export default async function Activate({searchParams}:{searchParams:Promise<{token?:string}>}){const {token=""}=await searchParams;return <Activation token={token}/>;}
