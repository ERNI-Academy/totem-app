"use client";

import type { CSSProperties } from "react";
import type { Screen, VisualisationDocument } from "@/types/content";

type Props = { document: VisualisationDocument; screenId: string | null; onNavigate: (screenId: string | null) => void };

function PreviewElements({ screen, document, onNavigate }: { screen: Screen; document: VisualisationDocument; onNavigate: Props["onNavigate"] }) {
  const denominator = screen.mode === "embedded" ? 1080 : 1920;
  const openTarget = (id?: string) => {
    const destination = document.screens.find(item => item.id === id);
    if (destination) onNavigate(destination.mode === "fullscreen" ? destination.id : null);
  };
  return <>{screen.elements.map(element => {
    const style: CSSProperties = {
      left: (element.x / 1080 * 100) + "%",
      top: (element.y / denominator * 100) + "%",
      width: (element.width / 1080 * 100) + "%",
      height: (element.height / denominator * 100) + "%",
      background: element.background,
      padding: element.type === "image" && element.imageNoPadding ? 0 : undefined,
      color: element.color || (screen.mode === "fullscreen" ? "#ffffff" : "#17366f"),
      fontSize: ((element.fontSize || 28) / 1080 * 100) + "cqw",
    };
    const linked = Boolean(element.target && document.screens.some(item => item.id === element.target));
    return <div key={element.id} className={"totem-preview-element " + element.type + (linked ? " is-linked" : "")} style={style} onClick={() => linked && openTarget(element.target)}>
      {element.type === "image" ? element.src ? <img src={element.src} alt={element.title || ""}/> : <span>Image</span>
        : element.type === "video" ? <span>▶ Video</span>
        : element.type === "card" ? <><span className="totem-preview-card-icon">◉</span><strong>{element.title || element.text || "Card"}</strong><small>{element.description}</small>{linked && <em>See it in action →</em>}</>
        : element.text || element.title || (element.type === "button" ? "Button" : "")}
    </div>;
  })}</>;
}

export function TotemPreview({ document, screenId, onNavigate }: Props) {
  const home = document.screens.find(screen => screen.mode === "embedded") || document.screens[0];
  const detail = screenId ? document.screens.find(screen => screen.id === screenId && screen.mode === "fullscreen") : undefined;
  return <div className="totem-preview-stage"><div className="totem-preview-frame" aria-label="Full kiosk preview">
    <header className="totem-preview-header"><img src="/totem-preview/erni-logo.png" alt="ERNI"/><img src="/totem-preview/better-ask-erni.png" alt="better ask ERNI"/></header>
    <section className="totem-preview-hero"><div className="totem-preview-hero-copy"><small>WELCOME TO THE</small><h1>Swiss Tech<br/>Center</h1><p>Engineering trust in the age of AI</p></div></section>
    <section className="totem-preview-content" aria-label="Dynamic content">{home && <PreviewElements screen={home} document={document} onNavigate={onNavigate}/>}</section>
    <footer className="totem-preview-footer"><div><small>OUR AI VISION</small><strong>From AI idea to value in production</strong><span>Five AI services, one platform</span></div><button type="button">Discover our AI vision <b>→</b></button></footer>
    {detail && <section className="totem-preview-detail" aria-label={detail.name}><button type="button" className="totem-preview-back" onClick={() => onNavigate(null)}>← Back</button><div className="totem-preview-detail-content"><PreviewElements screen={detail} document={document} onNavigate={onNavigate}/></div></section>}
  </div></div>;
}
