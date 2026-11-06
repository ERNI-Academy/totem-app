import "server-only";
import type { DbClient } from "./db";
import type { VisualisationDocument } from "@/types/content";

function referencedAssetIds(document: VisualisationDocument): string[] {
  const ids = new Set<string>();
  for (const screen of document.screens ?? []) {
    for (const element of screen.elements ?? []) {
      const match = /^\/api\/assets\/([0-9a-f-]{36})\/file$/i.exec(element.src ?? "");
      if (match) ids.add(match[1]);
    }
  }
  return [...ids];
}

export async function syncDraftAssetReferences(client: DbClient, visualisationId: string, document: VisualisationDocument) {
  await client.query("DELETE FROM draft_assets WHERE visualisation_id=$1", [visualisationId]);
  for (const assetId of referencedAssetIds(document)) {
    await client.query("INSERT INTO draft_assets(visualisation_id,asset_id) VALUES($1,$2)", [visualisationId, assetId]);
  }
}

export async function syncVersionAssetReferences(client: DbClient, versionId: string, document: VisualisationDocument) {
  for (const assetId of referencedAssetIds(document)) {
    await client.query("INSERT INTO version_assets(version_id,asset_id) VALUES($1,$2)", [versionId, assetId]);
  }
}
