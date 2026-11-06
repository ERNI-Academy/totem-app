export type ElementType = "text" | "image" | "video" | "card" | "button";
export interface CanvasElement {
  id: string; type: ElementType; x: number; y: number; width: number; height: number;
  text?: string; title?: string; description?: string; color?: string; fontSize?: number;
  background?: string; src?: string; target?: string; locked?: boolean; imageNoPadding?: boolean;
}
export interface Screen { id: string; name: string; mode: "embedded" | "fullscreen"; elements: CanvasElement[] }
export interface VisualisationDocument { schemaVersion: 1; width: 1080; height: 1920; name: string; screens: Screen[]; regions?: Record<string, { x: number; y: number; width: number; height: number; locked: boolean }> }
export interface Visualisation { id: string; name: string; kind: "visualisation" | "system"; isProtected: boolean; ownerId: string | null; updatedAt: string; revision: number; latestPublishedVersion: number | null; document?: VisualisationDocument }
export interface AppUser { id: string; email: string; displayName: string; role: "admin" | "user" }
