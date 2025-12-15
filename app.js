const DATA_URL = "./employees.json";
const IMAGES_DIR = "./images/";
const STORAGE_KEY = "officeSeatingLayout_v2";
const POSITIONS_URL = "./hotspot_positions.json";



/**
 * Edit these coordinates to match your floor plan.
 * x,y,w,h are percentages of the *image box* (viewport width).
 */
const DESKS = [
  { id: "D1", x: 8,  y: 18, w: 10, h: 7 },
  { id: "D2", x: 20, y: 18, w: 10, h: 7 },
  { id: "D3", x: 32, y: 18, w: 10, h: 7 },
  { id: "D4", x: 8,  y: 30, w: 10, h: 7 },
  { id: "D5", x: 20, y: 30, w: 10, h: 7 },
  { id: "D6", x: 32, y: 30, w: 10, h: 7 },
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
let layout = loadLayout(); // { deskId: employeeName }
let activeDeskId = null;

let editMode = false;
let draftDesks = []; // will be filled on init

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

  renderHotspots();
  wireUI();
}

async function loadPositionsOrDefault() {
  try {
    const pos = await fetch(POSITIONS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("no positions file");
      return r.json();
    });

    const desks = Array.isArray(pos.desks) ? pos.desks : [];
    if (!desks.length) throw new Error("empty positions file");

    // Use positions as source of truth, but keep fallback defaults for missing fields
    const byId = new Map(DESKS.map(d => [d.id, d]));
    return desks.map(d => ({
      ...(byId.get(d.id) || {}),
      ...d
    }));
  } catch {
    return DESKS.map(d => ({ ...d }));
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

  // build dropdown
  employeeSelectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— Unassigned —";
  employeeSelectEl.appendChild(placeholder);

  for (const name of people) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    employeeSelectEl.appendChild(opt);
  }

  const assigned = layout[deskId] || "";
  employeeSelectEl.value = assigned;
  updateProfilePreview(assigned);

  popoverEl.classList.remove("hidden");
  positionPopoverNear(hotspotEl);
}

async function updateProfilePreview(name) {
  if (!name) {
    employeeNameEl.textContent = "—";
    profileLinkEl.href = "#";
    profileLinkEl.style.pointerEvents = "none";
    profileLinkEl.style.opacity = "0.5";
    headshotEl.removeAttribute("src");
    headshotEl.alt = "Headshot";
    return;
  }

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
