"use client";

import type { VisualisationDocument } from "@/types/content";
import { TotemOriginalExperience } from "@/features/dashboard/TotemOriginalExperience";

export function TotemPreview({document,visualisationId}:{document:VisualisationDocument;visualisationId:string}){
  return <div className="totem-preview-stage"><TotemOriginalExperience visualisationId={visualisationId} document={document}/></div>;
}
