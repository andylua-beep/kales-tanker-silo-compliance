// True-scale side elevation: tractor + tanker/silo semi-trailer, dimension chains, height callouts and axle loads.
import { KINGPIN_SETBACK_M } from "./equipment.js"
import { STATUS_RANK } from "./engine.js"
import { runningGear, wheel, tractorParts } from "./render-parts.js"
import { tankerParts, tankerAxleFrameM } from "./render-tanker.js"

const VIEW_W = 1100
const VIEW_H = 540
const GROUND_Y = 420
const PAD_X = 34
const TOP_RESERVED = 112
const MAX_DRAW_HEIGHT_M = 4.6

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1)
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2)

function worstOf(checks, ids) {
  return checks.filter((c) => ids.includes(c.id)).reduce((w, c) => (STATUS_RANK[c.status] > STATUS_RANK[w] ? c.status : w), "ok")
}

function layout(r) {
  const t = r.parts.tractor
  const xMin = -(t.frontOverhangM + t.wheelbaseM - t.fifthWheelLeadM) - 0.35
  const xMax = r.geometry.rearX + 0.9
  const k = Math.min((VIEW_W - 2 * PAD_X) / (xMax - xMin), (GROUND_Y - TOP_RESERVED) / MAX_DRAW_HEIGHT_M)
  const x0 = PAD_X + (VIEW_W - 2 * PAD_X - (xMax - xMin) * k) / 2
  return { k, X: (x) => +(x0 + (x - xMin) * k).toFixed(1), Y: (h) => +(GROUND_Y - h * k).toFixed(1) }
}

function hDim(s, x1, x2, y, text, cls = "") {
  const a = s.X(x1)
  const b = s.X(x2)
  return `<g class="cad-dim ${cls}"><line x1="${a}" y1="${y}" x2="${b}" y2="${y}" marker-start="url(#arr)" marker-end="url(#arr)" />
    <line x1="${a}" y1="${y - 5}" x2="${a}" y2="${y + 5}" /><line x1="${b}" y1="${y - 5}" x2="${b}" y2="${y + 5}" />
    <text x="${(a + b) / 2}" y="${y - 5}" text-anchor="middle">${esc(text)}</text></g>`
}

function extension(s, x, fromH, toY) {
  return `<line x1="${s.X(x)}" y1="${s.Y(fromH) - 4}" x2="${s.X(x)}" y2="${toY + 6}" class="cad-ext" />`
}

function vDim(s, x, h, text, side = 1) {
  const X = s.X(x)
  return `<g class="cad-dim"><line x1="${X}" y1="${GROUND_Y}" x2="${X}" y2="${s.Y(h)}" marker-start="url(#arr)" marker-end="url(#arr)" />
    <text x="${X + side * 6}" y="${(GROUND_Y + s.Y(h)) / 2 + 4}" text-anchor="${side > 0 ? "start" : "end"}">${esc(text)}</text></g>`
}

function topDimensions(s, r) {
  const g = r.geometry
  const y1 = 62
  const y2 = 90
  const volM3 = round1(r.config.volumeLiters / 1000)
  const label = r.parts.model.family === "silo"
    ? `silo ${f1(g.tankLenM)} m · ${volM3} m³ · ${r.config.compartments} cones`
    : `barrel ${f1(g.tankLenM)} m · ${volM3} m³ · ${r.config.compartments} comp.`
  return `${hDim(s, g.frontX, g.rearX, y1, `trailer ${f2(r.config.lengthM)} m`, "strong")}
    ${hDim(s, g.tankStartX, g.tankEndX, y2, label)}
    ${extension(s, g.frontX, g.overallHeightM, y1)}
    ${extension(s, g.rearX, g.overallHeightM, y1)}`
}

const round1 = (v) => Math.round(v * 10) / 10

function trailerRunningGear(s, r) {
  const g = r.geometry
  const xs = Array.from({ length: r.config.axles }, (_, i) => g.firstX + i * r.config.spacingM)
  const dia = r.parts.tyre.diaMm / 1000
  const st = worstOf(r.checks, ["axle-rating", "tyre-rating", "legal-group"])
  const frameBottom = tankerAxleFrameM(r)
  return runningGear(s, xs, g.tyreR, frameBottom, r.parts.suspension.kind) + xs.map((x) => wheel(s, x, dia, st)).join("")
}

function overlays(s, r) {
  const g = r.geometry
  const rawMaxH = r.parts.region.maxHeight
  const limit = r.checks.find((c) => c.id === "legal-height")?.limit ?? (typeof rawMaxH === "function" ? rawMaxH({ isCarrier: false, isContainer: false }) : rawMaxH)
  const st = worstOf(r.checks, ["legal-height"])
  const heightLine = limit
    ? `<line x1="${PAD_X}" y1="${s.Y(limit)}" x2="${VIEW_W - PAD_X}" y2="${s.Y(limit)}" class="cad-limit st-${st}" />
       <text x="${VIEW_W - PAD_X}" y="${s.Y(limit) - 5}" class="cad-small st-${st}" text-anchor="end">Legal height ${limit} m · ${esc(r.parts.region.id)}</text>`
    : ""
  const cgTop = Math.max(3.2, g.overallHeightM + 0.25)
  return `${heightLine}
    ${vDim(s, g.rearX + 0.25, g.overallHeightM, `${f2(g.overallHeightM)} m`)}
    <line x1="${s.X(r.cgX)}" y1="${s.Y(cgTop)}" x2="${s.X(r.cgX)}" y2="${GROUND_Y}" class="cad-cg" />
    <circle cx="${s.X(r.cgX)}" cy="${s.Y(cgTop)}" r="5" class="cad-cg-dot" />
    <text x="${s.X(r.cgX) + 8}" y="${s.Y(cgTop) + 4}" class="cad-small cg">CG ${f1(r.cgX)} m</text>`
}

function loadLabels(s, r) {
  const t = r.parts.tractor
  const steerX = -(t.wheelbaseM - t.fifthWheelLeadM)
  const driveX = t.fifthWheelLeadM
  const L = r.loads
  const items = [
    [steerX, "Steer", `${f1(L.steerT)} t`, worstOf(r.checks, ["tractor-steer", "legal-steer"])],
    [driveX, "Drive", `${f1(L.driveT)} t`, worstOf(r.checks, ["tractor-drive", "legal-drive", "traction", "legal-drive-share"])],
    [r.geometry.groupX, `Trailer ${r.config.axles} × ${f1(L.perAxleT)} t`, `${f1(L.groupT)} t`, worstOf(r.checks, ["axle-rating", "tyre-rating", "legal-group"])]
  ]
  return items.map(([x, name, val, st]) => `<text x="${s.X(x)}" y="${GROUND_Y + 18}" class="cad-load-name" text-anchor="middle">${esc(name)}</text>
    <text x="${s.X(x)}" y="${GROUND_Y + 34}" class="cad-load st-${st}" text-anchor="middle">${esc(val)}</text>`).join("")
}

function bottomDimensions(s, r) {
  const g = r.geometry
  const y = GROUND_Y + 62
  const parts = [hDim(s, 0, g.groupX, y, `kingpin → axle centre ${f2(g.groupX)} m`)]
  if (r.config.axles > 1) parts.push(hDim(s, g.firstX, g.lastX, y + 26, `${f2(g.groupSpanM)} m`))
  return parts.join("")
}

const gradient = (id, [top, mid, bottom]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}" /><stop offset="0.45" stop-color="${mid}" /><stop offset="1" stop-color="${bottom}" /></linearGradient>`

export function renderCad(r) {
  const s = layout(r)
  const statuses = {
    steer: worstOf(r.checks, ["tractor-steer", "legal-steer"]),
    drive: worstOf(r.checks, ["tractor-drive", "legal-drive"])
  }
  const title = `KALES ${r.parts.model.label.toUpperCase()} · ${r.config.axles} AXLES · ${r.parts.suspension.kind.toUpperCase()}`
  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
    <defs>
      <pattern id="grid" width="${s.k.toFixed(2)}" height="${s.k.toFixed(2)}" patternUnits="userSpaceOnUse" x="${s.X(0)}" y="${GROUND_Y}">
        <path d="M ${s.k.toFixed(2)} 0 L 0 0 0 ${s.k.toFixed(2)}" class="cad-grid" />
      </pattern>
      ${gradient("gTrailer", ["#fbd070", "#f2ad27", "#d28d10"])}
      ${gradient("gTankAlum", ["#e2e8f0", "#94a3b8", "#475569"])}
      ${gradient("gTankStainless", ["#f8fafc", "#cbd5e1", "#64748b"])}
      ${gradient("gTankSteel", ["#94a3b8", "#475569", "#1e293b"])}
      ${gradient("gTankChem", ["#cbd5e1", "#64748b", "#334155"])}
      ${gradient("gCab", ["#47606d", "#334651", "#25343d"])}
      <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" class="cad-arrow" /></marker>
    </defs>
    <rect width="${VIEW_W}" height="${VIEW_H}" class="cad-bg" />
    <rect x="0" y="${TOP_RESERVED - 6}" width="${VIEW_W}" height="${GROUND_Y - TOP_RESERVED + 6}" fill="url(#grid)" />
    <text x="${PAD_X}" y="24" class="cad-title">${esc(title)}</text>
    <text x="${PAD_X}" y="40" class="cad-small">${esc(r.parts.region.name)} · grid 1 m · to scale · kingpin setback ${KINGPIN_SETBACK_M} m · ${esc(r.parts.medium.label)} (${r.config.fillPct}% fill)</text>
    ${topDimensions(s, r)}
    <line x1="0" y1="${GROUND_Y}" x2="${VIEW_W}" y2="${GROUND_Y}" class="cad-ground" />
    ${tractorParts(s, r, statuses)}
    ${tankerParts(s, r)}
    ${trailerRunningGear(s, r)}
    ${overlays(s, r)}
    ${loadLabels(s, r)}
    ${bottomDimensions(s, r)}
  </svg>`
}
