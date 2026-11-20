// CAD rendering for the V-type multi-cone bulk cement silo (modeled after the KALES 48 m³ 4-cone drawing).
// The silo is self-supporting: no full-length main beam. A short kingpin platform carries the
// engine/compressor set, a bogie sub-frame carries the axles, and legs, guards and piping hang off the vessel.
import { poly, rect, line, dot, grad, rearEnd, markers, landingLeg } from "./render-parts.js"

const CONE_FRACTION = 0.28 // hopper share of the vessel height — matches computeTankVolume
const SHOULDER_FRACTION = 0.45 // where the end slopes leave the barrel, as a share of barrel height
const END_INSET_M = 0.3
const OUTLET_HALF_W_M = 0.13
const PLATFORM_DEPTH_M = 0.16
const PIPE_DROP_M = 0.24 // discharge line centre below the cone outlets
const MANIFOLD_RISE_M = 0.14 // aeration manifold above the cone outlets
const LEG_SETBACK_M = 2.65

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.min(1, Math.max(0, t))
const mix = ([ax, ah], [bx, bh], t) => [lerp(ax, bx, t), lerp(ah, bh, t)]

/** Key points of the vessel silhouette, all in metres (x along the trailer, h above ground). */
export function siloProfile(r, deckM) {
  const g = r.geometry
  const cones = r.config.compartments
  const x1 = g.tankStartX
  const x2 = g.tankEndX
  const bot = deckM
  const top = deckM + g.tankHeightM
  const saddleH = bot + CONE_FRACTION * g.tankHeightM
  const shoulderH = saddleH + SHOULDER_FRACTION * (top - saddleH)
  const pitch = (x2 - x1 - 2 * END_INSET_M) / cones
  const outlets = Array.from({ length: cones }, (_, i) => x1 + END_INSET_M + (i + 0.5) * pitch)
  const frontFoot = outlets[0] - OUTLET_HALF_W_M
  const rearFoot = outlets[cones - 1] + OUTLET_HALF_W_M
  return {
    x1, x2, bot, top, saddleH, shoulderH, pitch, outlets, frontFoot, rearFoot,
    saddles: outlets.slice(1).map((cx) => cx - pitch / 2),
    cornerR: Math.min(0.55, (top - shoulderH) * 0.7),
    frontSlopeH: (x) => lerp(shoulderH, bot, clamp01((x - x1) / (frontFoot - x1))),
    frontSlopeX: (h) => lerp(x1, frontFoot, clamp01((shoulderH - h) / (shoulderH - bot))),
    rearSlopeX: (h) => lerp(x2, rearFoot, clamp01((shoulderH - h) / (shoulderH - bot)))
  }
}

function shellPath(s, p) {
  const P = ([x, h]) => `${s.X(x)} ${s.Y(h)}`
  const { x1, x2, bot, top, saddleH, shoulderH, cornerR, outlets } = p
  const knuckle = Math.min(0.14, (top - cornerR - shoulderH) * 0.5)
  const d = [
    `M ${P([x1 + cornerR, top])}`, `L ${P([x2 - cornerR, top])}`,
    `Q ${P([x2, top])} ${P([x2, top - cornerR])}`, `L ${P([x2, shoulderH + knuckle])}`,
    `Q ${P([x2, shoulderH])} ${P(mix([x2, shoulderH], [p.rearFoot, bot], 0.1))}`
  ]
  for (let i = outlets.length - 1; i >= 0; i--) {
    d.push(`L ${P([outlets[i] + OUTLET_HALF_W_M, bot])}`, `L ${P([outlets[i] - OUTLET_HALF_W_M, bot])}`)
    if (i === 0) break
    const peak = [p.saddles[i - 1], saddleH]
    d.push(
      `L ${P(mix([outlets[i] - OUTLET_HALF_W_M, bot], peak, 0.86))}`,
      `Q ${P(peak)} ${P(mix([outlets[i - 1] + OUTLET_HALF_W_M, bot], peak, 0.86))}`
    )
  }
  d.push(
    `L ${P(mix([x1, shoulderH], [p.frontFoot, bot], 0.1))}`, `Q ${P([x1, shoulderH])} ${P([x1, shoulderH + knuckle])}`,
    `L ${P([x1, top - cornerR])}`, `Q ${P([x1, top])} ${P([x1 + cornerR, top])} Z`
  )
  return d.join(" ")
}

/** Ring seams, internal slide-plate ridges above each saddle and a top highlight. */
function shellDetails(s, p) {
  const ridgeH = p.saddleH + 0.34 * (p.top - p.saddleH)
  const ridges = p.saddles.map((sx) => `<polyline points="${s.X(sx - p.pitch * 0.3)},${s.Y(p.saddleH - 0.04)} ${s.X(sx)},${s.Y(ridgeH)} ${s.X(sx + p.pitch * 0.3)},${s.Y(p.saddleH - 0.04)}" class="cad-ridge" />`)
  const seams = p.saddles.map((sx) => line(s, sx, ridgeH + 0.08, sx, p.top - 0.03, "cad-seam"))
  const headSeams = [p.x1 + p.cornerR, p.x2 - p.cornerR].map((x) => line(s, x, p.shoulderH + 0.1, x, p.top - 0.03, "cad-seam"))
  const outletRings = p.outlets.map((cx) => line(s, cx - 0.2, p.bot + 0.07, cx + 0.2, p.bot + 0.07, "cad-seam"))
  return `<g>
    ${line(s, p.x1 + p.cornerR, p.top - 0.2, p.x2 - p.cornerR, p.top - 0.2, "cad-shine")}
    ${ridges.join("")}${seams.join("")}${headSeams.join("")}${outletRings.join("")}
  </g>`
}

function fins(s, x1, x2, h1, h2, stepM = 0.07) {
  const out = []
  for (let h = h1 + stepM; h < h2 - 0.01; h += stepM) out.push(line(s, x1, h, x2, h, "cad-fin"))
  return out.join("")
}

/** Diesel engine + twin-cylinder air compressor skid on the kingpin platform. */
function powerPack(s, x0, baseH) {
  const b = baseH + 0.06
  return `<g class="cad-compressor">
    ${rect(s, x0, baseH, x0 + 1.3, b, "cad-leg", 1)}
    ${rect(s, x0 + 0.58, b, x0 + 1.26, b + 0.56, "cad-engine-box", 3)}
    ${fins(s, x0 + 0.98, x0 + 1.22, b + 0.06, b + 0.5)}
    ${rect(s, x0 + 1.1, b + 0.56, x0 + 1.16, b + 0.98, "cad-exhaust", 1)}${rect(s, x0 + 1.07, b + 0.98, x0 + 1.19, b + 1.02, "cad-exhaust", 1)}
    ${line(s, x0 + 0.76, b + 0.56, x0 + 0.76, b + 0.66, "cad-airline")}${dot(s, x0 + 0.76, b + 0.75, 0.1, "cad-engine-box")}
    ${rect(s, x0 + 0.04, b, x0 + 0.5, b + 0.28, "cad-engine-box", 3)}
    ${[0.08, 0.29].map((dx) => `${rect(s, x0 + dx, b + 0.28, x0 + dx + 0.17, b + 0.66, "cad-engine-box", 2)}${fins(s, x0 + dx, x0 + dx + 0.17, b + 0.3, b + 0.64, 0.055)}`).join("")}
    ${line(s, x0 + 0.27, b + 0.25, x0 + 0.74, b + 0.33, "cad-belt")}${line(s, x0 + 0.27, b + 0.03, x0 + 0.74, b + 0.01, "cad-belt")}
    ${dot(s, x0 + 0.27, b + 0.14, 0.11, "cad-rim")}${dot(s, x0 + 0.27, b + 0.14, 0.03, "cad-hub")}
    ${dot(s, x0 + 0.74, b + 0.17, 0.16, "cad-rim")}${dot(s, x0 + 0.74, b + 0.17, 0.04, "cad-hub")}
    ${line(s, x0 + 0.5, b + 0.66, x0 + 0.5, b + 0.92, "cad-airline")}${dot(s, x0 + 0.5, b + 0.96, 0.05, "cad-valve")}
  </g>`
}

/** Kingpin platform + struts tying it into the front slope of the vessel. */
function frontPlatform(s, r, p) {
  const g = r.geometry
  const fw = r.config.fifthWheelMm / 1000
  const topH = fw + PLATFORM_DEPTH_M
  const endCap = p.frontFoot - 0.3
  const endTop = Math.min(p.frontSlopeX(topH), endCap)
  const endBottom = Math.min(p.frontSlopeX(fw), endCap)
  const strutFoot = g.frontX + 1.5
  return `<g>
    ${line(s, strutFoot, topH, p.x1 + 0.03, p.shoulderH - 0.08, "cad-strut")}
    ${line(s, strutFoot, topH, p.frontSlopeX(topH + 0.75), topH + 0.75, "cad-strut")}
    ${poly(s, [[g.frontX, fw + 0.05], [g.frontX, topH], [endTop, topH], [endBottom, fw], [g.frontX + 0.3, fw]], "cad-trailer", grad("gTrailer"))}
    ${markers(s, g.frontX + 0.5, endBottom - 0.3, fw + PLATFORM_DEPTH_M / 2, 1.1)}
    ${rect(s, -0.5, fw - 0.035, 0.5, fw, "cad-saddle", 1)}${rect(s, -0.06, fw - 0.15, 0.06, fw, "cad-kingpin")}
    ${powerPack(s, g.frontX + 0.1, topH)}
  </g>`
}

function bogieStartX(r, legX) {
  return Math.max(legX + 0.6, r.geometry.frontTyreEdgeX - 0.3)
}

/** Cradle webs between the rear cones — drawn behind the vessel. */
function rearCradle(s, r, p, deckM, startX) {
  const cradleTop = deckM + (p.saddleH - deckM) * 0.8
  const endX = Math.min(p.x2 - 0.3, p.rearSlopeX(cradleTop) + 0.15)
  if (endX - startX < 0.4) return ""
  return poly(s, [[startX - 0.35, deckM], [startX + 0.1, cradleTop], [endX, cradleTop], [endX + 0.2, deckM]], "cad-cradle")
}

/** Bogie sub-frame under the rear cones (the only chassis rails on the vehicle). */
function bogieSubframe(s, r, deckM, beamM, startX) {
  const g = r.geometry
  const bottom = deckM - beamM
  return `<g>
    ${poly(s, [[startX - 0.45, deckM], [g.rearX, deckM], [g.rearX, bottom], [startX, bottom]], "cad-trailer", grad("gTrailer"))}
    ${markers(s, startX + 0.3, g.rearX - 0.4, deckM - beamM * 0.5, 1.8)}
    ${rearEnd(s, g.rearX, deckM, beamM)}
  </g>`
}

function legAndGuards(s, p, legX, guardEndX) {
  const legTop = Math.max(1.0, p.frontSlopeH(legX + 0.1) - 0.02)
  const pipeBottom = p.bot - PIPE_DROP_M - 0.05
  const guardTop = Math.min(0.8, pipeBottom - 0.06)
  const guardStart = legX + 0.5
  const hasGuard = guardEndX - guardStart > 0.8 && guardTop > 0.5
  const posts = []
  for (let x = guardStart + 0.15; hasGuard && x <= guardEndX - 0.1; x += 1.15) posts.push(rect(s, x - 0.025, guardTop - 0.24, x + 0.025, pipeBottom, "cad-guard"))
  const rails = hasGuard
    ? `${rect(s, guardStart, guardTop - 0.08, guardEndX, guardTop, "cad-guard", 1)}${rect(s, guardStart, guardTop - 0.24, guardEndX, guardTop - 0.16, "cad-guard", 1)}`
    : ""
  return `<g>
    ${poly(s, [[legX - 0.34, p.frontSlopeH(legX - 0.34)], [legX + 0.14, p.frontSlopeH(legX + 0.14)], [legX + 0.12, legTop - 0.3], [legX - 0.1, legTop - 0.3]], "cad-cradle")}
    ${landingLeg(s, legX, legTop)}
    ${posts.join("")}${rails}
  </g>`
}

/** Aeration air line from the compressor, top pressurising riser, cone valves and the discharge line. */
function piping(s, r, p) {
  const g = r.geometry
  const fw = r.config.fifthWheelMm / 1000
  const feedH = fw + PLATFORM_DEPTH_M + 0.4
  const manifoldH = p.bot + MANIFOLD_RISE_M
  const pipeH = p.bot - PIPE_DROP_M
  const lastX = p.outlets[p.outlets.length - 1]
  const off = 0.1
  const feedX = p.frontSlopeX(feedH) - off
  const air = [[g.frontX + 1.36, feedH], [feedX, feedH], [p.frontFoot - off - 0.12, manifoldH], [lastX + 0.3, manifoldH]]
  const riser = `M ${s.X(feedX)} ${s.Y(feedH)} L ${s.X(p.x1 - 0.07)} ${s.Y(p.shoulderH)} L ${s.X(p.x1 - 0.07)} ${s.Y(p.top - p.cornerR)} Q ${s.X(p.x1 - 0.07)} ${s.Y(p.top + 0.07)} ${s.X(p.x1 + p.cornerR)} ${s.Y(p.top + 0.07)}`
  const dischargeEnd = g.rearX - 0.3
  const cones = p.outlets.map((cx) => `
    ${rect(s, cx - 0.06, pipeH, cx + 0.06, p.bot - 0.14, "cad-discharge")}
    ${rect(s, cx - 0.1, p.bot - 0.07, cx + 0.1, p.bot, "cad-discharge", 1)}
    ${rect(s, cx - 0.14, p.bot - 0.14, cx + 0.14, p.bot - 0.07, "cad-valve", 1)}
    ${line(s, cx + 0.14, p.bot - 0.105, cx + 0.3, p.bot - 0.03, "cad-rail")}
    ${rect(s, cx - 0.44, manifoldH - 0.04, cx - 0.34, manifoldH + 0.04, "cad-valve", 1)}`).join("")
  return `<g>
    <polyline points="${air.map(([x, h]) => `${s.X(x)},${s.Y(h)}`).join(" ")}" class="cad-airline" />
    <path d="${riser}" class="cad-airline" />
    ${rect(s, p.outlets[0] - 0.12, pipeH - 0.05, dischargeEnd, pipeH + 0.05, "cad-discharge", 3)}
    ${cones}
    ${rect(s, dischargeEnd - 0.04, pipeH - 0.08, dischargeEnd + 0.08, pipeH + 0.08, "cad-valve", 1)}
  </g>`
}

/** Catwalk, fold-down handrail, hinged manhole covers and the rear access ladder. */
function topHardware(s, p, deckM) {
  const railH = p.top + 0.15
  const from = p.x1 + p.cornerR
  const to = p.x2 - p.cornerR
  const posts = []
  for (let x = from + 0.1; x <= to; x += 1.3) posts.push(line(s, x, p.top, x, railH, "cad-rail"))
  const manholes = p.outlets.map((cx) => `
    ${rect(s, cx - 0.25, p.top, cx + 0.25, p.top + 0.07, "cad-dome", 1)}
    ${rect(s, cx - 0.29, p.top + 0.07, cx + 0.29, p.top + 0.11, "cad-dome", 2)}
    ${line(s, cx - 0.22, p.top + 0.13, cx + 0.46, p.top + 0.13, "cad-rail")}${dot(s, cx + 0.33, p.top + 0.1, 0.03, "cad-valve")}`).join("")
  const ladderX = p.x2 + 0.09
  const standoffs = []
  for (let h = p.shoulderH + 0.15; h < p.top - p.cornerR; h += 0.3) standoffs.push(line(s, p.x2, h, ladderX, h, "cad-rail"))
  return `<g>
    ${rect(s, from, p.top, to, p.top + 0.025, "cad-guard")}
    ${line(s, from, railH, to, railH, "cad-rail")}${posts.join("")}
    ${manholes}
    <path d="M ${s.X(ladderX)} ${s.Y(deckM)} L ${s.X(ladderX)} ${s.Y(p.top - p.cornerR)} Q ${s.X(ladderX)} ${s.Y(railH)} ${s.X(to)} ${s.Y(railH)}" class="cad-rail" fill="none" />
    ${standoffs.join("")}
  </g>`
}

export function siloTanker(s, r, deckM, beamM) {
  const p = siloProfile(r, deckM)
  const legX = Math.min(r.geometry.frontX + LEG_SETBACK_M, p.frontFoot - 0.45)
  const bogieX = bogieStartX(r, legX)
  return `<g>
    ${rearCradle(s, r, p, deckM, bogieX)}
    ${legAndGuards(s, p, legX, bogieX - 0.6)}
    <path d="${shellPath(s, p)}" class="cad-tank-shell" ${grad("gTankSteel")} />
    ${shellDetails(s, p)}
    ${frontPlatform(s, r, p)}
    ${bogieSubframe(s, r, deckM, beamM, bogieX)}
    ${piping(s, r, p)}
    ${topHardware(s, p, deckM)}
  </g>`
}
