// Statutory checks against the selected market's rules (lib/regulations.js).
import { tyreFit, round } from "./model.js"
import { STD_TANK_WIDTH_M } from "./equipment.js"

const GROUP_NAMES = { 1: "single axle", 2: "tandem group", 3: "tri-axle group" }
const resolveLimit = (val, args) => (typeof val === "function" ? val(args) : val)

function exemptionFlags(ctx) {
  const { parts } = ctx
  return {
    isAir: parts.suspension.kind === "air",
    isWide: tyreFit(parts.tyre) === "wide",
    tyreWidthMm: parts.tyre.widthMm,
    isCarrier: false,
    isContainer: false,
    is40PlusContainer: false,
    is45Container: false
  }
}

function check(id, label, value, limit, exceed, { unit = "t", note = "", isWeightBased = true } = {}) {
  if (limit === null || limit === undefined || !Number.isFinite(limit)) return null
  const status = value > limit + 1e-6 ? exceed : "ok"
  return { id, group: "legal", label, value: round(value, 2), limit: round(limit, 2), unit, status, note, isWeightBased }
}

function axleChecks(ctx, exceed) {
  const { parts, loads, config, geo } = ctx
  const { region, suspension, tyre, tractor } = parts
  const n = config.axles
  const groupName = GROUP_NAMES[n] ?? `${n}-axle group`
  const fit = tyreFit(tyre)
  const groupLimit = region.trailerGroup(n, config.spacingM, fit, { isAir: suspension.kind === "air", tyreWidthMm: tyre.widthMm })
  const checks = []
  if (groupLimit === null || groupLimit === undefined) {
    const note = region.verified
      ? `${region.name} sets no limit for a ${groupName} — needs an abnormal-load permit.`
      : "Axle-group limit not published in a verifiable official source — confirm locally."
    checks.push({ id: "legal-group", group: "legal", label: `Trailer ${groupName} load`, value: loads.groupT, limit: null, unit: "t", status: region.verified ? exceed : "info", note, isWeightBased: true })
  } else {
    checks.push(check("legal-group", `Trailer ${groupName} load`, loads.groupT, groupLimit, exceed, { note: `${n} × ${config.spacingM} m spacing, ${fit === "wide" ? "super-single" : "dual"} tyres` }))
  }
  checks.push(check("legal-steer", "Tractor steer axle", loads.steerT, region.steer, exceed))
  const driveLimit = tractor.driveAxles > 1 ? region.driveTandem(false) : region.driveSingle
  checks.push(check("legal-drive", `Tractor drive ${tractor.driveAxles > 1 ? "tandem" : "axle"}`, loads.driveT, driveLimit, exceed))

  const totalAxles = 1 + tractor.driveAxles + n
  const outerSpanM = tractor.wheelbaseM - tractor.fifthWheelLeadM + geo.lastX
  const kingpinToFirstAxleM = geo.lastX - (n - 1) * config.spacingM
  const flags = exemptionFlags(ctx)
  checks.push(check("legal-gcw", `Gross combination weight (${totalAxles} axles)`, loads.gcwT, region.gcw({ totalAxles, outerSpanM, kingpinToFirstAxleM, ...flags }), exceed))
  if (region.trailerGvw) {
    checks.push(check("legal-trailer-gvw", `Semi-trailer gross mass (${n} axles)`, loads.trailerGvwT, region.trailerGvw({ model: config.model, trailerAxles: n }), exceed))
  }
  if (region.minDriveShare) {
    const share = loads.driveT / loads.gcwT
    const isLow = share < region.minDriveShare
    checks.push({ id: "legal-drive-share", group: "legal", label: "Drive-axle share of GCW (min)", value: round(share * 100, 1), limit: region.minDriveShare * 100, unit: "%", status: isLow ? exceed : "ok", note: "GB 1589 §4.6.1: drive axle ≥ 25% of GCW", isWeightBased: true })
  }
  return checks
}

function dimensionChecks(ctx, exceed) {
  const { parts, config, geo } = ctx
  const { region, tractor } = parts
  const dims = { unit: "m", isWeightBased: false }
  const checks = []
  const flags = exemptionFlags(ctx)
  checks.push(check("legal-width", "Overall tank width", STD_TANK_WIDTH_M, region.maxWidth, exceed, dims))
  checks.push(check("legal-height", "Overall loaded height", geo.overallHeightM, resolveLimit(region.maxHeight, flags), exceed, dims))
  const trailerLimit = region.trailerLength?.({ model: config.model, trailerAxles: config.axles, ...flags })
  checks.push(check("legal-trailer-length", "Semi-trailer length", config.lengthM, trailerLimit, exceed, dims))
  checks.push(check("legal-kingpin-rear", "Kingpin to trailer rear", geo.rearX, resolveLimit(region.maxKingpinToRear, flags), exceed, dims))
  const comboLength = tractor.frontOverhangM + tractor.wheelbaseM - tractor.fifthWheelLeadM + geo.rearX
  checks.push(check("legal-combo-length", "Combination length", comboLength, resolveLimit(region.maxCombinationLength, flags), exceed, { ...dims, note: "Estimated from tractor geometry" }))
  if (region.maxRearOverhang) {
    const overhang = geo.rearX - geo.lastX
    const limit = Math.min(region.maxRearOverhang, region.rearOverhangRatio * geo.lastX)
    checks.push(check("legal-rear-overhang", "Rear overhang behind last axle", overhang, limit, exceed, { ...dims, note: "GB 1589 §4.5: ≤ 55% of wheelbase and ≤ 3.5 m" }))
  }
  return checks
}

/** The market's bulk-liquid tank table entry for this combination, or null when the rule does not apply. */
function liquidTankRule({ parts, config }) {
  const table = parts.region.liquidTank
  if (!table || parts.model.family !== "liquid") return null
  const combo = `${parts.tractor.driveAxles + 1}+${config.axles}`
  return { table, combo, limits: table.combos[combo] ?? null }
}

/**
 * Largest volume (m³) the market lets this combination load: the Part B limit for the product,
 * or the Part A tank capacity for liquids Part B does not list. Null when no volume rule applies.
 */
export function eacVolumeCapM3(norm) {
  const limits = liquidTankRule(norm)?.limits
  if (!limits) return null
  return limits.products[norm.parts.medium.eacProduct] ?? limits.tankM3
}

/** EAC reg. 6: tank capacity (Part A) and loaded volume per product (Part B) for bulk-liquid tankers. */
function liquidTankChecks(ctx, exceed) {
  const { parts, config, tare } = ctx
  const rule = liquidTankRule(ctx)
  if (!rule) return []
  const { table, combo, limits } = rule
  const volume = { unit: "m³", isWeightBased: false }
  if (!limits) {
    return [{ id: "legal-eac-tank", group: "legal", label: "Bulk-liquid tank capacity", value: round(config.volumeLiters / 1000, 1), limit: null, unit: "m³", status: "info", note: `${table.source} lists no tank category for a ${combo} axle combination — confirm with the road authority.`, isWeightBased: false }]
  }
  const comboTareT = round(parts.tractor.tareT + tare.totalT, 1)
  const isTareOver = comboTareT > limits.maxTareT
  const tankNote = `Part A, ${combo} axles (valid up to ${limits.maxTareT} t combined tare; estimated ${comboTareT} t)`
  const tankCheck = check("legal-eac-tank", "Bulk-liquid tank capacity", config.volumeLiters / 1000, limits.tankM3, exceed, { ...volume, note: tankNote })
  const checks = [isTareOver && tankCheck.status === "ok" ? { ...tankCheck, status: "warn", note: `${tankNote} — tare above the category limit; confirm the tank category locally.` } : tankCheck]
  const productKey = parts.medium.eacProduct
  if (productKey) {
    const loadedM3 = Math.round(config.volumeLiters * (config.fillPct / 100)) / 1000
    checks.push(check("legal-eac-product", `Loaded volume of ${table.productLabels[productKey].toLowerCase()}`, loadedM3, limits.products[productKey], exceed, { ...volume, note: `Part B, ${combo} axles` }))
  }
  return checks
}

export function legalChecks(ctx) {
  return [...axleChecks(ctx, "fail"), ...dimensionChecks(ctx, "fail"), ...liquidTankChecks(ctx, "fail")].filter(Boolean)
}
