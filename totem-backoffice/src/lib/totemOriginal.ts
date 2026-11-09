import manifest from '../../../packages/totem-original/manifest.json';
export const originalManifest = manifest;
export const originalBlobPrefix = `totem-original/${manifest.packSha256}`;
export function originalResource(path: string) {
  const entry = manifest.resources.find(resource => resource.path === path);
  return entry ? { ...entry, blobName: `${originalBlobPrefix}/${entry.path}` } : undefined;
}
