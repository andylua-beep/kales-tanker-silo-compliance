// Shared CAD SVG primitives, tractor, running gear, landing legs and rear-end details.
import { LANDING_LEG, TRACTOR_TYRE_DIA_M, TRACTOR_BOGIE_HALF_SPACING_M } from "./equipment.js"

const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1)

export const grad = (id) => ` style="fill:url(#${id})"`

export const poly = (s, pts, cls, extra = "") => `<polygon points="${pts.map(([x, h]) => `${s.X(x)},${s.Y(h)}`).join(" ")}" class="${cls}"${extra} />`
export const rect = (s, x1, h1, x2, h2, cls, rx = 0, extra = "") =>
  `<rect x="${s.X(Math.min(x1, x2))}" y="${s.Y(Math.max(h1, h2))}" width="${(Math.abs(x2 - x1) * s.k).toFixed(1)}" height="${(Math.abs(h2 - h1) * s.k).toFixed(1)}" rx="${rx}" class="${cls}"${extra} />`
export const line = (s, x1, h1, x2, h2, cls) => `<line x1="${s.X(x1)}" y1="${s.Y(h1)}" x2="${s.X(x2)}" y2="${s.Y(h2)}" class="${cls}" />`
export const dot = (s, x, h, rM, cls) => `<circle cx="${s.X(x)}" cy="${s.Y(h)}" r="${(rM * s.k).toFixed(1)}" class="${cls}" />`

export function rearEnd(s, rearX, deckH, beamM) {
  return `${rect(s, rearX - 0.05, deckH - 0.22, rearX + 0.02, deckH - 0.06, "cad-lamp-red", 1)}
    ${rect(s, rearX - 0.16, 0.52, rearX - 0.08, deckH - beamM, "cad-leg")}
    ${rect(s, rearX - 0.26, 0.44, rearX + 0.02, 0.54, "cad-leg", 1)}`
}

export function markers(s, fromX, toX, h, stepM = 1.6) {
  const out = []
  for (let x = fromX; x <= toX + 1e-6; x += stepM) out.push(rect(s, x - 0.06, h - 0.025, x + 0.06, h + 0.025, "cad-marker", 1))
  return out.join("")
}

export function runningGear(s, xs, tyreR, frameBottomH, kind) {
  if (frameBottomH < tyreR + 0.14 || !xs.length) return ""
  const pitch = xs.length > 1 ? xs[1] - xs[0] : 1.31
  const hangerXs = [xs[0] - pitch / 2, ...xs.slice(1).map((x) => x - pitch / 2), xs[xs.length - 1] + pitch / 2]
  const hangers = hangerXs.map((x) => poly(s, [[x - 0.1, frameBottomH], [x + 0.1, frameBottomH], [x + 0.05, tyreR + 0.1], [x - 0.05, tyreR + 0.1]], "cad-hanger"))
  const springs = kind === "mechanical"
    ? xs.map((x) => `<path d="M ${s.X(x - pitch / 2)} ${s.Y(tyreR + 0.16)} Q ${s.X(x)} ${s.Y(tyreR - 0.06)} ${s.X(x + pitch / 2)} ${s.Y(tyreR + 0.16)}" class="cad-spring" />`)
    : xs.map((x) => rect(s, x + 0.14, tyreR + 0.06, x + 0.4, frameBottomH, "cad-airbag", 4))
  return `${springs.join("")}${hangers.join("")}`
}

export function landingLeg(s, x, topH, footH = LANDING_LEG.stowedFootM) {
  const tubeBottom = Math.min(topH - 0.1, footH + 0.22)
  return `<g class="cad-landing-leg">
    ${rect(s, x - 0.05, footH + 0.04, x + 0.05, tubeBottom + 0.02, "cad-leg-inner")}
    ${rect(s, x - 0.08, tubeBottom, x + 0.08, topH, "cad-leg", 1)}
    ${rect(s, x + 0.08, topH - 0.26, x + 0.21, topH - 0.08, "cad-leg", 1)}
    ${rect(s, x - 0.17, footH, x + 0.17, footH + 0.05, "cad-leg", 1)}
  </g>`
}

export function wheel(s, xM, diaM, status = "ok") {
  const r = (diaM / 2) * s.k
  const cx = s.X(xM)
  const cy = s.Y(diaM / 2)
  const holes = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const a = (deg * Math.PI) / 180
    return `<circle cx="${(cx + Math.cos(a) * r * 0.4).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.4).toFixed(1)}" r="${Math.max(0.9, r * 0.055).toFixed(1)}" class="cad-rim-hole" />`
  }).join("")
  const ring = status === "ok" || status === "info" ? "" : `<circle cx="${cx}" cy="${cy}" r="${(r + 2.5).toFixed(1)}" class="cad-alert st-${status}" />`
  return `<g>${ring}<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" class="cad-tyre" />
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.8).toFixed(1)}" class="cad-tyre-wall" />
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.58).toFixed(1)}" class="cad-rim" />
    ${holes}<circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" class="cad-hub" />
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.08).toFixed(1)}" class="cad-rim-hole" /></g>`
}

export function tractorParts(s, r, statuses) {
  const t = r.parts.tractor
  const fw = t.fifthWheelMm / 1000
  const chassisTop = Math.min(1.2, fw - 0.16)
  const steerX = -(t.wheelbaseM - t.fifthWheelLeadM)
  const driveX = t.fifthWheelLeadM
  const driveXs = t.driveAxles > 1 ? [driveX - TRACTOR_BOGIE_HALF_SPACING_M, driveX + TRACTOR_BOGIE_HALF_SPACING_M] : [driveX]
  const front = steerX - t.frontOverhangM
  const cabRear = front + 2.35
  const tyreR = TRACTOR_TYRE_DIA_M / 2
  const tankStart = cabRear + 0.12
  const tankEnd = Math.min(front + 3.45, driveXs[0] - tyreR - 0.25)
  const tank = tankEnd - tankStart > 0.5
    ? `${rect(s, tankStart, 0.55, tankEnd, 1.0, "cad-tank", 6)}${[0.3, 0.7].map((p) => line(s, tankStart + (tankEnd - tankStart) * p, 0.55, tankStart + (tankEnd - tankStart) * p, 1.0, "cad-tank-strap")).join("")}`
    : ""
  return `<g class="cad-tractor">
    ${rect(s, front + 0.15, chassisTop - 0.25, driveXs[driveXs.length - 1] + 0.75, chassisTop, "cad-chassis")}
    ${tank}
    ${rect(s, cabRear + 0.02, 1.2, cabRear + 0.12, 3.85, "cad-exhaust", 2)}
    ${poly(s, [[front + 0.9, 3.55], [cabRear - 0.05, 3.58], [cabRear - 0.05, 3.85], [front + 1.25, 3.7]], "cad-deflector")}
    <path d="M ${s.X(front)} ${s.Y(1.0)} L ${s.X(front)} ${s.Y(2.35)} L ${s.X(front + 0.16)} ${s.Y(3.12)} Q ${s.X(front + 0.3)} ${s.Y(3.5)} ${s.X(front + 0.75)} ${s.Y(3.52)} L ${s.X(cabRear)} ${s.Y(3.58)} L ${s.X(cabRear)} ${s.Y(1.0)} Z" class="cad-cab"${grad("gCab")} />
    ${poly(s, [[front + 0.07, 2.42], [front + 0.2, 3.08], [front + 0.95, 3.14], [front + 0.95, 2.42]], "cad-glass")}
    ${rect(s, front + 1.02, 1.12, front + 1.72, 2.45, "cad-door", 3)}
    ${rect(s, front + 1.08, 2.5, front + 1.66, 3.1, "cad-glass", 3)}
    ${rect(s, front + 1.56, 2.2, front + 1.68, 2.25, "cad-grille")}
    ${rect(s, front + 1.85, 2.55, front + 2.2, 2.9, "cad-glass", 3)}
    ${rect(s, front - 0.14, 2.45, front - 0.04, 2.95, "cad-mirror", 2)}
    ${[1.35, 1.6, 1.85, 2.1].map((h) => line(s, front + 0.02, h, front + 0.22, h, "cad-grille")).join("")}
    ${rect(s, front - 0.02, 1.02, front + 0.1, 1.22, "cad-headlamp", 2)}
    ${rect(s, front - 0.06, 0.48, front + 0.28, 0.98, "cad-bumper", 3)}
    ${rect(s, front + 1.1, 0.62, front + 1.62, 0.7, "cad-bumper", 1)}${rect(s, front + 1.1, 0.86, front + 1.62, 0.94, "cad-bumper", 1)}
    ${rect(s, -0.55, fw - 0.16, 0.55, fw, "cad-saddle", 2)}
    ${wheel(s, steerX, TRACTOR_TYRE_DIA_M, statuses.steer)}
    ${driveXs.map((x) => wheel(s, x, TRACTOR_TYRE_DIA_M, statuses.drive)).join("")}
  </g>`
}
