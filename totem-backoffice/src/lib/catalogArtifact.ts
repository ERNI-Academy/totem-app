import "server-only";
import { createHash } from "node:crypto";
import { getBlobClient } from "./blobStorage";
import { makeZip, type WebBundle } from "./webPublication";
import { renderThumbnail } from "./catalogThumbnail.mjs";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function putImmutable(key: string, bytes: Buffer, type: string) {
  const blob = getBlobClient(key).getBlockBlobClient();
  try {
    await blob.uploadData(bytes, {conditions:{ifNoneMatch:"*"}, blobHTTPHeaders:{blobContentType:type}});
  } catch (error) {
    // The key contains the digest. A retry may encounter its own completed upload.
    if (![409,412].includes((error as {statusCode:number}).statusCode) ||
        digest(await blob.downloadToBuffer()) !== digest(bytes)) throw error;
  }
}
export async function storeArtifact(versionId: string, bundle: WebBundle) {
  const thumbnail = await renderThumbnail(bundle.files);
  const zip = makeZip(bundle.files);
  const sha256 = digest(zip);
  const directory = `catalog/${versionId}`;
  const zipKey = `${directory}/${sha256}.zip`;
  const thumbKey = `${directory}/${digest(thumbnail)}.webp`;
  await Promise.all([putImmutable(zipKey,zip,"application/zip"),putImmutable(thumbKey,thumbnail,"image/webp")]);
  return {zipKey, thumbKey, sha256, size:zip.length, bundleSha256:bundle.manifest.bundleSha256};
}
