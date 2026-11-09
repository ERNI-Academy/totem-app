import { z } from "zod";

const element = z.object({ id:z.string().min(1),type:z.enum(["text","image","video","card","button"]),x:z.number().finite(),y:z.number().finite(),width:z.number().positive().max(1080),height:z.number().positive().max(1920),text:z.string().max(5000).optional(),title:z.string().max(240).optional(),description:z.string().max(2000).optional(),color:z.string().max(32).optional(),fontSize:z.number().positive().max(240).optional(),background:z.string().max(64).optional(),src:z.string().max(1_500_000).optional(),target:z.string().max(120).optional(),locked:z.boolean().optional(),imageNoPadding:z.boolean().optional() });
const override = z.object({text:z.string().max(5000).optional(),src:z.string().max(1_500_000).optional(),mode:z.enum(["video","image","color"]).optional(),background:z.string().max(64).optional(),hidden:z.boolean().optional(),zIndex:z.number().int().min(-100).max(100).optional(),x:z.number().finite().optional(),y:z.number().finite().optional(),width:z.number().positive().max(5000).optional(),height:z.number().positive().max(5000).optional()});
const file = z.object({path:z.string().max(500),bytes:z.number().int().nonnegative(),sha256:z.string().length(64)});
export const documentSchema = z.object({
  schemaVersion:z.literal(1),width:z.literal(1080),height:z.literal(1920),name:z.string().max(160),
  experience:z.object({id:z.string(),sourceSha256:z.string(),packSha256:z.string(),defaultPublished:z.boolean()}).optional(),
  webTemplate:z.object({id:z.literal("totem-original"),contentMode:z.enum(["original","canvas"]).optional(),sourceSha256:z.string().length(64),webSha256:z.string().length(64),sourceFiles:z.array(file).max(100).optional(),adapterSource:z.string().max(500_000).optional(),overrides:z.record(z.string().max(500),override),media:z.record(z.string().max(500),z.string().max(1_500_000)).optional()}).optional(),
  webPublication:z.object({sourceSha256:z.string().length(64),webSha256:z.string().length(64),bundleSha256:z.string().length(64),files:z.array(file)}).optional(),
  regions:z.record(z.string(),z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number(),locked:z.boolean()})).optional(),
  screens:z.array(z.object({id:z.string().min(1),name:z.string().min(1).max(160),mode:z.enum(["embedded","fullscreen"]),elements:z.array(element).max(250)})).min(1).max(40),
}).superRefine((doc,ctx)=>{
  if(doc.webTemplate?.contentMode!=="canvas")return;
  for(const [si,screen] of doc.screens.entries()) for(const [ei,el] of screen.elements.entries()){
    const height=screen.mode==="embedded"?1080:1920;
    if(el.x<0||el.y<0||el.x+el.width>1080.01||el.y+el.height>height+.01)
      ctx.addIssue({code:"custom",message:"The element must fit inside its screen.",path:["screens",si,"elements",ei]});
  }
});
