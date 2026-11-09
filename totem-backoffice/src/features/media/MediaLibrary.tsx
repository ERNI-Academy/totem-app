"use client";
import { useEffect, useMemo, useState } from "react";
import { BlockBlobClient } from "@azure/storage-blob";
import { IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";

export type MediaAsset = { id: string; fileName: string; contentType: string; sizeBytes: number; createdAt: string; url: string; tags: string[]; isSystem?: boolean };
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
const typeFromExtension: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4" };

export function MediaLibrary({ selecting, protectedAssetIds, onPick, mediaType }: { mediaType?: "image" | "video" | "any"; selecting: boolean; protectedAssetIds: string[]; onPick: (asset: MediaAsset) => void }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const knownTags = useMemo(() => [...new Set(assets.flatMap(asset => asset.tags ?? []))].sort((a,b)=>a.localeCompare(b)), [assets]);
  const filteredAssets = useMemo(() => assets.filter(asset => {
    const nameMatches = asset.fileName.toLocaleLowerCase().includes(nameFilter.trim().toLocaleLowerCase());
    const tagMatches = !tagFilter || (asset.tags ?? []).includes(tagFilter);
    const typeMatches = !mediaType || mediaType === "any" || asset.contentType.startsWith(`${mediaType}/`);
    return nameMatches && tagMatches && typeMatches;
  }), [assets, nameFilter, tagFilter, mediaType]);

  useEffect(() => {
    fetch("/api/assets").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load media library.");
      setAssets(data.assets.map((asset: MediaAsset) => ({ ...asset, tags: asset.tags ?? [] })));
    }).catch((error: Error) => setMessage(error.message));
  }, [refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        const contentType = supportedTypes.has(file.type) ? file.type : typeFromExtension[extension];
        if (!contentType) throw new Error(`${file.name}: use a JPEG, PNG, WebP or MP4 file.`);
        const response = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType, sizeBytes: file.size }) });
        const ticket = await response.json();
        if (!response.ok) throw new Error(ticket.error || `Could not prepare ${file.name}.`);
        await new BlockBlobClient(ticket.uploadUrl).uploadData(file, { blobHTTPHeaders: { blobContentType: contentType } });
        const confirmation = await fetch("/api/assets/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: ticket.assetId, blobName: ticket.blobName, fileName: file.name, contentType }) });
        const result = await confirmation.json();
        if (!confirmation.ok) throw new Error(result.error || `Could not add ${file.name} to the library.`);
      }
      setMessage(`${files.length} media file${files.length === 1 ? "" : "s"} added to the shared library.`);
      setRefresh(value => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  function openEditor(asset: MediaAsset) {
    setEditing(asset); setEditName(asset.fileName); setEditTags(asset.tags ?? []); setNewTag(""); setMessage("");
  }
  async function saveMetadata() {
    if (!editing) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assets/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: editName, tags: editTags }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update media details.");
      setAssets(current => current.map(asset => asset.id === editing.id ? { ...data.asset, isSystem: asset.isSystem } : asset));
      setEditing(null); setMessage("Image details saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update media details."); }
    finally { setBusy(false); }
  }
  function addTag() {
    const tag = newTag.trim(); if (!tag) return;
    const match = knownTags.find(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
    const value = match ?? tag;
    setEditTags(current => current.includes(value) ? current : [...current, value]);
    setNewTag("");
  }
  async function remove(asset: MediaAsset) {
    if (protectedAssetIds.includes(asset.id)) { setMessage("This image is used by the draft currently open in the editor. Save or remove it there before deleting the image."); return; }
    if (!window.confirm(`Delete “${asset.fileName}” from the shared library?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete image.");
      setAssets(current => current.filter(item => item.id !== asset.id));
      setMessage("Image deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete image."); }
    finally { setBusy(false); }
  }

  return <div className="page-heading media-library" style={{ display: "block" }}>
    <div className="page-heading"><div><div className="eyebrow">SHARED ASSETS</div><h1>Media library</h1><p>Images, reusable PNG icons and videos are shared by users of this environment.</p></div>
      <label className="primary-button compact media-upload"><IconPlus size={17}/>{busy ? "Uploading…" : "Upload media"}<input type="file" accept={mediaType === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"} multiple disabled={busy} onChange={event => { void upload(event.target.files); event.currentTarget.value = ""; }}/></label>
    </div>
    {selecting && <p className="media-hint">Choose a {mediaType === "video" ? "video" : "PNG icon or image"} to add it to the selected element.</p>}
    <div className="media-filters"><label>Filter by name<input aria-label="Filter images by name" value={nameFilter} onChange={event => setNameFilter(event.target.value)} placeholder="Search name…" /></label><label>Filter by tag<select aria-label="Filter images by tag" value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">All tags</option>{knownTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label></div>
    {message && <p role="status" className="media-message">{message}</p>}
    {filteredAssets.length ? <div className="media-grid">{filteredAssets.map(asset => {
      const inUse = protectedAssetIds.includes(asset.id) || Boolean(asset.isSystem);
      const matchesType = !mediaType || mediaType === "any" || asset.contentType.startsWith(`${mediaType}/`);
      return <article className="media-card" key={asset.id}>
        <button className="media-card-pick" onClick={() => selecting ? onPick(asset) : openEditor(asset)} disabled={selecting && !matchesType} title={selecting ? `Use ${asset.fileName}` : `Edit ${asset.fileName}`}>
          {asset.contentType.startsWith("video/") ? <video src={asset.url} muted playsInline preload="metadata"/> : <img src={asset.url} alt={asset.fileName}/>}
          <span>{asset.fileName}</span><small>{(asset.sizeBytes / 1024).toFixed(0)} KB</small>
          {!!asset.tags?.length && <span className="media-card-tags">{asset.tags.map(tag => <i key={tag}>{tag}</i>)}</span>}
        </button>
        <div className="media-card-actions"><button className="media-card-edit" onClick={() => openEditor(asset)} title="Edit name and tags">Details</button><button className="media-card-delete" onClick={() => void remove(asset)} disabled={busy || inUse} title={asset.isSystem ? "Default Totem original resource" : inUse ? "Used by the open draft" : "Delete media"}><IconTrash size={16}/>Delete</button></div>
      </article>;
    })}</div> : <div className="empty-state"><div className="empty-icon"><IconPhoto size={28}/></div><h2>{assets.length ? "No matching media" : "Your library is empty"}</h2><p>{assets.length ? "Try another name or tag filter." : "Upload JPG, PNG, WebP or MP4 files (up to 250 MB)."}</p></div>}
    {editing && <div className="media-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditing(null); }}><section className="media-modal" role="dialog" aria-modal="true" aria-labelledby="media-modal-title">
      <h2 id="media-modal-title">Image details</h2><p className="media-modal-filename">{editing.fileName}</p>
      <label>Name<input autoFocus aria-label="Image name" value={editName} maxLength={260} onChange={event => setEditName(event.target.value)} /></label>
      <label>Tags<select aria-label="Image tags" multiple size={Math.min(6, Math.max(3, knownTags.length))} value={editTags} onChange={event => setEditTags(Array.from(event.target.selectedOptions, option => option.value))}>{knownTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select><small>Choose one or more existing tags. New tags are saved for later use.</small></label>
      <div className="media-new-tag"><input aria-label="New tag" value={newTag} maxLength={40} onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Write a new tag…"/><button type="button" className="outline-button" onClick={addTag}><IconPlus size={15}/>Add tag</button></div>
      {!!editTags.length && <div className="media-selected-tags">{editTags.map(tag => <button type="button" key={tag} onClick={() => setEditTags(current => current.filter(item => item !== tag))} title={`Remove ${tag}`}>{tag} ×</button>)}</div>}
      <div className="media-modal-actions"><button className="outline-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="primary-button compact" disabled={busy || !editName.trim()} onClick={() => void saveMetadata()}>{busy ? "Saving…" : "Save"}</button></div>
    </section></div>}
  </div>;
}
