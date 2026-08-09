/**
 * ChromeBoost HUD — the floating status window shown on the page while an
 * agent is driving the browser.
 *
 * A fixed, non-interactive badge welded to the top-right corner is the usual
 * approach, and it's wrong: on a lot of real sites that corner is exactly where
 * the page puts its own account menu, cart, or cookie banner, so the badge ends
 * up sitting on top of the very control the user (or the agent) needs to see.
 *
 * The ChromeBoost HUD is:
 *   - draggable anywhere in the viewport, with edge magnetism
 *   - collapsible to a compact pill (double-click the header, or the − button)
 *   - dismissible entirely (× button), restorable with Alt+Shift+B
 *   - persistent — position and state are stored in chrome.storage.local and
 *     restored on the next page, so you only ever move it once
 *   - rendered inside a closed shadow root so page CSS cannot restyle it and
 *     page scripts cannot query it
 *   - clamped back into view when the window is resized
 *
 * Only the panel itself receives pointer events; the host container stays
 * `pointer-events: none` so the HUD never eats a click meant for the page.
 */

const HUD_HOST_ID = "chromeboost-hud";
const STORAGE_KEY = "cbHudState";

/** Width of the expanded panel, used for clamping and corner snapping. */
const PANEL_W = 232;
const PANEL_H = 78;
const COLLAPSED_W = 150;
const COLLAPSED_H = 34;
const MARGIN = 12;
/** Distance from a viewport edge at which the panel snaps flush to it. */
const SNAP_PX = 28;

export type HudState = {
  /** Viewport-relative position of the panel's top-left corner, in CSS px. */
  x: number;
  y: number;
  collapsed: boolean;
  hidden: boolean;
};

export type HudInfo = {
  label?: string;
  port?: number;
  host?: string;
};

const DEFAULT_STATE: HudState = { x: -1, y: MARGIN, collapsed: false, hidden: false };

let state: HudState = { ...DEFAULT_STATE };
let info: HudInfo = {};
let hostEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let statusEl: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let detailEl: HTMLDivElement | null = null;
let listenersBound = false;
let statusResetTimer: number | null = null;

/** x = -1 means "not positioned yet" → default to the top-right corner. */
function resolveX(s: HudState, width: number): number {
  if (s.x < 0) return Math.max(MARGIN, window.innerWidth - width - MARGIN);
  return s.x;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

async function loadState(): Promise<void> {
  try {
    const got = await chrome.storage.local.get(STORAGE_KEY);
    const stored = got[STORAGE_KEY];
    if (stored && typeof stored === "object") {
      state = { ...DEFAULT_STATE, ...(stored as Partial<HudState>) };
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
}

function saveState(): void {
  try {
    void chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {
    /* best-effort */
  }
}

function currentSize(): { w: number; h: number } {
  return state.collapsed
    ? { w: COLLAPSED_W, h: COLLAPSED_H }
    : { w: PANEL_W, h: PANEL_H };
}

/** Apply `state.x/y` to the panel, clamping so it can never sit off-screen. */
function applyPosition(): void {
  if (!panelEl) return;
  const { w, h } = currentSize();
  const x = clamp(resolveX(state, w), MARGIN, Math.max(MARGIN, window.innerWidth - w - MARGIN));
  const y = clamp(state.y, MARGIN, Math.max(MARGIN, window.innerHeight - h - MARGIN));
  panelEl.style.left = `${Math.round(x)}px`;
  panelEl.style.top = `${Math.round(y)}px`;
}

function styles(): string {
  return `
    :host { all: initial; }
    .panel {
      position: fixed;
      box-sizing: border-box;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #111827;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08);
      user-select: none;
      overflow: hidden;
      width: ${PANEL_W}px;
      transition: box-shadow .15s ease, opacity .2s ease, width .16s ease;
      opacity: .97;
    }
    .panel.collapsed { width: ${COLLAPSED_W}px; }
    .panel.dragging { box-shadow: 0 14px 40px rgba(0,0,0,.22); opacity: 1; transition: none; }
    .panel:hover { opacity: 1; }

    .header {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 8px 7px 10px;
      cursor: grab;
      background: linear-gradient(180deg, #ffffff, #fafafa);
      border-bottom: 1px solid #f1f3f5;
    }
    .panel.collapsed .header { border-bottom: none; }
    .panel.dragging .header { cursor: grabbing; }

    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #6366f1; flex: none;
      box-shadow: 0 0 0 3px rgba(99,102,241,.18);
      animation: cb-breathe 1.8s ease-in-out infinite;
    }
    .title {
      font-size: 11px; font-weight: 700; letter-spacing: .05em;
      text-transform: uppercase; color: #4f46e5;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      flex: 1 1 auto; min-width: 0;
    }
    .btn {
      flex: none;
      width: 18px; height: 18px;
      display: grid; place-items: center;
      border: none; border-radius: 5px;
      background: transparent; color: #9ca3af;
      font-size: 13px; line-height: 1; cursor: pointer;
      padding: 0; font-family: inherit;
    }
    .btn:hover { background: #f3f4f6; color: #374151; }

    .body { padding: 0 10px 9px; }
    .panel.collapsed .body { display: none; }

    .detail {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; color: #6b7280;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin: 6px 0 5px;
    }
    .status {
      font-size: 11px; color: #374151;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 6px; min-height: 13px;
    }
    .track {
      height: 3px; background: #f3f4f6; border-radius: 2px;
      overflow: hidden; position: relative;
    }
    .fill {
      position: absolute; top: 0; height: 100%; border-radius: 2px;
      background: linear-gradient(90deg,#6366f1,#22d3ee,#6366f1);
      animation: cb-indeterminate 1.4s ease-in-out infinite;
    }

    @keyframes cb-indeterminate {
      0%   { left: -40%; width: 40%; }
      50%  { left: 30%;  width: 50%; }
      100% { left: 110%; width: 40%; }
    }
    @keyframes cb-breathe {
      0%,100% { box-shadow: 0 0 0 3px rgba(99,102,241,.18); }
      50%     { box-shadow: 0 0 0 5px rgba(34,211,238,.30); }
    }

    @media (prefers-color-scheme: dark) {
      .panel { background:#1f2124; color:#e5e7eb; border-color:#33363b;
               box-shadow: 0 6px 24px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.4); }
      .header { background: linear-gradient(180deg,#26282c,#1f2124); border-bottom-color:#2f3237; }
      .btn:hover { background:#31343a; color:#e5e7eb; }
      .detail { color:#9199a4; }
      .title { color:#a5b4fc; }
      .status { color:#c9cfd8; }
      .track { background:#2f3237; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dot, .fill { animation: none; }
      .panel { transition: none; }
    }
  `;
}

function buildDom(): void {
  const host = document.createElement("div");
  host.id = HUD_HOST_ID;
  // The host spans nothing and never intercepts input; only .panel does.
  host.style.cssText = `
    position: fixed; top: 0; left: 0; width: 0; height: 0;
    margin: 0; padding: 0; border: 0;
    pointer-events: none; z-index: 2147483646;
  `;
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = styles();
  shadow.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "header";

  const dot = document.createElement("div");
  dot.className = "dot";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "ChromeBoost";

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "btn";
  collapseBtn.type = "button";
  collapseBtn.title = "Collapse (double-click header)";
  collapseBtn.setAttribute("aria-label", "Collapse ChromeBoost HUD");
  collapseBtn.textContent = "–";

  const hideBtn = document.createElement("button");
  hideBtn.className = "btn";
  hideBtn.type = "button";
  hideBtn.title = "Hide (Alt+Shift+B to bring back)";
  hideBtn.setAttribute("aria-label", "Hide ChromeBoost HUD");
  hideBtn.textContent = "×";

  header.append(dot, title, collapseBtn, hideBtn);

  const body = document.createElement("div");
  body.className = "body";

  const detail = document.createElement("div");
  detail.className = "detail";

  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "Connected";

  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = "fill";
  track.appendChild(fill);

  body.append(detail, status, track);
  panel.append(header, body);
  shadow.appendChild(panel);
  document.documentElement.appendChild(host);

  hostEl = host;
  panelEl = panel;
  statusEl = status;
  titleEl = title;
  detailEl = detail;

  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setCollapsed(!state.collapsed);
  });
  hideBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setHudHidden(true);
  });
  header.addEventListener("dblclick", (e) => {
    e.preventDefault();
    setCollapsed(!state.collapsed);
  });

  attachDrag(header, panel);
}

/**
 * Pointer-capture drag. Uses pointer events (not mouse) so it works with
 * touch and pen, and captures on the header so a fast drag that outruns the
 * cursor doesn't drop the panel mid-move.
 */
function attachDrag(handle: HTMLElement, panel: HTMLDivElement): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let moved = false;

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    // Ignore clicks on the header buttons.
    if ((e.target as HTMLElement)?.classList?.contains("btn")) return;
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    originX = rect.left;
    originY = rect.top;
    panel.classList.add("dragging");
    try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    const { w, h } = currentSize();
    state.x = clamp(originX + dx, MARGIN, Math.max(MARGIN, window.innerWidth - w - MARGIN));
    state.y = clamp(originY + dy, MARGIN, Math.max(MARGIN, window.innerHeight - h - MARGIN));
    applyPosition();
  });

  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("dragging");
    try { handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (moved) {
      snapToEdges();
      saveState();
    }
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

/** Magnetically snap the panel flush to any viewport edge it was dropped near. */
function snapToEdges(): void {
  const { w, h } = currentSize();
  const maxX = window.innerWidth - w - MARGIN;
  const maxY = window.innerHeight - h - MARGIN;
  if (state.x - MARGIN < SNAP_PX) state.x = MARGIN;
  else if (maxX - state.x < SNAP_PX) state.x = maxX;
  if (state.y - MARGIN < SNAP_PX) state.y = MARGIN;
  else if (maxY - state.y < SNAP_PX) state.y = maxY;
  applyPosition();
}

function bindGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener("resize", () => {
    if (!panelEl) return;
    applyPosition();
  }, { passive: true });

  // Alt+Shift+B toggles the HUD back after it has been dismissed. Listening on
  // the capture phase so pages that swallow keydown on document don't block it.
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.altKey && e.shiftKey && (e.code === "KeyB" || e.key?.toLowerCase() === "b")) {
      e.preventDefault();
      e.stopPropagation();
      setHudHidden(!state.hidden);
    }
  }, true);
}

function renderInfo(): void {
  if (!detailEl || !titleEl) return;
  const parts: string[] = [];
  if (info.label) parts.push(info.label);
  if (info.port) parts.push(`port ${info.port}`);
  if (info.host) parts.push(info.host);
  detailEl.textContent = parts.join("  ·  ");
  // Collapsed mode has no body, so the title carries the identity. Show the
  // session label rather than "ChromeBoost · <label>" — the pill is only
  // 150px wide, and the prefix would push the useful half out of view.
  // The accent dot already identifies whose panel this is.
  titleEl.textContent = state.collapsed && info.label ? info.label : "ChromeBoost";
}

function applyVisibility(): void {
  if (!hostEl || !panelEl) return;
  hostEl.style.display = state.hidden ? "none" : "";
  panelEl.classList.toggle("collapsed", state.collapsed);
  renderInfo();
  applyPosition();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Create (or update) the HUD. Safe to call repeatedly. */
export async function showHud(next: HudInfo): Promise<void> {
  info = { ...info, ...next };
  if (!info.label && !info.port) return;
  await loadState();
  if (!hostEl || !document.documentElement.contains(hostEl)) {
    buildDom();
  }
  bindGlobalListeners();
  applyVisibility();
}

/** Remove the HUD from the page entirely (used on `clear`). */
export function destroyHud(): void {
  document.getElementById(HUD_HOST_ID)?.remove();
  hostEl = null;
  panelEl = null;
  statusEl = null;
  titleEl = null;
  detailEl = null;
}

/**
 * Temporarily show/hide without touching persisted state. Used around
 * screenshots so the HUD never appears in a captured image.
 */
export function setHudVisibleTransient(visible: boolean): void {
  if (!hostEl) return;
  if (visible) hostEl.style.display = state.hidden ? "none" : "";
  else hostEl.style.display = "none";
}

/**
 * User-level hide/show. Persists, so it stays hidden across pages.
 *
 * Showing rebuilds the panel if it was torn down (`destroyHud`) while we still
 * know which session it belongs to — otherwise Alt+Shift+B would silently do
 * nothing after a teardown, which reads as a broken shortcut.
 */
export function setHudHidden(hidden: boolean): void {
  state.hidden = hidden;
  saveState();
  if (!hidden && !hostEl && (info.label || info.port)) {
    buildDom();
    bindGlobalListeners();
  }
  applyVisibility();
}

export function setCollapsed(collapsed: boolean): void {
  state.collapsed = collapsed;
  saveState();
  applyVisibility();
}

/** Move the panel. Coordinates are viewport CSS px of the top-left corner. */
export function moveHud(x: number, y: number): void {
  state.x = x;
  state.y = y;
  snapToEdges();
  saveState();
}

/** Drop the HUD into one of the four corners. */
export function dockHud(corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"): void {
  const { w, h } = currentSize();
  const right = Math.max(MARGIN, window.innerWidth - w - MARGIN);
  const bottom = Math.max(MARGIN, window.innerHeight - h - MARGIN);
  state.x = corner.endsWith("right") ? right : MARGIN;
  state.y = corner.startsWith("bottom") ? bottom : MARGIN;
  saveState();
  applyPosition();
}

export function getHudState(): HudState & { present: boolean } {
  return { ...state, present: !!hostEl };
}

/**
 * Update the one-line status text ("Clicking Submit…"). Auto-reverts to Idle
 * after a few seconds so a stale action label doesn't linger on the page.
 */
export function setHudStatus(text: string): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  if (statusResetTimer !== null) clearTimeout(statusResetTimer);
  statusResetTimer = window.setTimeout(() => {
    if (statusEl) statusEl.textContent = "Idle";
  }, 6000);
}
