"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasElement, ElementType, VisualisationDocument, WebElementOverride } from "@/types/content";

export type SelectedWebElement = { selector: string; tag: string; text: string; textEditable?: boolean; textItems?: { selector: string; text: string }[]; src: string; x: number; y: number; width: number; height: number; color: string; background?: string; mode?: "video"|"image"|"color"; hidden?: boolean; zIndex?: number };

type Props = {
  visualisationId: string; document: VisualisationDocument; editing?: boolean;
  activeScreen?: string; activeElement?: string | null; shellTarget?: string | null;
  onSelect?: (element: SelectedWebElement) => void;
  onShellChange?: (selector:string,changes:Partial<WebElementOverride>)=>void;
  onCanvasSelect?: (id: string | null, screenId: string) => void;
  onCanvasChange?: (id: string, changes: Partial<CanvasElement>, screenId: string) => void;
  onCanvasAdd?: (type: ElementType, x: number, y: number, screenId: string) => void;
  onCanvasDelete?: (id: string, screenId: string) => void;
  onScreenChange?: (screenId: string) => void;
};

export function TotemOriginalExperience(props: Props) {
  const {visualisationId,document,editing=false,activeScreen,activeElement,shellTarget}=props;
  const frame=useRef<HTMLIFrameElement>(null);
  const latest=useRef(props); latest.current=props;
  const source=`/api/visualisations/${encodeURIComponent(visualisationId)}/preview/`;
  const previewMedia=useCallback((url:string)=>{
    const asset=/^\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url);
    if(asset)return `${source}live-media/${asset[1]}`;
    if(url.startsWith('/api/totem-original/'))return source+'resources/'+url.slice('/api/totem-original/'.length);
    if(url.startsWith('/api/template-media/'))return source+'media/'+url.slice('/api/template-media/'.length);
    return url;
  },[source]);
  const sendState=useCallback(()=>{
    const post=(message:object)=>frame.current?.contentWindow?.postMessage(message,location.origin);
    const template=document.webTemplate;
    post({type:'totem-editor-mode',enabled:editing});
    post({type:'totem-web-document',document:{contentMode:template?.contentMode||'original',screens:document.screens.map(s=>({...s,elements:s.elements.map(el=>({...el,src:el.src?previewMedia(el.src):undefined}))}))},activeScreen:editing?activeScreen:undefined});
    post({type:'totem-web-overrides',overrides:template?.overrides??{}});
    post({type:'totem-web-media',media:Object.fromEntries(Object.entries(template?.media??{}).map(([key,url])=>[key,previewMedia(url)]))});
    if(editing&&latest.current.activeElement)post({type:'totem-select-canvas',id:latest.current.activeElement});
    if(editing&&latest.current.shellTarget)post({type:'totem-select-shell',id:latest.current.shellTarget});
  },[document,editing,activeScreen,previewMedia]);
  const sendLatest=useRef(sendState);sendLatest.current=sendState;
  useEffect(()=>{sendState();},[sendState]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
      const data=event.data,p=latest.current;
      if(data?.type==='totem-editor-ready'){sendLatest.current();return;}
      if(!p.editing)return;
      if(data?.type==='totem-element-selected')p.onSelect?.(data.element);
      if(data?.type==='totem-shell-changed')p.onShellChange?.(data.selector,data.changes);
      if(data?.type==='totem-canvas-selected')p.onCanvasSelect?.(data.id,data.screenId);
      if(data?.type==='totem-canvas-changed')p.onCanvasChange?.(data.id,data.changes,data.screenId);
      if(data?.type==='totem-canvas-add')p.onCanvasAdd?.(data.elementType,data.x,data.y,data.screenId);
      if(data?.type==='totem-canvas-delete')p.onCanvasDelete?.(data.id,data.screenId);
      if(data?.type==='totem-canvas-screen')p.onScreenChange?.(data.screenId);
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{if(editing)frame.current?.contentWindow?.postMessage({type:'totem-select-canvas',id:activeElement},location.origin);},[activeElement,editing,document]);
  useEffect(()=>{if(editing&&shellTarget)frame.current?.contentWindow?.postMessage({type:'totem-select-shell',id:shellTarget},location.origin);},[shellTarget,editing,activeScreen]);
  return <iframe key={visualisationId} ref={frame} className="totem-web-frame" title={`${document.name} web template`} src={source+'index.html'+(editing?'?editor=1':'')} onLoad={sendState} sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock" allow="autoplay; fullscreen 'none'"/>;
}
export type { WebElementOverride };
