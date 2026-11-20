// Input normalisation, tanker/silo geometry, tare build-up and static load solution.
import {
  MODELS, SUSPENSIONS, TRACTORS, TYRES, MEDIA, TANK_SHAPES, TYRES_PER_AXLE,
  KINGPIN_SETBACK_M, FIFTH_WHEEL_MM, STD_TANK_WIDTH_M, TANKER_HEIGHT_RULES, tyresFor, tyreFit
} from "./equipment.js"
import { REGIONS } from "./regulations.js"

const round = (v, d = 2) => +v.toFixed(d)
const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function bounded(issues, field, raw, min, max, fallback, bounds) {
  if (bounds) bounds[field] = { min, max }
  const value = isNum(raw) ? raw : fallback
  if (!isNum(raw)) return value
  if (raw < min || raw > max) {
    const used = clamp(raw, min, max)
    issues.push({ field, requested: raw, used, min, max })
    return used
  }
  return value
}

export function maxAxlesForLength(model, lengthM, rearOverhangM, spacingM, tyreDiaMm) {
  const lastX = lengthM - KINGPIN_SETBACK_M - rearOverhangM
  const available = lastX - tyreDiaMm / 2000 - model.minFrontClearM
  if (available < 0) return 0
  return Math.min(model.axles.max, Math.floor(available / spacingM + 1e-9) + 1)
}

export function minLengthForAxles(model, axles, rearOverhangM, spacingM, tyreDiaMm) {
  const exact = model.minFrontClearM + tyreDiaMm / 2000 + (axles - 1) * spacingM + rearOverhangM + KINGPIN_SETBACK_M
  return Math.ceil(exact * 10 - 1e-9) / 10
}

export function rearDeckHeightMm(model, suspension, tyre) {
  return Math.round(tyre.diaMm / 2 + suspension.stackMm + model.beamDepthMm)
}

/**
 * Tank shell volume calculation:
 * - Cylindrical: π · r² · L_straight
 * - Elliptical: π · a · b · L_straight (≈ 0.785 · W · H · L_straight)
 * - Square-round: 0.82 · W · H · L_straight
 * - Plus two standard elliptical dished heads: 2 × (π · W · H · h / 6)
 * - Minus internal baffles / stiffeners / piping & manufacturing allowance (internalLossPct).
 */
export function computeTankVolume({ shape, tankLenM, tankWidthM, tankHeightM, headDepthM, internalLossPct, cones = 4 }) {
  const straightLenM = Math.max(2, tankLenM - 2 * headDepthM)
  const w = shape.isCircular ? tankHeightM : tankWidthM
  const h = tankHeightM
  if (shape.isSilo) {
    // Segmented V-type bulk powder silo:
    // 1) Upper horizontal barrel (72% height) with round-top ellipse cross-section
    // 2) N inverted frustum hoppers (28% height): N * (π/3) * hCone * (R² + R*rOut + rOut²)
    // 3) Two standard elliptical heads on the upper barrel: 2 * (π * W * hCyl * headDepthM / 6)
    const hCyl = 0.72 * h
    const hCone = 0.28 * h
    const crossAreaM2 = (Math.PI / 4) * w * hCyl
    const barrelM3 = crossAreaM2 * straightLenM
    const rTop = Math.min(w / 2, straightLenM / Math.max(2, 2 * cones))
    const rOut = 0.18
    const conesM3 = cones * (Math.PI / 3) * hCone * (rTop * rTop + rTop * rOut + rOut * rOut)
    const headsM3 = headDepthM > 0 ? 2 * ((Math.PI * w * hCyl * headDepthM) / 6) : 0
    const grossM3 = barrelM3 + conesM3 + headsM3
    const lossM3 = grossM3 * (internalLossPct / 100)
    const netM3 = grossM3 - lossM3
    return {
      shapeId: shape.id,
      straightLenM: round(straightLenM, 2),
      effectiveWidthM: round(w, 2),
      effectiveHeightM: round(h, 2),
      crossAreaM2: round(crossAreaM2, 2),
      barrelM3: round(barrelM3, 2),
      conesM3: round(conesM3, 2),
      headsM3: round(headsM3, 2),
      grossM3: round(grossM3, 2),
      lossM3: round(lossM3, 2),
      netM3: round(netM3, 2)
    }
  }
  const crossAreaM2 = shape.isCircular
    ? Math.PI * Math.pow(h / 2, 2)
    : shape.id === "elliptical"
      ? Math.PI * (w / 2) * (h / 2)
      : shape.factor * w * h
  const barrelM3 = crossAreaM2 * straightLenM
  // Two standard elliptical heads: 2 × (π · W · H · h / 6) = π · W · H · h / 3
  const headsM3 = headDepthM > 0 ? 2 * ((Math.PI * w * h * headDepthM) / 6) : 0
  const grossM3 = barrelM3 + headsM3
  const lossM3 = grossM3 * (internalLossPct / 100)
  const netM3 = grossM3 - lossM3
  return {
    shapeId: shape.id,
    straightLenM: round(straightLenM, 2),
    effectiveWidthM: round(w, 2),
    effectiveHeightM: round(h, 2),
    crossAreaM2: round(crossAreaM2, 2),
    barrelM3: round(barrelM3, 2),
    conesM3: 0,
    headsM3: round(headsM3, 2),
    grossM3: round(grossM3, 2),
    lossM3: round(lossM3, 2),
    netM3: round(netM3, 2)
  }
}

export function solveTankHeightM({ shape, tankLenM, tankWidthM, headDepthM, internalLossPct, targetNetM3, cones = 4 }) {
  const straightLenM = Math.max(2, tankLenM - 2 * headDepthM)
  if (shape.isSilo) {
    let lo = 0.5
    let hi = 4.0
    for (let i = 0; i < 30; i += 1) {
      const mid = (lo + hi) / 2
      const { netM3 } = computeTankVolume({ shape, tankLenM, tankWidthM, tankHeightM: mid, headDepthM, internalLossPct, cones })
      if (netM3 < targetNetM3) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const targetGrossM3 = targetNetM3 / Math.max(0.5, 1 - internalLossPct / 100)
  if (shape.isCircular) {
    const denom = (Math.PI / 4) * straightLenM + (Math.PI / 3) * headDepthM
    return Math.sqrt(Math.max(0.5, targetGrossM3 / denom))
  }
  const denom = tankWidthM * (shape.factor * straightLenM + (Math.PI / 3) * headDepthM)
  return targetGrossM3 / Math.max(0.5, denom)
}

export function normalizeConfig(raw = {}) {
  const issues = []
  const bounds = {}
  const regionId = Object.hasOwn(REGIONS, raw.region) ? raw.region : "CN"
  const modelId = Object.hasOwn(MODELS, raw.model) ? raw.model : "aluminum-tanker-trailer"
  const model = MODELS[modelId]

  const tractorId = Object.hasOwn(TRACTORS, raw.tractor) ? raw.tractor : model.defaultTractor
  const fifthWheelMm = Math.round(bounded(issues, "fifthWheelMm", raw.fifthWheelMm, FIFTH_WHEEL_MM.min, FIFTH_WHEEL_MM.max, TRACTORS[tractorId].fifthWheelMm, bounds))
  const tractor = { ...TRACTORS[tractorId], fifthWheelMm }

  const suspensionId = model.suspensions.includes(raw.suspension) ? raw.suspension : model.suspensions[0]
  const suspension = SUSPENSIONS[suspensionId]
  const tyreChoices = tyresFor()
  const tyre = tyreChoices.find((t) => t.id === raw.tyre) ?? tyreChoices.find((t) => t.id === model.defaultTyre) ?? tyreChoices[0]

  const spacingM = bounded(issues, "spacingM", raw.spacingM, suspension.spacing.min, suspension.spacing.max, suspension.spacing.default, bounds)
  const deckMm = Math.round(bounded(issues, "deckMm", raw.deckMm, model.deckMm.min, model.deckMm.max, model.deckMm.default, bounds))

  const lengthM = bounded(issues, "lengthM", raw.lengthM, model.length.min, model.length.max, model.length.default, bounds)
  const overhangRoom = lengthM - KINGPIN_SETBACK_M - model.minFrontClearM - tyre.diaMm / 2000 - (model.axles.min - 1) * spacingM
  const overhangMax = Math.max(model.rearOverhang.min, Math.min(model.rearOverhang.max, Math.floor(overhangRoom * 20 + 1e-9) / 20))
  const rearOverhangM = bounded(issues, "rearOverhangM", raw.rearOverhangM, model.rearOverhang.min, overhangMax, Math.min(model.rearOverhang.default, overhangMax), bounds)
  const maxAxles = Math.max(model.axles.min, maxAxlesForLength(model, lengthM, rearOverhangM, spacingM, tyre.diaMm))
  const axles = Math.round(bounded(issues, "axles", raw.axles, model.axles.min, maxAxles, Math.min(model.axles.default, maxAxles), bounds))

  const medium = MEDIA.find((m) => m.id === raw.medium) ?? MEDIA.find((m) => m.id === model.defaultMedium) ?? MEDIA[0]
  const tankShapeId = Object.hasOwn(TANK_SHAPES, raw.tankShape) ? raw.tankShape : model.defaultShape
  const tankShape = TANK_SHAPES[tankShapeId]
  const tankWidthM = round(bounded(issues, "tankWidthM", raw.tankWidthM, 1.6, 2.55, model.defaultTankWidthM ?? 2.48, bounds), 2)
  const headDepthM = round(bounded(issues, "headDepthM", raw.headDepthM, 0, 0.75, tankShape.defaultHeadDepthM, bounds), 2)
  const internalLossPct = round(bounded(issues, "internalLossPct", raw.internalLossPct, 0, 10, tankShape.defaultLossPct ?? 2.0, bounds), 1)
  const compartments = Math.round(bounded(issues, "compartments", raw.compartments, model.compartments.min, model.compartments.max, model.compartments.default, bounds))
  const isSilo = model.family === "silo"
  const tankStartX = isSilo ? -KINGPIN_SETBACK_M + 1.85 : -KINGPIN_SETBACK_M + 0.18
  const tankEndX = lengthM - KINGPIN_SETBACK_M - 0.15
  const estTankLenM = Math.max(4, tankEndX - tankStartX)
  const deckM = deckMm / 1000
  const topHardwareM = isSilo ? 0.16 : 0.18
  // Floor overall height at 2.80 m (no overly low builds); cap at 4.20 m max for large tankers
  const minH = round(Math.max(1.45, TANKER_HEIGHT_RULES.minOverallM - deckM - topHardwareM), 2)
  const maxH = round(Math.min(2.90, TANKER_HEIGHT_RULES.maxOverallM - deckM - topHardwareM), 2)
  if (bounds) bounds.tankHeightM = { min: minH, max: maxH }

  let volumeLiters
  let tankHeightM
  const defaultShellH = round(clamp(2.05, minH, maxH), 2)
  if (isNum(raw.tankHeightM) && !isNum(raw.volumeLiters)) {
    tankHeightM = round(bounded(issues, "tankHeightM", raw.tankHeightM, minH, maxH, defaultShellH, bounds), 2)
    const vol = computeTankVolume({ shape: tankShape, tankLenM: estTankLenM, tankWidthM, tankHeightM, headDepthM, internalLossPct, cones: compartments })
    volumeLiters = Math.round(bounded(issues, "volumeLiters", Math.round(vol.netM3 * 1000), model.volumeLiters.min, model.volumeLiters.max, model.volumeLiters.default, bounds))
  } else {
    volumeLiters = Math.round(bounded(issues, "volumeLiters", raw.volumeLiters, model.volumeLiters.min, model.volumeLiters.max, model.volumeLiters.default, bounds))
    const solvedH = solveTankHeightM({ shape: tankShape, tankLenM: estTankLenM, tankWidthM, headDepthM, internalLossPct, targetNetM3: volumeLiters / 1000, cones: compartments })
    tankHeightM = round(clamp(solvedH, minH, maxH), 2)
  }

  const fillPct = Math.round(bounded(issues, "fillPct", raw.fillPct, model.fillPct.min, model.fillPct.max, model.fillPct.default, bounds))
  const compressorFlow = model.family === "silo"
    ? Math.round(bounded(issues, "compressorFlow", raw.compressorFlow, model.compressorFlow.min, model.compressorFlow.max, model.compressorFlow.default, bounds))
    : 12

  const effectiveLiters = Math.round(volumeLiters * (fillPct / 100))
  const payloadT = round((effectiveLiters * medium.densityT) / 1000, 2)

  const config = {
    region: regionId,
    model: modelId,
    tractor: tractorId,
    fifthWheelMm,
    suspension: suspensionId,
    tyre: tyre.id,
    axles,
    spacingM,
    lengthM,
    rearOverhangM,
    deckMm,
    medium: medium.id,
    tankShape: tankShapeId,
    tankWidthM: tankShape.isCircular ? tankHeightM : tankWidthM,
    tankHeightM,
    headDepthM,
    internalLossPct,
    volumeLiters,
    compartments,
    fillPct,
    compressorFlow,
    payloadT
  }

  const geometry = buildGeometry({ config, model, suspension, tyre, tankShape })
  return {
    config,
    issues,
    parts: { region: REGIONS[regionId], model, suspension, tyre, tractor, medium, tankShape },
    geometry,
    bounds
  }
}

export function buildGeometry({ config, model, suspension, tyre, tankShape }) {
  const { axles: n, spacingM: s, lengthM: L, rearOverhangM, deckMm, tankWidthM, tankHeightM, headDepthM, internalLossPct } = config
  const shape = tankShape ?? TANK_SHAPES[config.tankShape ?? model.defaultShape]
  const tyreR = tyre.diaMm / 2000
  const frontX = -KINGPIN_SETBACK_M
  const rearX = L - KINGPIN_SETBACK_M
  const lastX = rearX - rearOverhangM
  const firstX = lastX - (n - 1) * s

  const isSilo = model.family === "silo"
  const hasGooseneck = deckMm < config.fifthWheelMm - 60 || isSilo
  const tankStartX = isSilo ? frontX + 1.85 : frontX + 0.18
  const tankEndX = rearX - 0.15
  const tankLenM = Math.max(4, tankEndX - tankStartX)

  const volumeBreakdown = computeTankVolume({ shape, tankLenM, tankWidthM, tankHeightM, headDepthM, internalLossPct, cones: config.compartments })
  const deckM = deckMm / 1000
  const topHardwareM = isSilo ? 0.16 : 0.18 // manholes + catwalk/railings
  const minDeckOverAxleMm = rearDeckHeightMm(model, suspension, tyre)
  const rearDeckM = Math.max(deckM, minDeckOverAxleMm / 1000)

  const overallHeightM = round(deckM + tankHeightM + topHardwareM, 2)

  return {
    frontX,
    rearX,
    firstX,
    lastX,
    groupX: (firstX + lastX) / 2,
    groupSpanM: (n - 1) * s,
    frontTyreEdgeX: firstX - tyreR,
    tyreR,
    hasGooseneck,
    tankStartX,
    tankEndX,
    tankLenM: round(tankLenM, 2),
    tankHeightM,
    topHardwareM,
    overallHeightM,
    rearDeckM,
    minDeckOverAxleMm,
    volumeBreakdown
  }
}

export function trailerTare(config, model, suspension) {
  const frameT = model.tare.baseT + model.tare.perMetreT * config.lengthM
  const frameX = model.tare.cgFrac * config.lengthM - KINGPIN_SETBACK_M
  const axlesT = config.axles * suspension.massPerAxleT
  return { frameT: round(frameT), frameX, axlesT: round(axlesT), totalT: round(frameT + axlesT, 1) }
}

export function payloadCgX(config, geo) {
  return (geo.tankStartX + geo.tankEndX) / 2
}

export function solveLoads({ payloadT, cgX, tare, geo, tractor, axles }) {
  const total = tare.frameT + tare.axlesT + payloadT
  const moment = tare.frameT * tare.frameX + tare.axlesT * geo.groupX + payloadT * cgX
  const groupT = moment / geo.groupX
  const kingpinT = total - groupT
  const leadRatio = tractor.fifthWheelLeadM / tractor.wheelbaseM
  const steerT = tractor.frontTareT + kingpinT * leadRatio
  const driveT = tractor.tareT - tractor.frontTareT + kingpinT * (1 - leadRatio)
  return {
    trailerGvwT: round(total, 2),
    groupT: round(groupT, 2),
    perAxleT: round(groupT / axles, 2),
    kingpinT: round(kingpinT, 2),
    steerT: round(steerT, 2),
    driveT: round(driveT, 2),
    gcwT: round(total + tractor.tareT, 2)
  }
}

export function tyreAxleCapT(tyre, fit) {
  const perTyre = fit === "wide" ? tyre.singleT : tyre.dualT
  return round(perTyre * TYRES_PER_AXLE[fit], 2)
}

export { TYRES, tyreFit, round }
