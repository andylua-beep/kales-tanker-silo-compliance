// Mechanical, geometric and tanker-specific safety checks (ullage, medium compatibility, pneumatic discharge).
import { TRACTOR_TYRE_DIA_M, NECK_TYRE_CLEARANCE_M } from "./equipment.js"
import { tyreAxleCapT, tyreFit, round } from "./model.js"

const TRACTOR_LIMITS = { steerMaxT: 7.5, driveMaxSingleT: 13, driveMaxTandemT: 26, kingpinMaxT: 24, minDriveShare: 0.25 }

function limitCheck({ id, group, label, value, limit, unit, note = "", isWeightBased = true }) {
  const status = value > limit + 1e-6 ? "fail" : value / limit > 0.96 ? "warn" : "ok"
  return { id, group, label, value: round(value, 2), limit: round(limit, 2), unit, status, note, isWeightBased }
}

function infoCheck({ id, group, label, value = null, limit = null, unit = "", status = "info", note = "", isWeightBased = false }) {
  return { id, group, label, value, limit, unit, status, note, isWeightBased }
}

export function mechanicalChecks({ config, parts, loads }) {
  const { suspension, tyre, tractor } = parts
  const fit = tyreFit(tyre)
  const tyreCap = tyreAxleCapT(tyre, fit)
  const driveLimit = tractor.driveAxles > 1 ? TRACTOR_LIMITS.driveMaxTandemT : TRACTOR_LIMITS.driveMaxSingleT
  const driveShare = round((loads.driveT / loads.gcwT) * 100, 1)
  return [
    limitCheck({ id: "axle-rating", group: "mechanical", label: "Suspension rating per axle", value: loads.perAxleT, limit: suspension.ratingT, unit: "t", note: suspension.label }),
    limitCheck({ id: "tyre-rating", group: "mechanical", label: "Tyre capacity per axle", value: loads.perAxleT, limit: tyreCap, unit: "t", note: `${tyre.label} (${fit === "wide" ? "2/axle" : "4/axle"})` }),
    limitCheck({ id: "kingpin", group: "mechanical", label: "Kingpin static load", value: loads.kingpinT, limit: TRACTOR_LIMITS.kingpinMaxT, unit: "t", note: "2\" or 3.5\" kingpin vertical rating" }),
    limitCheck({ id: "tractor-steer", group: "mechanical", label: "Tractor steer axle", value: loads.steerT, limit: TRACTOR_LIMITS.steerMaxT, unit: "t" }),
    limitCheck({ id: "tractor-drive", group: "mechanical", label: `Tractor drive ${tractor.driveAxles > 1 ? "tandem" : "axle"}`, value: loads.driveT, limit: driveLimit, unit: "t" }),
    infoCheck({ id: "traction", group: "mechanical", label: "Drive-axle share (traction)", value: driveShare, limit: 25, unit: "%", status: driveShare < 25 ? "warn" : "ok", note: "≥ 25% keeps drive tyres planted on wet grades", isWeightBased: true })
  ]
}

export function geometryChecks({ config, parts, geo, maxAxles, minLengthForMax }) {
  const checks = [
    limitCheck({ id: "axle-fit", group: "geometry", label: "Axles fitting in trailer length", value: config.axles, limit: maxAxles, unit: "", isWeightBased: false, note: minLengthForMax })
  ]
  const clearanceM = round(parts.tractor.fifthWheelMm / 1000 - TRACTOR_TYRE_DIA_M, 2)
  const isTight = clearanceM < NECK_TYRE_CLEARANCE_M
  checks.push(infoCheck({
    id: "fifth-wheel-height", group: "geometry", label: "Frame underside over tractor drive tyres",
    value: clearanceM, unit: "m", status: isTight ? "warn" : "info",
    note: isTight ? `Fifth wheel ${parts.tractor.fifthWheelMm} mm is tight over Ø${TRACTOR_TYRE_DIA_M * 1000} mm drive tyres` : `Fifth wheel ${parts.tractor.fifthWheelMm} mm`
  }))
  checks.push(limitCheck({
    id: "deck-stack", group: "geometry", label: "Min. frame height over tyres vs. set height",
    value: geo.minDeckOverAxleMm, limit: config.deckMm, unit: "mm", isWeightBased: false,
    note: geo.minDeckOverAxleMm > config.deckMm ? `Requires gooseneck drop or smaller tyres (${geo.minDeckOverAxleMm} mm min straight)` : `Tyre radius + ${parts.suspension.kind} stack + ${parts.model.beamDepthMm} mm beam`
  }))
  return checks
}

export function tankerChecks({ config, parts, geo }) {
  const { model, medium, tankShape } = parts
  const isSilo = model.family === "silo"
  const effectiveLiters = Math.round(config.volumeLiters * (config.fillPct / 100))
  const ullagePct = 100 - config.fillPct
  const ullageLiters = config.volumeLiters - effectiveLiters
  const checks = []
  const vb = geo?.volumeBreakdown
  if (vb) {
    const headText = vb.headsM3 > 0 ? ` + 2 heads ${vb.headsM3} m³ (h=${config.headDepthM} m)` : " (flat ends)"
    const detailText = vb.conesM3 > 0
      ? `Upper barrel ${vb.barrelM3} m³ + ${config.compartments} cone frustums ${vb.conesM3} m³${headText} − ${config.internalLossPct}% fluidization bed/tolerance (-${vb.lossM3} m³) = ${vb.netM3} m³ net`
      : `Barrel ${vb.barrelM3} m³ (${vb.straightLenM} × ${vb.effectiveWidthM} × ${vb.effectiveHeightM} m)${headText} − ${config.internalLossPct}% baffles/tolerance (-${vb.lossM3} m³) = ${vb.netM3} m³ net`
    checks.push(infoCheck({
      id: "volume-formula",
      group: "geometry",
      label: `Shell volume (${tankShape.label})`,
      value: vb.netM3,
      unit: "m³",
      status: Math.abs(vb.netM3 - config.volumeLiters / 1000) > 1.5 ? "warn" : "info",
      note: detailText
    }))
  }

  // 1. Ullage / thermal expansion & surge check
  if (!isSilo) {
    const minUllage = medium.minUllagePct
    const status = ullagePct < minUllage ? "fail" : ullagePct < minUllage + 2 ? "warn" : config.fillPct < 80 && config.compartments < 2 ? "warn" : "ok"
    const note = ullagePct < minUllage
      ? `Thermal expansion hazard: ${ullagePct}% ullage is below the ${minUllage}% minimum for ${medium.label}.`
      : config.fillPct < 80 && config.compartments < 2
        ? `Partially filled single compartment (${config.fillPct}%) increases liquid surge — add baffles or compartments.`
        : `${ullageLiters.toLocaleString()} L (${ullagePct}%) expansion space across ${config.compartments} compartment(s)`
    checks.push(infoCheck({ id: "ullage", group: "geometry", label: "Thermal expansion ullage", value: ullagePct, limit: minUllage, unit: "%", status, note, isWeightBased: false }))
  }

  // 2. Medium vs tank shell compatibility
  let compatStatus = "ok"
  let compatNote = `${medium.label} matches ${model.shellCode} shell`
  if (isSilo && medium.kind === "liquid") {
    compatStatus = "fail"
    compatNote = `${medium.label} is a liquid — choose a liquid tanker instead of a dry-bulk cement silo.`
  } else if (!isSilo && medium.kind === "powder") {
    compatStatus = "fail"
    compatNote = `${medium.label} is a dry powder — choose the V-Type Bulk Cement Silo.`
  } else if (medium.classTag === "corrosive" && model.shellCode !== "LLDPE / 316L" && model.shellCode !== "316L") {
    compatStatus = "fail"
    compatNote = `${medium.label} corrodes ${model.shellCode} — use Chemical / Acid Tanker or 316L Stainless.`
  } else if (medium.classTag === "food" && model.shellCode !== "316L") {
    compatStatus = "warn"
    compatNote = `Food-grade ${medium.label} normally requires mirror-polished 304/316L Stainless Steel.`
  }
  checks.push(infoCheck({ id: "medium-compat", group: "geometry", label: "Shell & medium compatibility", status: compatStatus, note: compatNote, isWeightBased: false }))

  // 3. Overall height & CG / hazmat stability envelope (2.8 m floor, 4.2 m max)
  const overallH = geo.overallHeightM
  const isHazmat = medium.classTag === "flammable" || medium.classTag === "corrosive"
  let heightStatus = "ok"
  let heightNote = ""
  if (isHazmat) {
    if (overallH > 3.55) {
      heightStatus = "warn"
      heightNote = `Hazmat CG warning: ${overallH} m exceeds the 3.20–3.50 m dangerous-goods height guideline — lower shell or lengthen tank.`
    } else if (overallH >= 3.2) {
      heightNote = `Optimal hazmat / dangerous-goods height (${overallH} m within 3.20–3.50 m low-CG target).`
    } else {
      heightNote = `Compact small hazmat profile (${overallH} m, 2.80–3.20 m band; standard hazmat is 3.20–3.50 m).`
    }
  } else if (overallH > 4.0) {
    heightStatus = "warn"
    heightNote = `High-profile large tanker (${overallH} m, up to 4.20 m max): elevated CG and bridge clearance — only use when route allows > 4.0 m.`
  } else if (overallH >= 3.5) {
    heightNote = `Medium highway tanker band (${overallH} m within 3.50–4.00 m standard range).`
  } else if (overallH >= 3.2) {
    heightNote = `Low-CG profile (${overallH} m, between small 2.8–3.2 m and medium 3.5–4.0 m bands).`
  } else {
    heightNote = `Small / compact tanker band (${overallH} m within 2.80–3.20 m envelope).`
  }
  checks.push(infoCheck({
    id: "tanker-height",
    group: "geometry",
    label: "Tanker height & CG envelope",
    value: overallH,
    limit: isHazmat ? 3.5 : 4.0,
    unit: "m",
    status: heightStatus,
    note: heightNote,
    isWeightBased: false
  }))

  // 4. Pneumatic discharge or Aluminum payload advantage
  const dischargeRate = round(config.compressorFlow * 0.115, 2)
  const unloadMinutes = Math.max(10, Math.round(config.payloadT / dischargeRate))
  const tanker = {
    effectiveLiters,
    ullageLiters,
    ullagePct,
    dischargeRate,
    unloadMinutes,
    isSilo
  }
  return { checks, tanker }
}
