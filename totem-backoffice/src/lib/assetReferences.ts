import "server-only";
import { sql } from "@/lib/db";
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

export async function syncDraftAssetReferences(transaction: sql.Transaction, visualisationId: string, document: VisualisationDocument) {
  await new sql.Request(transaction).input("visualisation", sql.UniqueIdentifier, visualisationId)
    .query("DELETE dbo.DraftAssets WHERE VisualisationId=@visualisation");
  for (const assetId of referencedAssetIds(document)) {
    await new sql.Request(transaction).input("visualisation", sql.UniqueIdentifier, visualisationId).input("asset", sql.UniqueIdentifier, assetId)
      .query("INSERT dbo.DraftAssets(VisualisationId,AssetId) VALUES(@visualisation,@asset)");
  }
}

export async function syncVersionAssetReferences(transaction: sql.Transaction, versionId: string, document: VisualisationDocument) {
  for (const assetId of referencedAssetIds(document)) {
    await new sql.Request(transaction).input("version", sql.UniqueIdentifier, versionId).input("asset", sql.UniqueIdentifier, assetId)
      .query("INSERT dbo.VersionAssets(VersionId,AssetId) VALUES(@version,@asset)");
  }
}
