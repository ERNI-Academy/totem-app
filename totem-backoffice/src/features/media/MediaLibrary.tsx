"use client";
import { useEffect, useState } from "react";
import { BlockBlobClient } from "@azure/storage-blob";
import { IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";

export type MediaAsset = { id: string; fileName: string; contentType: string; sizeBytes: number; createdAt: string; url: string; isSystem?: boolean };

export function MediaLibrary({ selecting, protectedAssetIds, onPick, mediaType }: { mediaType?: "image" | "video"; selecting: boolean; protectedAssetIds: string[]; onPick: (asset: MediaAsset) => void }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    fetch("/api/assets").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load media library.");
      setAssets(data.assets);
    }).catch((error: Error) => setMessage(error.message));
  }, [refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      for (const file of Array.from(files)) {
        const response = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }) });
        const ticket = await response.json();
        if (!response.ok) throw new Error(ticket.error || `Could not prepare ${file.name}.`);
        await new BlockBlobClient(ticket.uploadUrl).uploadData(file, { blobHTTPHeaders: { blobContentType: file.type } });
        const confirmation = await fetch("/api/assets/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: ticket.assetId, blobName: ticket.blobName, fileName: file.name, contentType: file.type }) });
        const result = await confirmation.json();
        if (!confirmation.ok) throw new Error(result.error || `Could not add ${file.name} to the library.`);
      }
      setMessage(`${files.length} media file${files.length === 1 ? "" : "s"} added to the shared library.`);
      setRefresh((value) => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function remove(asset: MediaAsset) {
    if (protectedAssetIds.includes(asset.id)) { setMessage("This image is used by the draft currently open in the editor. Save or remove it there before deleting the image."); return; }
    if (!window.confirm(`Delete “${asset.fileName}” from the shared library?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete image.");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setMessage("Image deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete image."); }
    finally { setBusy(false); }
  }

  return <div className="page-heading" style={{ display: "block" }}>
    <div className="page-heading"><div><div className="eyebrow">SHARED ASSETS</div><h1>Media library</h1><p>Images, reusable PNG icons and videos are shared by users of this environment and stored in its private Azure Blob container.</p></div>
      <label className="primary-button compact media-upload"><IconPlus size={17}/>{busy ? "Uploading…" : "Upload media"}<input type="file" accept={mediaType === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"} multiple disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }}/></label>
    </div>
    {selecting && <p className="media-hint">Choose a {mediaType === "video" ? "video" : "PNG icon or image"} to add it to the selected element.</p>}
    {message && <p role="status" className="media-message">{message}</p>}
    {assets.length ? <div className="media-grid">{assets.map((asset) => {const inUse=protectedAssetIds.includes(asset.id)||Boolean(asset.isSystem);const matchesType=!mediaType||asset.contentType.startsWith(mediaType+"/");return <article className="media-card" key={asset.id}><button className="media-card-pick" onClick={() => selecting && onPick(asset)} disabled={!selecting||!matchesType} title={selecting ? `Use ${asset.fileName}` : asset.fileName}>{asset.contentType.startsWith("video/")?<video src={asset.url} muted playsInline preload="metadata"/>:<img src={asset.url} alt={asset.fileName}/>}<span>{asset.fileName}</span><small>{(asset.sizeBytes / 1024).toFixed(0)} KB</small></button><button className="media-card-delete" onClick={()=>void remove(asset)} disabled={busy||inUse} title={asset.isSystem?"Default Totem original resource":inUse?"Used by the open draft":"Delete media"}><IconTrash size={16}/>Delete</button></article>;})}</div> : <div className="empty-state"><div className="empty-icon"><IconPhoto size={28}/></div><h2>Your library is empty</h2><p>Upload JPG, PNG, WebP or MP4 files (up to 250 MB).</p></div>}
  </div>;
}
