const DATA_URL = "./employees.json";
const IMAGES_DIR = "./images/";
const STORAGE_KEY = "officeSeatingLayout_v2";
const POSITIONS_URL = "./hotspot_positions.json";
const SEATS_URL = "./seating_layout.json";
const STATE_ENDPOINT = "/api/state";

async function loadStateRemote() {
  const r = await fetch(STATE_ENDPOINT, { cache: "no-store" });
  const j = await r.json();
  return j?.value || null;
}

let saveTimer = null;
function scheduleRemoteSave(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch(STATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    } catch (e) {
      console.warn("Remote save failed:", e);
    }
  }, 250);
}

function currentStatePayload() {
  return {
    desks: draftDesks.map(d => ({ id: d.id, x: d.x, y: d.y })), // positions
    layout: layout                                       // seating map
  };
}





/**
 * Edit these coordinates to match your floor plan.
 * x,y,w,h are percentages of the *image box* (viewport width).
 */
const DESKS = [
  { id: "D1",  x: 6,  y: 10, w: 10, h: 7 },
  { id: "D2",  x: 14, y: 10, w: 10, h: 7 },
  { id: "D3",  x: 22, y: 10, w: 10, h: 7 },
  { id: "D4",  x: 30, y: 10, w: 10, h: 7 },
  { id: "D5",  x: 38, y: 10, w: 10, h: 7 },
  { id: "D6",  x: 46, y: 10, w: 10, h: 7 },
  { id: "D7",  x: 54, y: 10, w: 10, h: 7 },
  { id: "D8",  x: 62, y: 10, w: 10, h: 7 },
  { id: "D9",  x: 70, y: 10, w: 10, h: 7 },
  { id: "D10", x: 78, y: 10, w: 10, h: 7 },

  { id: "D11", x: 6,  y: 22, w: 10, h: 7 },
  { id: "D12", x: 14, y: 22, w: 10, h: 7 },
  { id: "D13", x: 22, y: 22, w: 10, h: 7 },
  { id: "D14", x: 30, y: 22, w: 10, h: 7 },
  { id: "D15", x: 38, y: 22, w: 10, h: 7 },
  { id: "D16", x: 46, y: 22, w: 10, h: 7 },
  { id: "D17", x: 54, y: 22, w: 10, h: 7 },
  { id: "D18", x: 62, y: 22, w: 10, h: 7 },
  { id: "D19", x: 70, y: 22, w: 10, h: 7 },
  { id: "D20", x: 78, y: 22, w: 10, h: 7 },

  { id: "D21", x: 6,  y: 34, w: 10, h: 7 },
  { id: "D22", x: 14, y: 34, w: 10, h: 7 },
  { id: "D23", x: 22, y: 34, w: 10, h: 7 },
  { id: "D24", x: 30, y: 34, w: 10, h: 7 },
  { id: "D25", x: 38, y: 34, w: 10, h: 7 },
  { id: "D26", x: 46, y: 34, w: 10, h: 7 },
  { id: "D27", x: 54, y: 34, w: 10, h: 7 },
  { id: "D28", x: 62, y: 34, w: 10, h: 7 },
  { id: "D29", x: 70, y: 34, w: 10, h: 7 },
  { id: "D30", x: 78, y: 34, w: 10, h: 7 },

  { id: "D31", x: 6,  y: 46, w: 10, h: 7 },
  { id: "D32", x: 14, y: 46, w: 10, h: 7 },
  { id: "D33", x: 22, y: 46, w: 10, h: 7 },
  { id: "D34", x: 30, y: 46, w: 10, h: 7 },
  { id: "D35", x: 38, y: 46, w: 10, h: 7 },
  { id: "D36", x: 46, y: 46, w: 10, h: 7 },
  { id: "D37", x: 54, y: 46, w: 10, h: 7 },
  { id: "D38", x: 62, y: 46, w: 10, h: 7 },
  { id: "D39", x: 70, y: 46, w: 10, h: 7 },
  { id: "D40", x: 78, y: 46, w: 10, h: 7 },

  { id: "D41", x: 10, y: 62, w: 10, h: 7 },
  { id: "D42", x: 22, y: 62, w: 10, h: 7 },
  { id: "D43", x: 34, y: 62, w: 10, h: 7 },
  { id: "D44", x: 46, y: 62, w: 10, h: 7 },
  { id: "D45", x: 58, y: 62, w: 10, h: 7 },
  { id: "D46", x: 70, y: 62, w: 10, h: 7 }
];

const $ = (sel) => document.querySelector(sel);

const hotspotsEl = $("#hotspots");
const popoverEl = $("#popover");
const employeeSelectEl = $("#employeeSelect");
const headshotEl = $("#headshot");
const employeeNameEl = $("#employeeName");
const profileLinkEl = $("#profileLink");
const closePopoverBtn = $("#closePopover");
const resetBtn = $("#resetBtn");

let people = [];
let recordsByName = new Map();
let layout = {}; // will be loaded from file on init

let activeDeskId = null;

let editMode = false;
let draftDesks = []; // will be filled on init

function swapAssignments(aId, bId) {
  if (aId === bId) return;

  const a = layout[aId] || "";
  const b = layout[bId] || "";

  if (!a && !b) return;

  if (a) layout[bId] = a; else delete layout[bId];
  if (b) layout[aId] = b; else delete layout[aId];

  saveLayout(layout);
  updateHotspotContent(aId);
  updateHotspotContent(bId);

  // If popover is open on one of these desks, refresh its dropdown to respect "assigned" filtering
  if (activeDeskId === aId || activeDeskId === bId) {
    const hs = document.querySelector(`.hotspot[data-id="${activeDeskId}"]`);
    if (hs) openDesk(activeDeskId, hs); // rebuild dropdown + preview
  }
  scheduleRemoteSave(currentStatePayload());
}

function attachSwapDnD(hotspotEl) {
  hotspotEl.addEventListener("dragstart", (e) => {
    if (editMode) return;
    e.dataTransfer.setData("text/plain", hotspotEl.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });

  hotspotEl.addEventListener("dragover", (e) => {
    if (editMode) return;
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = "move";
  });

  hotspotEl.addEventListener("drop", (e) => {
    if (editMode) return;
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain");
    const toId = hotspotEl.dataset.id;
    if (!fromId || !toId) return;
    swapAssignments(fromId, toId);
  });
}


init().catch((err) => {
  console.error(err);
  alert("Failed to load employees.json. Run using a local server (Live Server / python http.server).");
});

async function init() {
  const data = await fetch(DATA_URL).then((r) => r.json());
  

  people = Array.isArray(data.people) ? data.people.slice() : [];
  const records = Array.isArray(data.records) ? data.records.slice() : [];
  recordsByName = new Map(records.map((rec) => [rec.name, rec]));

  if (!people.length) people = records.map((r) => r.name);
  people.sort((a, b) => a.localeCompare(b));

  // ✅ load positions file if present, else fall back to DESKS
  draftDesks = await loadPositionsOrDefault();

  layout = await loadSeatsOrEmpty();   // ✅ file-based seating

  // defaults
  draftDesks = DESKS.map(d => ({ ...d }));
  layout = {};

  const remote = await loadStateRemote();
  if (remote) {
    if (Array.isArray(remote.desks)) {
      const byId = new Map(draftDesks.map(d => [d.id, d]));
      for (const p of remote.desks) {
        const d = byId.get(p?.id);
        if (!d) continue;
        if (Number.isFinite(p.x)) d.x = p.x;
        if (Number.isFinite(p.y)) d.y = p.y;
      }
    }
    if (remote.layout && typeof remote.layout === "object") {
      layout = remote.layout;
    }
  }

  renderHotspots();
  wireUI();
}

async function loadSeatsOrEmpty() {
  try {
    const seats = await fetch(SEATS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("no seats file");
      return r.json();
    });

    const loaded = seats?.layout && typeof seats.layout === "object" ? seats.layout : {};
    // ensure values are strings
    const clean = {};
    for (const [deskId, name] of Object.entries(loaded)) {
      if (typeof name === "string" && name.trim()) clean[deskId] = name.trim();
    }
    return clean;
  } catch {
    // if file not found, everyone starts unassigned
    return {};
  }
}

const exportSeatsBtn = document.getElementById("exportSeatsBtn");
exportSeatsBtn.addEventListener("click", () => exportSeatsJSON());

function exportSeatsJSON() {
  const payload = {
    exported_at: new Date().toISOString(),
    layout: layout
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "seating_layout.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function loadPositionsOrDefault() {
  // Start from DESKS as the base (ensures D1..D46 always show)
  const base = DESKS.map(d => ({ ...d }));

  try {
    const pos = await fetch(POSITIONS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("no positions file");
      return r.json();
    });

    const desks = Array.isArray(pos.desks) ? pos.desks : [];

    // Map JSON positions by id
    const posById = new Map(
      desks
        .filter(d => d && typeof d.id === "string")
        .map(d => [d.id, d])
    );

    // Overwrite only x/y for IDs that exist in base
    for (const d of base) {
      const p = posById.get(d.id);
      if (!p) continue;

      if (Number.isFinite(p.x)) d.x = p.x;
      if (Number.isFinite(p.y)) d.y = p.y;
      // keep d.w / d.h untouched
    }

    return base;
  } catch {
    return base;
  }
}




function wireUI() {
  closePopoverBtn.addEventListener("click", hidePopover);

  // Auto-save on selection
  employeeSelectEl.addEventListener("change", async () => {
    if (!activeDeskId) return;

    const chosen = employeeSelectEl.value || "";
    updateProfilePreview(chosen);

    if (!chosen) {
      delete layout[activeDeskId];
    } else {
      layout[activeDeskId] = chosen;
    }
    saveLayout(layout);
    await updateHotspotContent(activeDeskId);
    scheduleRemoteSave(currentStatePayload());

  });

  document.getElementById("seedBtn").addEventListener("click", async () => {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentStatePayload()),
    });
    alert("Seeded DB with current seating + desk positions.");
  });


  resetBtn.addEventListener("click", async () => {
    if (!activeDeskId) return;
    delete layout[activeDeskId];
    saveLayout(layout);
    employeeSelectEl.value = "";
    updateProfilePreview("");
    await updateHotspotContent(activeDeskId);
    hidePopover();
  });

  const toggleEditBtn = document.getElementById("toggleEditBtn");
  const exportBtn = document.getElementById("exportBtn");

  toggleEditBtn.addEventListener("click", () => {
    editMode = !editMode;
    toggleEditBtn.textContent = editMode ? "Edit: ON" : "Edit: OFF";
    if (editMode) hidePopover();
    renderHotspots();
  });

  exportBtn.addEventListener("click", () => {
    exportPositionsJSON();
  });

  // click outside closes
  document.addEventListener("click", (e) => {
    if (popoverEl.classList.contains("hidden")) return;
    const inside = popoverEl.contains(e.target);
    const hs = e.target.closest?.(".hotspot");
    if (!inside && !hs) hidePopover();
  });

  // keep popover positioned on resize if open
  window.addEventListener("resize", () => {
    if (popoverEl.classList.contains("hidden") || !activeDeskId) return;
    const hs = document.querySelector(`.hotspot[data-id="${activeDeskId}"]`);
    if (hs) positionPopoverNear(hs);
  });
}

function renderHotspots() {
  hotspotsEl.innerHTML = "";
  

  for (const desk of draftDesks) {
    const div = document.createElement("div");
    div.className = "hotspot";
    div.dataset.id = desk.id;

    div.style.left = `${desk.x}%`;
    div.style.top = `${desk.y}%`;
    div.style.width = `${desk.w * 0.36}%`;
    div.style.height = `${desk.h}%`;

    div.draggable = !editMode;     // ✅ allow drag-drop swaps when not editing positions
    attachSwapDnD(div);            // ✅ attach swap logic


    // Click opens popover ONLY when not in edit mode
    div.addEventListener("click", async (e) => {
      if (editMode) return;
      e.stopPropagation();
      openDesk(desk.id, div);
    });

    // Enable drag in edit mode
    attachDragHandlers(div);

    hotspotsEl.appendChild(div);
  }

  draftDesks.forEach((d) => updateHotspotContent(d.id));
}


async function updateHotspotContent(deskId) {
  const div = document.querySelector(`.hotspot[data-id="${deskId}"]`);
  if (!div) return;

  div.innerHTML = "";
  const assigned = layout[deskId];

  if (!assigned) {
    div.classList.add("unassigned");

    const name = document.createElement("div");
    name.className = "hotname";
    name.textContent = "Unassigned";
    div.appendChild(name);

    return; // IMPORTANT: no image element at all
  }

  div.classList.remove("unassigned");

  const frame = document.createElement("div");
  frame.className = "hotshot-frame";
  div.appendChild(frame);

  const img = document.createElement("img");
  img.className = "hotshot";
  img.alt = `${assigned} headshot`;
  frame.appendChild(img);

  const name = document.createElement("div");
  name.className = "hotname";
  name.textContent = assigned;
  div.appendChild(name);

  const src = await resolveLocalImagePath(assigned);
  if (src) img.src = src;

}


function openDesk(deskId, hotspotEl) {
  activeDeskId = deskId;

  const assigned = layout[deskId] || "";
  const assignedSet = new Set(Object.values(layout).filter(Boolean));

  // build dropdown
  employeeSelectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— Unassigned —";
  employeeSelectEl.appendChild(placeholder);

  for (const name of people) {
    // Hide people assigned to OTHER desks
    if (assignedSet.has(name) && name !== assigned) continue;

    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    employeeSelectEl.appendChild(opt);
  }

  employeeSelectEl.value = assigned;
  updateProfilePreview(assigned);

  popoverEl.classList.remove("hidden");
  positionPopoverNear(hotspotEl);
}


async function updateProfilePreview(name) {
  if (!name) {
    employeeNameEl.textContent = "Unassigned";
    profileLinkEl.href = "#";
    profileLinkEl.style.pointerEvents = "none";
    profileLinkEl.style.opacity = "0.45";

    // Show a nice empty state instead of a broken/blank image
    headshotEl.removeAttribute("src");
    headshotEl.alt = "Unassigned";
    headshotEl.classList.add("empty");
    return;
  }

  headshotEl.classList.remove("empty");
  employeeNameEl.textContent = name;

  const rec = recordsByName.get(name);
  const profileUrl = rec?.profile_url || "#";
  profileLinkEl.href = profileUrl;
  profileLinkEl.style.pointerEvents = profileUrl === "#" ? "none" : "auto";
  profileLinkEl.style.opacity = profileUrl === "#" ? "0.5" : "1";

  const src = await resolveLocalImagePath(name);
  if (src) headshotEl.src = src;
  else headshotEl.removeAttribute("src");
  headshotEl.alt = `${name} headshot`;
}


function positionPopoverNear(hotspotEl) {
  const mapEl = document.querySelector(".map");
  const mapRect = mapEl.getBoundingClientRect();
  const hsRect = hotspotEl.getBoundingClientRect();

  // start right side of hotspot
  let left = (hsRect.right - mapRect.left) + 10;
  let top = (hsRect.top - mapRect.top);

  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;

  const popRect = popoverEl.getBoundingClientRect();
  const maxLeft = mapRect.width - popRect.width - 10;
  const maxTop = mapRect.height - popRect.height - 10;

  left = clamp(left, 10, maxLeft);
  top = clamp(top, 10, maxTop);

  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function hidePopover() {
  popoverEl.classList.add("hidden");
  activeDeskId = null;
}

// ---- image resolution (better fallbacks) ----

async function resolveLocalImagePath(name) {
  // Try exact name first, then normalized name.
  const candidates = [
    `${IMAGES_DIR}${name}.jpg`,
    `${IMAGES_DIR}${name}.jpeg`,
    `${IMAGES_DIR}${name}.png`,
    `${IMAGES_DIR}${normalizeFilename(name)}.jpg`,
    `${IMAGES_DIR}${normalizeFilename(name)}.jpeg`,
    `${IMAGES_DIR}${normalizeFilename(name)}.png`,
  ];

  for (const path of candidates) {
    // Check if file exists by trying to load it
    // (works on a web server; local file:/// may block it)
    const ok = await canLoadImage(path);
    if (ok) return path;
  }
  return null;
}

function canLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function normalizeFilename(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-zA-Z0-9 ]/g, " ")  // punctuation -> spaces
    .replace(/\s+/g, " ")
    .trim();
}

// ---- storage ----
function loadLayout() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLayout(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function attachDragHandlers(hotspotEl) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeftPx = 0;
  let startTopPx = 0;

  hotspotEl.addEventListener("pointerdown", (e) => {
    if (!editMode) return;

    e.preventDefault();
    e.stopPropagation();
    isDragging = true;

    hotspotEl.setPointerCapture(e.pointerId);

    const mapRect = document.querySelector(".map").getBoundingClientRect();
    const hsRect = hotspotEl.getBoundingClientRect();

    startX = e.clientX;
    startY = e.clientY;

    startLeftPx = hsRect.left - mapRect.left;
    startTopPx = hsRect.top - mapRect.top;

    hotspotEl.style.cursor = "grabbing";
  });

  hotspotEl.addEventListener("pointermove", (e) => {
    if (!editMode || !isDragging) return;

    const mapEl = document.querySelector(".map");
    const mapRect = mapEl.getBoundingClientRect();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // new pixel position
    let newLeft = startLeftPx + dx;
    let newTop = startTopPx + dy;

    // clamp inside map
    const hsRect = hotspotEl.getBoundingClientRect();
    const w = hsRect.width;
    const h = hsRect.height;

    newLeft = clamp(newLeft, 0, mapRect.width - w);
    newTop = clamp(newTop, 0, mapRect.height - h);

    // convert to %
    const leftPct = (newLeft / mapRect.width) * 100;
    const topPct = (newTop / mapRect.height) * 100;

    hotspotEl.style.left = `${leftPct}%`;
    hotspotEl.style.top = `${topPct}%`;
  });

  hotspotEl.addEventListener("pointerup", (e) => {
    if (!editMode || !isDragging) return;

    isDragging = false;
    hotspotEl.style.cursor = "pointer";

    // Persist into draftDesks
    const id = hotspotEl.dataset.id;
    const mapRect = document.querySelector(".map").getBoundingClientRect();
    const hsRect = hotspotEl.getBoundingClientRect();

    const leftPct = ((hsRect.left - mapRect.left) / mapRect.width) * 100;
    const topPct = ((hsRect.top - mapRect.top) / mapRect.height) * 100;
    const d = draftDesks.find(x => x.id === id);
    if (d) {
      d.x = round2(leftPct);
      d.y = round2(topPct);
    }
    scheduleRemoteSave(currentStatePayload());
  });
}

function exportPositionsJSON() {
  const payload = {
    exported_at: new Date().toISOString(),
    desks: draftDesks.map(d => ({
      id: d.id,
      x: d.x,
      y: d.y
    }))
  };

  function getAssignedSet() {
    return new Set(Object.values(layout).filter(Boolean));
  }


  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hotspot_positions.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}


function round2(n) {
  return Math.round(n * 100) / 100;
}
