import type { CanvasElement, VisualisationDocument } from "@/types/content";

export const shellElements = [
  { id: "logo", label: "Logo ERNI", region: "Cabecera" },
  { id: "tagline", label: "Logo better ask ERNI", region: "Cabecera" },
  { id: "hero-video", label: "Vídeo del header", region: "Cabecera" },
  { id: "hero-eyebrow", label: "Texto de bienvenida", region: "Cabecera" },
  { id: "hero-title", label: "Título del header", region: "Cabecera" },
  { id: "hero-subtitle", label: "Subtítulo del header", region: "Cabecera" },
  { id: "footer-eyebrow", label: "Antetítulo del pie", region: "Pie" },
  { id: "footer-title", label: "Título del pie", region: "Pie" },
  { id: "footer-subtitle", label: "Subtítulo del pie", region: "Pie" },
  { id: "footer-cta", label: "Texto del botón", region: "Pie" },
  { id: "footer-icon", label: "Icono del botón", region: "Pie" },
];
export const shellSelector = (id: string) => `[data-totem-shell="${id}"]`;
export function isShellSelector(selector: string) {
  return /data-totem-shell|#heroVid|\.hdr\b|\.hero\b|#vband\b|\.vband\b/.test(selector);
}
export function createCanvasDocument(base: VisualisationDocument, name: string): VisualisationDocument {
  if(!base.webTemplate)throw new Error("The base web template is missing.");
  return {
    ...structuredClone(base), name, webPublication: undefined,
    experience:base.experience?{...base.experience,defaultPublished:false}:undefined,
    webTemplate:{...structuredClone(base.webTemplate),contentMode:"canvas",adapterSource:undefined,
      overrides:Object.fromEntries(Object.entries(base.webTemplate.overrides).filter(([selector])=>isShellSelector(selector))),
      media:Object.fromEntries(Object.entries(base.webTemplate.media??{}).filter(([selector])=>isShellSelector(selector)))},
    screens:[{id:"home",name:"Inicio",mode:"embedded",elements:[]}],
  };
}
export function fitElement(element: CanvasElement, height: number): CanvasElement {
  const width=Math.min(1080,Math.max(40,element.width));
  const h=Math.min(height,Math.max(40,element.height));
  return {...element,width,height:h,x:Math.max(0,Math.min(1080-width,element.x)),y:Math.max(0,Math.min(height-h,element.y))};
}
