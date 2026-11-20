// Mechanical, geometric and tanker-specific safety checks (ullage, medium compatibility, pneumatic discharge).
import { KINGPIN_SETBACK_M, STD_TANK_WIDTH_M, TRACTOR_TYRE_DIA_M, NECK_TYRE_CLEARANCE_M } from "./equipment.js"
import { tyreAxleCapT, tyreFit, round } from "./model.js"
import { DESIGN_STANDARDS } from "./regulations.js"

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
  const frontSwingM = round(Math.hypot(KINGPIN_SETBACK_M, STD_TANK_WIDTH_M / 2), 2)
  checks.push(limitCheck({
    id: "iso1726-front-swing", group: "geometry", label: "ISO 1726-1 front swing radius",
    value: frontSwingM, limit: DESIGN_STANDARDS.iso1726.maxFrontSwingRadiusM, unit: "m", isWeightBased: false,
    note: `Kingpin setback ${KINGPIN_SETBACK_M} m × half-width ${STD_TANK_WIDTH_M / 2} m (≤ 2.04 m clears tractor cab; keep landing gear ≥ 2.30 m behind kingpin)`
  }))
  const overhangM = round(geo.rearX - geo.lastX, 2)
  const depDeg = round(Math.atan((DESIGN_STANDARDS.rupd.maxGroundClearanceMm / 1000) / Math.max(0.3, overhangM)) * (180 / Math.PI), 1)
  checks.push(infoCheck({
    id: "rupd-clearance", group: "geometry", label: "ECE R58 / GB 11567 RUPD & departure angle",
    value: depDeg, unit: "°", status: overhangM > DESIGN_STANDARDS.rupd.maxRecommendedOverhangM ? "warn" : "info", isWeightBased: false,
    note: `Mount rear bumper / RUPD ≤ 550 mm ground clearance within 450 mm of rear tank head (est. ${depDeg}° departure angle at ${overhangM} m overhang; ECE R73 side guard ≤ 550 mm).`
  }))
  if (parts.model.family === "liquid") {
    const withCoamingM = round(geo.overallHeightM + DESIGN_STANDARDS.tankerCoaming.typicalHeightM, 2)
    const regMaxH = typeof parts.region.maxHeight === "function" ? parts.region.maxHeight({}) : parts.region.maxHeight
    const coamingOver = regMaxH != null && withCoamingM > regMaxH + 1e-6
    checks.push(infoCheck({
      id: "tanker-top-coaming", group: "geometry", label: "ADR 6.8.2.1.28 top rollover coaming envelope",
      value: withCoamingM, limit: regMaxH, unit: "m", status: coamingOver ? "warn" : "info", isWeightBased: false,
      note: coamingOver
        ? `Shell ${geo.overallHeightM} m + 150 mm rollover coaming/walkway (${withCoamingM} m) exceeds ${regMaxH} m legal height — recess manhole coaming or lower shell.`
        : `Shell ${geo.overallHeightM} m + 150 mm rollover protection coaming (${withCoamingM} m) shields manholes & vapor valves per ADR 6.8.2.1.28 / EN 13094.`
    }))
  }
  return checks
}

export function tankerChecks({ config, parts, geo, tare }) {
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

  // 4. ADR 6.8.2.1.20 / 4.3.2.2.4 compartment volume & surge baffles + ECE R111 rollover stability + Silo PED/TSG21
  if (!isSilo) {
    const perCompL = Math.round(config.volumeLiters / Math.max(1, config.compartments))
    if (isHazmat) {
      const surgeDanger = perCompL > 7500 && config.fillPct > 20 && config.fillPct < 80
      checks.push(infoCheck({
        id: "adr-compartment",
        group: "legal",
        label: "ADR 6.8.2 / GB 18564 compartment & surge baffles",
        value: perCompL,
        limit: 7500,
        unit: "L",
        status: surgeDanger ? "warn" : perCompL > 7500 ? "info" : "ok",
        note: surgeDanger
          ? `${perCompL.toLocaleString()} L/compartment at ${config.fillPct}% fill violates ADR 4.3.2.2.4 (20%–80% prohibited in > 7,500 L compartments without surge baffles).`
          : perCompL > 7500
            ? `${perCompL.toLocaleString()} L/compartment (> 7,500 L): ADR 6.8.2.1.20 & GB 18564 require internal surge baffles every ≤ 7,500 L.`
            : `${perCompL.toLocaleString()} L/compartment is within the 7,500 L unbaffled ADR / GB 18564 section threshold.`,
        isWeightBased: false
      }))
    }
    const deckM = config.deckMm / 1000
    const liquidCenterM = deckM + Math.max(0.4, overallH - deckM) * 0.48
    const tareMass = Math.max(3, tare?.totalT ?? 7.5)
    const payloadMass = Math.max(1, config.payloadT || 20)
    const compositeCgM = (0.9 * tareMass + liquidCenterM * payloadMass) / (tareMass + payloadMass)
    const rolloverDeg = round(Math.atan((1.02 * 0.9) / compositeCgM) * (180 / Math.PI), 1)
    checks.push(infoCheck({
      id: "ece-r111-rollover",
      group: "legal",
      label: "Static rollover stability estimate (UN ECE R111)",
      value: rolloverDeg,
      limit: 23,
      unit: "°",
      status: isHazmat && rolloverDeg < 23 ? "warn" : "ok",
      note: isHazmat && rolloverDeg < 23
        ? `Estimated ${rolloverDeg}° is below UN ECE R111 23° (0.4 g) dangerous-goods threshold (est. CG ${round(compositeCgM, 2)} m) — lower shell height or widen track.`
        : `Estimated ${rolloverDeg}° static tilt angle (UN ECE R111 requires ≥ 23° for ADR tankers; est. CG ${round(compositeCgM, 2)} m).`,
      isWeightBased: false
    }))
  } else {
    checks.push(infoCheck({
      id: "silo-pressure-reg",
      group: "legal",
      label: "Pneumatic silo pressure boundary (PED / TSG 21)",
      value: 0.2,
      limit: 0.2,
      unit: "MPa",
      status: "info",
      note: "Standard 0.2 MPa (2.0 bar) working pressure with relief valves stays within dry-bulk silo pneumatic discharge rules (EU PED 2014/68/EU / China TSG 21); verify safety valve calibration.",
      isWeightBased: false
    }))
  }

  // 5. Pneumatic discharge or Aluminum payload advantage
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
