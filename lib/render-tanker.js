// CAD rendering for liquid tankers (fuel, aluminum, stainless, chemical); the V-type silo lives in render-silo.js.
import { poly, rect, line, grad, rearEnd, markers, landingLeg } from "./render-parts.js"
import { siloTanker } from "./render-silo.js"

const SHELL_GRAD = {
  "aluminum-tanker-trailer": "gTankAlum",
  "stainless-steel-tanker-trailer": "gTankStainless",
  "chemical-tanker-trailers": "gTankChem",
  "fuel-tanker-trailer": "gTankSteel",
  "cement-tanker-trailer": "gTankSteel"
}

function chassisFrame(s, r, deckM, beamM) {
  const g = r.geometry
  const fw = r.config.fifthWheelMm / 1000
  const neckEnd = g.frontX + 2.1
  const dropEnd = g.frontX + 3.2
  const legX = g.frontX + 2.65
  const frameBottom = deckM - beamM

  const framePoly = g.hasGooseneck
    ? [
      [g.frontX, fw + 0.04], [g.frontX, fw + 0.18], [neckEnd, fw + 0.18], [dropEnd, deckM],
      [g.rearX, deckM], [g.rearX, frameBottom], [dropEnd - 0.15, frameBottom], [neckEnd - 0.2, fw], [g.frontX + 0.35, fw]
    ]
    : [
      [g.frontX, deckM], [g.rearX, deckM], [g.rearX, frameBottom], [g.frontX + 0.35, frameBottom], [g.frontX, fw]
    ]

  const guardStart = legX + 0.5
  const guardEnd = g.frontTyreEdgeX - 0.35
  const guard = guardEnd - guardStart > 0.8
    ? `${rect(s, guardStart, 0.56, guardEnd, 0.64, "cad-guard", 1)}${rect(s, guardStart, 0.72, guardEnd, 0.8, "cad-guard", 1)}`
    : ""

  return `<g>
    ${landingLeg(s, legX, g.hasGooseneck ? (fw + frameBottom) / 2 : frameBottom)}
    ${guard}
    ${poly(s, framePoly, "cad-trailer", grad("gTrailer"))}
    ${markers(s, g.frontX + 0.6, g.rearX - 0.4, deckM - beamM * 0.5, 1.8)}
    ${rearEnd(s, g.rearX, deckM, beamM)}
    ${rect(s, -0.5, fw - 0.035, 0.5, fw, "cad-saddle", 1)}${rect(s, -0.06, fw - 0.15, 0.06, fw, "cad-kingpin")}
  </g>`
}

function topWalkwayAndLadder(s, x1, x2, topH, compartments, rearX, deckM) {
  const railH = topH + 0.15
  const posts = []
  for (let x = x1 + 0.4; x <= x2 - 0.3; x += 1.4) posts.push(line(s, x, topH, x, railH, "cad-rail"))
  const domes = Array.from({ length: compartments }, (_, i) => {
    const cx = x1 + ((i + 0.5) * (x2 - x1)) / compartments
    return rect(s, cx - 0.22, topH, cx + 0.22, topH + 0.12, "cad-dome", 2)
  }).join("")
  const ladderX = rearX - 0.04
  const rungs = []
  for (let h = deckM + 0.25; h < topH - 0.1; h += 0.32) rungs.push(line(s, ladderX - 0.16, h, ladderX, h, "cad-rail"))
  return `<g>
    ${line(s, x1 + 0.3, railH, x2 - 0.2, railH, "cad-rail")}
    ${posts.join("")}
    ${domes}
    ${line(s, ladderX, deckM, ladderX, topH + 0.1, "cad-rail")}
    ${rungs.join("")}
  </g>`
}

function liquidTanker(s, r, deckM, beamM) {
  const g = r.geometry
  const { compartments, fillPct } = r.config
  const x1 = g.tankStartX
  const x2 = g.tankEndX
  const bot = deckM
  const top = deckM + g.tankHeightM
  const capR = Math.min(0.65, Math.max(0.1, r.config.headDepthM ?? g.tankHeightM * 0.24))
  const shellGrad = SHELL_GRAD[r.config.model] ?? "gTankAlum"

  // Elliptical/dished-head tank barrel path
  const d = [
    `M ${s.X(x1 + capR)} ${s.Y(top)}`,
    `L ${s.X(x2 - capR)} ${s.Y(top)}`,
    `Q ${s.X(x2 + 0.15)} ${s.Y(top)} ${s.X(x2 + 0.15)} ${s.Y((top + bot) / 2)}`,
    `Q ${s.X(x2 + 0.15)} ${s.Y(bot)} ${s.X(x2 - capR)} ${s.Y(bot)}`,
    `L ${s.X(x1 + capR)} ${s.Y(bot)}`,
    `Q ${s.X(x1 - 0.15)} ${s.Y(bot)} ${s.X(x1 - 0.15)} ${s.Y((top + bot) / 2)}`,
    `Q ${s.X(x1 - 0.15)} ${s.Y(top)} ${s.X(x1 + capR)} ${s.Y(top)} Z`
  ].join(" ")

  const usableX1 = x1 + capR * 0.4
  const usableX2 = x2 - capR * 0.4
  const compW = (usableX2 - usableX1) / compartments
  const fillTop = bot + 0.06 + (g.tankHeightM - 0.12) * (fillPct / 100)
  const compEls = []
  for (let i = 0; i < compartments; i++) {
    const cx1 = usableX1 + i * compW + 0.06
    const cx2 = usableX1 + (i + 1) * compW - 0.06
    compEls.push(rect(s, cx1, bot + 0.06, cx2, fillTop, "cad-liquid", 3))
    if (i > 0) compEls.push(line(s, usableX1 + i * compW, bot + 0.06, usableX1 + i * compW, top - 0.06, "cad-bulkhead"))
  }

  // API bottom discharge manifold box
  const apiX = (x1 + x2) * 0.48
  const apiBox = rect(s, apiX - 0.65, deckM - beamM - 0.18, apiX + 0.65, deckM - beamM, "cad-api-box", 2)

  return `<g>
    ${chassisFrame(s, r, deckM, beamM)}
    ${apiBox}
    <path d="${d}" class="cad-tank-shell" ${grad(shellGrad)} />
    ${compEls.join("")}
    ${topWalkwayAndLadder(s, x1 + 0.3, x2 - 0.3, top, compartments, g.rearX, deckM)}
  </g>`
}

export function tankerParts(s, r) {
  const deckM = r.config.deckMm / 1000
  const beamM = r.parts.model.beamDepthMm / 1000
  return r.parts.model.family === "silo" ? siloTanker(s, r, deckM, beamM) : liquidTanker(s, r, deckM, beamM)
}

export const tankerAxleFrameM = (r) => r.config.deckMm / 1000 - r.parts.model.beamDepthMm / 1000
