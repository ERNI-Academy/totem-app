"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Moveable from "react-moveable";
import { ColorPicker } from "@/features/dashboard/ColorPicker";
import { TotemPreview } from "@/features/dashboard/TotemPreview";
import { MediaLibrary, type MediaAsset } from "@/features/media/MediaLibrary";
import {
  IconDeviceTv,
  IconUsers,
  IconTemplate,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconCopy,
  IconTrash,
  IconLock,
  IconLockOpen,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconDeviceFloppy,
  IconSend,
  IconLogout,
  IconLayersIntersect,
  IconChevronDown,
  IconLayoutDashboard,
} from "@tabler/icons-react";
import type {
  AppUser,
  CanvasElement,
  Screen,
  Visualisation,
  VisualisationDocument,
} from "@/types/content";

const initialDoc = (name: string): VisualisationDocument => ({
  schemaVersion: 1,
  width: 1080,
  height: 1920,
  name,
  screens: [
    {
      id: "home",
      name: "Home",
      mode: "embedded",
      elements: [
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 72,
          y: 72,
          width: 900,
          height: 100,
          text: "Your experience starts here",
          fontSize: 52,
          color: "#17366f",
          locked: false,
        },
        {
          id: crypto.randomUUID(),
          type: "card",
          x: 72,
          y: 240,
          width: 420,
          height: 230,
          title: "A new idea",
          description: "Add a short introduction",
          target: "detail",
          background: "#f2f2f2",
        },
      ],
    },
    {
      id: "detail",
      name: "Detail",
      mode: "fullscreen",
      elements: [
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 72,
          y: 130,
          width: 900,
          height: 130,
          text: "Experience detail",
          fontSize: 64,
          color: "#ffffff",
          locked: true,
        },
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 72,
          y: 330,
          width: 900,
          height: 220,
          text: "Add the content visitors need to explore.",
          fontSize: 38,
          color: "#ffffff",
        },
      ],
    },
  ],
});
type Tab = "visualisations" | "templates" | "users" | "devices" | "media";

export function Dashboard() {
  const [user, setUser] = useState<AppUser | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<Visualisation[]>([]),
    [selected, setSelected] = useState<Visualisation | null>(null),
    [draft, setDraft] = useState<VisualisationDocument | null>(null);
  const [tab, setTab] = useState<Tab>("visualisations"),
    [activeScreen, setActiveScreen] = useState("home"),
    [activeElement, setActiveElement] = useState<string | null>(null);
  const [selectingForElement, setSelectingForElement] = useState<string | null>(
    null,
  );
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false),
    [preview, setPreview] = useState(false),
    [layerOrder, setLayerOrder] = useState<string[]>([]);
  const screens = draft?.screens ?? [];
  const screen = screens.find((s) => s.id === activeScreen) ?? screens[0];
  const chosen = screen?.elements.find(
    (x) => x.id === activeElement && !x.locked,
  );
  const canvasRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && preview) node.focus();
    },
    [preview],
  );
  const reload = useCallback(async () => {
    const r = await fetch("/api/visualisations");
    if (r.status === 401) {
      setUser(null);
      return;
    }
    const d = await r.json();
    if (r.ok) setItems(d.visualisations);
  }, []);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => (r.ok ? (await r.json()).user : null))
      .then(async (u) => {
        setUser(u);
        if (u) await reload();
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [reload]);
  const filtered = useMemo(
    () =>
      items.filter((x) => x.name.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const protectedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of draft?.screens ?? [])
      for (const e of s.elements) {
        const match = /^\/api\/assets\/([0-9a-f-]{36})\/file$/i.exec(
          e.src ?? "",
        );
        if (match) ids.add(match[1]);
      }
    return [...ids];
  }, [draft]);
  async function login(form: FormData) {
    setLoginError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setLoginError(d.error || "Sign in failed");
      return;
    }
    const me = await fetch("/api/auth/me").then((x) => x.json());
    setUser(me.user);
    await reload();
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSelected(null);
    setDraft(null);
  }
  function selectItem(item: Visualisation) {
    setSelected(item);
    setDraft(structuredClone(item.document ?? initialDoc(item.name)));
    setActiveScreen(item.document?.screens[0]?.id ?? "home");
    setActiveElement(null);
    setPreview(false);
  }
  async function create() {
    const name = prompt("Name your visualisation");
    if (!name?.trim()) return;
    const r = await fetch("/api/visualisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        document: initialDoc(name.trim()),
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Could not create visualisation");
      return;
    }
    await reload();
    setNotice("Draft created");
  }
  async function save() {
    if (!selected || !draft) return;
    setSaving(true);
    const r = await fetch(`/api/visualisations/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.name,
        revision: selected.revision,
        document: draft,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setNotice(d.error || "Could not save");
      return;
    }
    setSelected({
      ...selected,
      revision: d.revision,
      updatedAt: new Date().toISOString(),
    });
    setNotice("All changes saved");
    await reload();
  }
  async function publish() {
    if (!selected || selected.isProtected) return;
    if (
      !confirm(
        `Publish “${selected.name}”? The new version will be added to the catalogue.`,
      )
    )
      return;
    const r = await fetch(`/api/visualisations/${selected.id}/publish`, {
      method: "POST",
    });
    const d = await r.json();
    setNotice(
      r.ok ? `Published version ${d.version}` : d.error || "Publish failed",
    );
    await reload();
  }
  async function createFromTemplate() {
    const templates = await fetch("/api/templates").then((r) => r.json());
    const template = templates.templates?.find(
      (t: { isSystem: boolean }) => t.isSystem,
    );
    if (!template) {
      setNotice("The ERNI template could not be loaded.");
      return;
    }
    const name = prompt("Name your visualisation", "New visualisation");
    if (!name?.trim()) return;
    const document = { ...template.document, name: name.trim() };
    const r = await fetch("/api/visualisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), document }),
    });
    const d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Could not create visualisation");
      return;
    }
    await reload();
    setNotice("Draft created from ERNI base template");
  }
  async function duplicate(item: Visualisation) {
    const r = await fetch("/api/visualisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${item.name} (copy)`,
        document: item.document,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Duplicate name exists; rename the new draft.");
      return;
    }
    await reload();
    setNotice("Copy created");
  }
  async function remove(item: Visualisation) {
    if (
      item.isProtected ||
      !confirm(
        `Delete “${item.name}”? Active devices keep their downloaded copy.`,
      )
    )
      return;
    const r = await fetch(`/api/visualisations/${item.id}`, {
      method: "DELETE",
    });
    const d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Delete failed");
      return;
    }
    setSelected(null);
    setDraft(null);
    await reload();
    setNotice("Visualisation deleted");
  }
  function updateElement(id: string, changes: Partial<CanvasElement>) {
    setDraft(
      (d) =>
        d && {
          ...d,
          screens: d.screens.map((s) =>
            s.id === activeScreen
              ? {
                  ...s,
                  elements: s.elements.map((e) =>
                    e.id === id ? { ...e, ...changes } : e,
                  ),
                }
              : s,
          ),
        },
    );
  }
  function pickMedia(asset: MediaAsset) {
    if (!selectingForElement) return;
    updateElement(selectingForElement, {
      src: asset.url,
      title: asset.fileName,
    });
    setSelectingForElement(null);
    setTab("visualisations");
    setNotice("Image selected. Save the draft to keep it.");
  }
  function addElement(type: CanvasElement["type"]) {
    if (!screen) return;
    const offset = screen.elements.length * 28;
    const el: CanvasElement = {
      id: crypto.randomUUID(),
      type,
      x: 72 + (offset % 200),
      y: 180 + offset,
      width: type === "text" ? 650 : 340,
      height: type === "text" ? 100 : 160,
      text: type === "text" ? "New text" : "",
      title: type === "card" ? "New card" : undefined,
      description: type === "card" ? "Add a description" : undefined,
      color: "#17366f",
      fontSize: 36,
      background: type === "card" ? "#f2f2f2" : undefined,
    };
    setDraft(
      (d) =>
        d && {
          ...d,
          screens: d.screens.map((s) =>
            s.id === activeScreen ? { ...s, elements: [...s.elements, el] } : s,
          ),
        },
    );
    setActiveElement(el.id);
  }
  function reorder(id: string, delta: number) {
    if (!screen) return;
    const index = screen.elements.findIndex((x) => x.id === id),
      next = index + delta;
    if (index < 0 || next < 0 || next >= screen.elements.length) return;
    const els = [...screen.elements];
    [els[index], els[next]] = [els[next], els[index]];
    setDraft(
      (d) =>
        d && {
          ...d,
          screens: d.screens.map((s) =>
            s.id === activeScreen ? { ...s, elements: els } : s,
          ),
        },
    );
  }
  useEffect(() => {
    if (!selected || !chosen || preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Del") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      event.preventDefault();
      const id = chosen.id;
      setDraft(
        (current) =>
          current && {
            ...current,
            screens: current.screens.map((item) =>
              item.id === activeScreen
                ? {
                    ...item,
                    elements: item.elements.filter(
                      (element) => element.id !== id,
                    ),
                  }
                : item,
            ),
          },
      );
      setActiveElement((current) => (current === id ? null : current));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScreen, chosen?.id, preview, selected]);

  if (authLoading)
    return (
      <main className="loading-screen">
        <span className="spinner" />
        Loading Totem Backoffice
      </main>
    );
  if (!user)
    return (
      <main className="auth-page">
        <form className="auth-card" action={login}>
          <a href="/" className="brand-word">
            <span className="brand-mark">e</span> ERNI
          </a>
          <p className="eyebrow">TOTEM BACKOFFICE</p>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to manage your kiosk experiences.</p>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {loginError && (
            <p className="form-error" role="alert">
              {loginError}
            </p>
          )}
          <button className="primary-button">Sign in</button>
          <a className="setup-link" href="/setup">
            Initial administrator setup
          </a>
          <p className="secure-note">Your work is saved securely in Totem.</p>
        </form>
      </main>
    );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/" className="brand-word">
          <span className="brand-mark">e</span> ERNI{" "}
          <span className="brand-divider" />{" "}
          <span className="brand-product">Totem Backoffice</span>
        </a>
        <div className="topbar-right">
          <span className="env-pill">
            <i /> {process.env.NEXT_PUBLIC_APP_ENV_LABEL ?? "Workspace"}
          </span>
          <span className="user-badge">
            {user.displayName
              .split(/\s/)
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="user-name">
            {user.displayName}
            <small>{user.role}</small>
          </span>
          <button className="icon-button" onClick={logout} title="Sign out">
            <IconLogout size={19} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-label">WORKSPACE</div>
          <nav className="nav-list">
            {(
              [
                ["visualisations", "Visualisations", IconDeviceTv],
                ["templates", "Templates", IconTemplate],
                ["users", "Users", IconUsers],
                ["devices", "Devices", IconDeviceTv],
                ["media", "Media", IconPhoto],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                className={`nav-item ${tab === key ? "selected" : ""}`}
                onClick={() => {
                  const returning = key === "visualisations" && tab === "media";
                  setTab(key);
                  if (key !== "media" && !returning) {
                    setSelected(null);
                    setDraft(null);
                    setSelectingForElement(null);
                  }
                }}
              >
                <Icon size={19} />
                {label}
                {key === "visualisations" && (
                  <span className="nav-count">{items.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="status-dot" />
            <span>
              Connected to workspace<small>Content sync ready</small>
            </span>
          </div>
        </aside>
        <section className="main-area">
          {tab === "visualisations" && !selected && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CONTENT MANAGEMENT</div>
                  <h1>Visualisations</h1>
                  <p>
                    Design and publish experiences for your Swiss Tech Center.
                  </p>
                </div>
                <button className="primary-button compact" onClick={create}>
                  <IconPlus size={18} /> New visualisation
                </button>
              </div>
              <div className="filter-row">
                <div className="search-box">
                  <IconSearch size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search visualisations"
                    aria-label="Search visualisations"
                  />
                </div>
                <span className="result-count">
                  {filtered.length} visualisations
                </span>
              </div>
              {filtered.length === 0 ? (
                <Empty onCreate={create} />
              ) : (
                <div className="visual-grid">
                  {filtered.map((v, i) => (
                    <article key={v.id} className="visual-card">
                      <button
                        className="visual-preview"
                        onClick={() => selectItem(v)}
                        aria-label={`Open ${v.name}`}
                      >
                        <div className={`preview-art preview-art-${i % 4}`}>
                          <span className="preview-top" />
                          <div className="preview-content">
                            <span className="preview-kicker">
                              {v.isProtected
                                ? "OFFICIAL ERNI TEMPLATE"
                                : "SWISS TECH CENTER"}
                            </span>
                            <strong>{v.name}</strong>
                            <span className="preview-lines" />
                            <span className="preview-blocks">
                              <i />
                              <i />
                              <i />
                            </span>
                          </div>
                          <span className="preview-footer" />
                        </div>
                        <span className="preview-open">
                          <IconEye size={16} /> Preview & edit
                        </span>
                      </button>
                      <div className="visual-card-body">
                        <div className="visual-card-title">
                          <h3>{v.name}</h3>
                          {v.isProtected ? (
                            <span className="tag system">
                              <IconLock size={12} /> Protected
                            </span>
                          ) : (
                            <span className="tag published">
                              v{v.latestPublishedVersion ?? "Draft"}
                            </span>
                          )}
                        </div>
                        <p>
                          Updated{" "}
                          {new Intl.DateTimeFormat("en-GB", {
                            dateStyle: "medium",
                          }).format(new Date(v.updatedAt))}
                        </p>
                        <div className="card-actions">
                          <button onClick={() => selectItem(v)}>
                            Edit draft <IconArrowRight size={15} />
                          </button>
                          <div>
                            <button
                              className="small-icon"
                              title="Duplicate"
                              onClick={() => duplicate(v)}
                            >
                              <IconCopy size={16} />
                            </button>
                            <button
                              className="small-icon danger"
                              title="Delete"
                              disabled={v.isProtected}
                              onClick={() => remove(v)}
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === "templates" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">START WITH A TEMPLATE</div>
                  <h1>Templates</h1>
                  <p>
                    Protected building blocks for consistent kiosk experiences.
                  </p>
                </div>
              </div>
              <div className="template-feature">
                <div className="template-poster">
                  <div className="poster-header">
                    e ERNI <span>better ask ERNI</span>
                  </div>
                  <div className="poster-hero">
                    <small>WELCOME TO THE</small>
                    <strong>
                      Swiss Tech
                      <br />
                      Center
                    </strong>
                    <span>Engineering trust in the age of AI</span>
                  </div>
                  <div className="poster-canvas">
                    <b>Touch a demo to explore</b>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="poster-foot">
                    OUR AI VISION{" "}
                    <strong>From AI idea to value in production</strong>
                  </div>
                </div>
                <div className="template-copy">
                  <span className="tag system">
                    <IconLock size={12} /> SYSTEM TEMPLATE
                  </span>
                  <h2>ERNI base template</h2>
                  <p>
                    The current Swiss Tech Center layout, ready for your next
                    visualisation. The header, hero and footer are locked by
                    default; the centre canvas is yours to edit.
                  </p>
                  <div className="template-stats">
                    <span>
                      <b>1080 × 1920</b>Portrait canvas
                    </span>
                    <span>
                      <b>1,080 × 1,080</b>Editable area
                    </span>
                  </div>
                  <button
                    className="primary-button compact"
                    onClick={() => createFromTemplate()}
                  >
                    <IconPlus size={17} /> Create from template
                  </button>
                </div>
              </div>
            </>
          )}
          {tab === "users" && <UsersPanel currentUser={user} />}
          {tab === "devices" && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">CONNECTED KIOSKS</div>
                <h1>Devices</h1>
                <p>
                  Device registration and status will appear here once kiosk
                  sync is configured.
                </p>
              </div>
            </div>
          )}
          {tab === "media" && (
            <MediaLibrary
              selecting={Boolean(selectingForElement)}
              protectedAssetIds={protectedAssetIds}
              onPick={pickMedia}
            />
          )}
          {tab === "visualisations" && selected && draft && (
            <div className="editor-page">
              <div className="editor-toolbar">
                <button
                  className="back-button"
                  onClick={() => {
                    setSelected(null);
                    setDraft(null);
                    setPreview(false);
                    void reload();
                  }}
                >
                  <IconArrowLeft size={18} /> All visualisations
                </button>
                <span className="toolbar-sep" />
                <input
                  className="title-input"
                  value={selected.name}
                  disabled={selected.isProtected}
                  onChange={(e) => {
                    setSelected({ ...selected, name: e.target.value });
                    setDraft({ ...draft, name: e.target.value });
                  }}
                  aria-label="Visualisation name"
                />
                <span className="save-state">
                  <i className={saving ? "saving" : ""} />
                  {notice || (saving ? "Saving…" : "All changes saved")}
                </span>
                <button
                  className="outline-button"
                  onClick={() => {
                    setPreviewScreenId(null);
                    setPreview((value) => !value);
                  }}
                >
                  <IconEye size={17} />
                  {preview ? "Editing" : "Preview"}
                </button>
                <button
                  className="outline-button"
                  disabled={selected.isProtected || saving}
                  onClick={save}
                >
                  <IconDeviceFloppy size={17} />
                  Save
                </button>
                <button
                  className="primary-button compact"
                  disabled={selected.isProtected}
                  onClick={publish}
                >
                  <IconSend size={16} />
                  Publish
                </button>
              </div>
              <div
                className={"editor-layout" + (preview ? " preview-layout" : "")}
              >
                <aside className="editor-panel tools-panel">
                  <div className="panel-heading">ADD ELEMENT</div>
                  <div className="element-tools">
                    <button onClick={() => addElement("text")}>
                      <span className="type-icon">T</span>Text
                    </button>
                    <button onClick={() => addElement("image")}>
                      <IconPhoto />
                      Image
                    </button>
                    <button onClick={() => addElement("video")}>
                      <span className="type-icon">▶</span>Video
                    </button>
                    <button onClick={() => addElement("card")}>
                      <IconTemplate />
                      Card
                    </button>
                    <button onClick={() => addElement("button")}>
                      <span className="type-icon">↗</span>Button
                    </button>
                  </div>
                  <div className="panel-heading layers-title">
                    <IconLayersIntersect size={16} /> LAYERS{" "}
                    <button
                      title="Add screen"
                      onClick={() => {
                        const next = {
                          id: crypto.randomUUID(),
                          name: `Detail ${screens.length}`,
                          mode: "fullscreen" as const,
                          elements: [],
                        };
                        setDraft({ ...draft, screens: [...screens, next] });
                        setActiveScreen(next.id);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="layer-list">
                    {screen?.elements
                      .slice()
                      .reverse()
                      .map((el) => (
                        <div
                          key={el.id}
                          className={`layer-row ${activeElement === el.id ? "active" : ""}`}
                        >
                          <button
                            className="layer-name"
                            onClick={() => setActiveElement(el.id)}
                          >
                            <span className="layer-symbol">
                              {el.type === "text"
                                ? "T"
                                : el.type === "card"
                                  ? "▧"
                                  : "◈"}
                            </span>
                            {(el.title || el.text || el.type).slice(0, 23)}
                          </button>
                          <button
                            className="layer-lock"
                            title={el.locked ? "Locked" : "Unlocked"}
                            onClick={() =>
                              updateElement(el.id, { locked: !el.locked })
                            }
                          >
                            {el.locked ? (
                              <IconLock size={14} />
                            ) : (
                              <IconLockOpen size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                  </div>
                  <p className="panel-hint">
                    Locked items cannot be moved, changed or deleted until you
                    unlock them.
                  </p>
                </aside>
                <div
                  className={`canvas-workspace ${preview ? "preview-mode" : ""}`}
                >
                  <div className="canvas-meta">
                    <div className="screen-tabs">
                      {screens.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setActiveScreen(s.id);
                            setActiveElement(null);
                          }}
                          className={activeScreen === s.id ? "active" : ""}
                        >
                          {s.name}
                          <small>
                            {s.mode === "embedded"
                              ? "CENTRE CANVAS"
                              : "FULL SCREEN"}
                          </small>
                        </button>
                      ))}
                    </div>
                    <span>1080 × 1920 px</span>
                  </div>
                  {preview ? (
                    <TotemPreview
                      document={draft}
                      screenId={previewScreenId}
                      onNavigate={setPreviewScreenId}
                    />
                  ) : (
                    <div
                      className={`canvas-viewport ${screen?.mode === "embedded" ? "embedded-view" : "full-view"}`}
                    >
                      <div
                        ref={canvasRef}
                        className="canvas"
                        style={{
                          width: screen?.mode === "embedded" ? "100%" : 520,
                          aspectRatio: "9 / 16",
                        }}
                        tabIndex={preview ? 0 : -1}
                        onClick={(e) => {
                          if (preview && e.target === e.currentTarget)
                            setActiveElement(null);
                        }}
                      >
                        {screen?.elements.map((el) => (
                          <div
                            key={el.id}
                            data-element-id={el.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!preview && !el.locked)
                                setActiveElement(el.id);
                              if (
                                preview &&
                                el.target &&
                                screens.some((s) => s.id === el.target)
                              )
                                setActiveScreen(el.target);
                            }}
                            className={`canvas-element ${el.type} ${activeElement === el.id && !preview ? "is-selected" : ""} ${el.locked ? "is-locked" : ""}`}
                            style={{
                              left: `${(el.x / 1080) * 100}%`,
                              top: `${(el.y / (screen.mode === "embedded" ? 1080 : 1920)) * 100}%`,
                              width: `${(el.width / 1080) * 100}%`,
                              height: `${(el.height / (screen.mode === "embedded" ? 1080 : 1920)) * 100}%`,
                              background: el.background,
                              padding:
                                el.type === "image" && el.imageNoPadding
                                  ? 0
                                  : undefined,
                              color: el.color || "#17366f",
                              fontSize: `${Math.max(10, el.fontSize || 28) * Math.max(0.27, Math.min(0.5, 520 / 1080))}px`,
                            }}
                          >
                            {el.type === "card" ? (
                              <>
                                <span className="mini-card-icon">◉</span>
                                <strong>{el.title}</strong>
                                <small>{el.description}</small>
                                <em>See it in action →</em>
                              </>
                            ) : el.type === "image" ? (
                              el.src ? (
                                <img
                                  src={el.src}
                                  alt={el.title || "Selected image"}
                                  draggable={false}
                                />
                              ) : (
                                <span>▧ Choose an image in properties</span>
                              )
                            ) : el.type === "video" ? (
                              <span>▶ Video placeholder</span>
                            ) : (
                              el.text || el.title || "Button"
                            )}
                          </div>
                        ))}
                      </div>
                      {chosen && !preview && (
                        <Moveable
                          key={`${activeScreen}:${chosen.id}:${chosen.x}:${chosen.y}:${chosen.width}:${chosen.height}`}
                          target={`[data-element-id="${chosen.id}"]`}
                          draggable
                          resizable
                          snappable
                          origin={false}
                          onDrag={({
                            target,
                            transform,
                          }: {
                            target: HTMLElement | SVGElement;
                            transform: string;
                          }) => {
                            target.style.transform = transform;
                          }}
                          onDragEnd={({
                            target,
                          }: {
                            target: HTMLElement | SVGElement;
                          }) => {
                            const rect = target.getBoundingClientRect(),
                              parent =
                                target.parentElement!.getBoundingClientRect(),
                              scale = 1080 / parent.width;
                            updateElement(chosen.id, {
                              x: Math.max(
                                0,
                                Math.round((rect.left - parent.left) * scale),
                              ),
                              y: Math.max(
                                0,
                                Math.round((rect.top - parent.top) * scale),
                              ),
                            });
                            target.style.transform = "";
                          }}
                          onResize={({
                            target,
                            width,
                            height,
                            drag,
                          }: {
                            target: HTMLElement | SVGElement;
                            width: number;
                            height: number;
                            drag: { transform: string };
                          }) => {
                            target.style.width = `${width}px`;
                            target.style.height = `${height}px`;
                            target.style.transform = drag.transform;
                          }}
                          onResizeEnd={({
                            target,
                          }: {
                            target: HTMLElement | SVGElement;
                          }) => {
                            const rect = target.getBoundingClientRect(),
                              parent =
                                target.parentElement!.getBoundingClientRect(),
                              scale = 1080 / parent.width;
                            updateElement(chosen.id, {
                              width: Math.max(
                                40,
                                Math.round(rect.width * scale),
                              ),
                              height: Math.max(
                                40,
                                Math.round(rect.height * scale),
                              ),
                              x: Math.max(
                                0,
                                Math.round((rect.left - parent.left) * scale),
                              ),
                              y: Math.max(
                                0,
                                Math.round((rect.top - parent.top) * scale),
                              ),
                            });
                            target.style.transform = "";
                          }}
                        />
                      )}
                    </div>
                  )}
                  <p className="canvas-tip">
                    {preview
                      ? "Full kiosk preview. Click a linked card to open its screen, then use Back."
                      : "Select a layer to edit it. Drag to reposition. Press Delete to remove the selected element."}
                  </p>
                </div>
                <aside className="editor-panel props-panel">
                  <div className="panel-heading">PROPERTIES</div>
                  {chosen ? (
                    <>
                      <span className="property-type">
                        {chosen.type.toUpperCase()} ELEMENT
                      </span>
                      <label>
                        Layer name
                        <input
                          value={chosen.title || chosen.text || chosen.type}
                          onChange={(e) =>
                            updateElement(
                              chosen.id,
                              chosen.type === "card"
                                ? { title: e.target.value }
                                : { text: e.target.value },
                            )
                          }
                        />
                      </label>
                      {chosen.type === "image" && (
                        <button
                          className="outline-button"
                          onClick={() => {
                            setSelectingForElement(chosen.id);
                            setTab("media");
                          }}
                        >
                          <IconPhoto size={16} />
                          Choose from media library
                        </button>
                      )}
                      <div className="field-grid">
                        <label>
                          X{" "}
                          <input
                            type="number"
                            value={Math.round(chosen.x)}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                x: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Y{" "}
                          <input
                            type="number"
                            value={Math.round(chosen.y)}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                y: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Width{" "}
                          <input
                            type="number"
                            value={Math.round(chosen.width)}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                width: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Height{" "}
                          <input
                            type="number"
                            value={Math.round(chosen.height)}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                height: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                      {chosen.type === "card" && (
                        <>
                          <label>
                            Description
                            <textarea
                              value={chosen.description || ""}
                              onChange={(e) =>
                                updateElement(chosen.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Link to screen
                            <select
                              value={chosen.target || ""}
                              onChange={(e) =>
                                updateElement(chosen.id, {
                                  target: e.target.value,
                                })
                              }
                            >
                              <option value="">No destination</option>
                              {screens.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      {chosen.type === "image" && (
                        <label>
                          Image margins
                          <select
                            value={chosen.imageNoPadding ? "none" : "default"}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                imageNoPadding: e.target.value === "none",
                              })
                            }
                          >
                            <option value="default">With margins</option>
                            <option value="none">
                              No margins (fill frame)
                            </option>
                          </select>
                        </label>
                      )}
                      <div className="field-grid">
                        <label>
                          Text size
                          <input
                            type="number"
                            min="10"
                            max="240"
                            value={chosen.fontSize || 32}
                            onChange={(e) =>
                              updateElement(chosen.id, {
                                fontSize: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <ColorPicker
                          label="Text colour"
                          value={chosen.color || "#17366f"}
                          onChange={(color) =>
                            updateElement(chosen.id, { color })
                          }
                        />
                      </div>
                      <ColorPicker
                        label="Background"
                        value={chosen.background || "#f2f2f2"}
                        onChange={(background) =>
                          updateElement(chosen.id, { background })
                        }
                      />
                      <button
                        className="text-danger"
                        onClick={() => {
                          setDraft({
                            ...draft,
                            screens: draft.screens.map((s) =>
                              s.id === activeScreen
                                ? {
                                    ...s,
                                    elements: s.elements.filter(
                                      (e) => e.id !== chosen.id,
                                    ),
                                  }
                                : s,
                            ),
                          });
                          setActiveElement(null);
                        }}
                      >
                        Remove element
                      </button>
                      <div className="layer-controls">
                        <button
                          className="outline-button"
                          onClick={() => reorder(chosen.id, -1)}
                        >
                          <IconArrowLeft size={15} /> Send back
                        </button>
                        <button
                          className="outline-button"
                          onClick={() => reorder(chosen.id, 1)}
                        >
                          Bring forward <IconArrowRight size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="property-empty">
                      <IconLayoutDashboard size={23} />
                      <p>
                        Select an unlocked element to edit its content, size and
                        position.
                      </p>
                    </div>
                  )}
                  <div className="properties-footer">
                    <span>Canvas</span>
                    <strong>
                      1080 × {screen?.mode === "embedded" ? "1,080" : "1,920"}{" "}
                      px
                    </strong>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <IconDeviceTv size={28} />
      </div>
      <h2>No visualisations yet</h2>
      <p>Create an experience or start with the ERNI base template.</p>
      <button className="primary-button compact" onClick={onCreate}>
        <IconPlus size={17} /> Create visualisation
      </button>
    </div>
  );
}

function UsersPanel({ currentUser }: { currentUser: AppUser }) {
  const [users, setUsers] = useState<AppUser[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/users")
      .then(async (r) => (r.ok ? (await r.json()).users : []))
      .then(setUsers);
  }, []);
  const [show, setShow] = useState(false);
  if (currentUser.role !== "admin")
    return (
      <div className="page-heading">
        <div>
          <h1>Users</h1>
          <p>Only administrators can manage user accounts.</p>
        </div>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCESS CONTROL</div>
          <h1>Users</h1>
          <p>Manage the people who can update kiosk content.</p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setShow(!show)}
        >
          <IconPlus size={17} /> Add user
        </button>
      </div>
      {show && (
        <form
          className="inline-user-form"
          action={async (f) => {
            const r = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: f.get("email"),
                displayName: f.get("displayName"),
                role: f.get("role"),
              }),
            });
            const d = await r.json();
            setMessage(
              r.ok
                ? `Invitation prepared for ${d.user.email}. Copy and share this activation link: ${d.activationUrl}`
                : d.error,
            );
            if (r.ok) {
              setUsers([...users, d.user]);
              setShow(false);
            }
          }}
        >
          <input name="displayName" placeholder="Full name" required />
          <input name="email" type="email" placeholder="Email" required />
          <select name="role">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button className="primary-button compact">Add</button>
          {message && <p>{message}</p>}
        </form>
      )}
      <div className="users-list">
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <span className="user-badge">
              {u.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {u.displayName}
              <small>{u.email}</small>
            </span>
            <span className="tag">{u.role}</span>
            <button
              className="small-icon"
              disabled={u.id === currentUser.id}
              title="Deactivate user"
              onClick={async () => {
                if (!confirm(`Deactivate ${u.displayName}?`)) return;
                await fetch(`/api/users/${u.id}`, { method: "DELETE" });
                setUsers(users.filter((x) => x.id !== u.id));
              }}
            >
              Deactivate
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
