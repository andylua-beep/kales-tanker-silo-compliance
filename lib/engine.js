// Public entry point: evaluate(rawConfig) -> full tanker/silo engineering result.
import { normalizeConfig, maxAxlesForLength, minLengthForAxles, trailerTare, payloadCgX, solveLoads, tyreAxleCapT, tyreFit, round } from "./model.js"
import { mechanicalChecks, geometryChecks, tankerChecks } from "./checks.js"
import { legalChecks, eacVolumeCapM3 } from "./legal.js"

export const STATUS_RANK = { ok: 0, info: 0, warn: 1, permit: 2, fail: 3 }

const VERDICTS = {
  ok: { status: "ok", title: "Compliant", text: "Within the selected market's statutory limits, ullage rules and equipment ratings." },
  warn: { status: "warn", title: "Feasible — review warnings", text: "Legal and within ratings, but some operational items need attention." },
  fail: { status: "fail", title: "Not feasible", text: "A statutory limit, equipment rating, ullage threshold or shell compatibility check is exceeded." }
}

const MAX_SEARCH_T = 150

function contextFor(norm, payloadT) {
  const config = { ...norm.config, payloadT }
  const { parts, geometry: geo } = norm
  const tare = trailerTare(config, parts.model, parts.suspension)
  const cgX = payloadCgX(config, geo)
  const loads = solveLoads({ payloadT, cgX, tare, geo, tractor: parts.tractor, axles: config.axles })
  return { config, parts, geo, tare, cgX, loads }
}

function axleHint(norm, maxAxles) {
  const { config, parts } = norm
  const { model, tyre } = parts
  if (maxAxles >= model.axles.max) return ""
  const need = minLengthForAxles(model, maxAxles + 1, config.rearOverhangM, config.spacingM, tyre.diaMm)
  return need <= model.length.max ? `${maxAxles + 1} axles need ≥ ${need} m length.` : `Max ${model.axles.max} axles needs a longer frame than this model offers.`
}

function runChecks(norm, ctx) {
  const { config, parts } = ctx
  const maxAxles = maxAxlesForLength(parts.model, config.lengthM, config.rearOverhangM, config.spacingM, parts.tyre.diaMm)
  const full = { ...ctx, maxAxles, minLengthForMax: axleHint(norm, maxAxles) }
  const { checks: tankChecks, tanker } = tankerChecks(full)
  const checks = [
    ...mechanicalChecks(full),
    ...geometryChecks(full),
    ...tankChecks,
    ...legalChecks(full)
  ].filter(Boolean)
  return { checks, tanker, maxAxles }
}

function worstStatus(checks) {
  return checks.reduce((worst, c) => (STATUS_RANK[c.status] > STATUS_RANK[worst] ? c.status : worst), "ok")
}

function maxPayload(norm, isBlocking) {
  const passes = (w) => {
    const { checks } = runChecks(norm, contextFor(norm, w))
    return !checks.some((c) => c.isWeightBased && isBlocking(c))
  }
  if (!passes(0)) return 0
  let lo = 0
  let hi = MAX_SEARCH_T
  if (passes(hi)) return hi
  for (let i = 0; i < 40 && hi - lo > 0.05; i++) {
    const mid = (lo + hi) / 2
    if (passes(mid)) lo = mid
    else hi = mid
  }
  return round(lo, 1)
}

/** Weight-based legal maximum, further capped by a statutory loaded-volume limit (EAC reg. 6). */
function legalMaxPayload(norm, weightLegalT) {
  const volumeCapM3 = eacVolumeCapM3(norm)
  if (volumeCapM3 === null) return { legal: weightLegalT, limitedBy: "weight", volumeCapM3: null }
  const volumeCapT = round(volumeCapM3 * norm.parts.medium.densityT, 1)
  return volumeCapT < weightLegalT
    ? { legal: volumeCapT, limitedBy: "eac-volume", volumeCapM3 }
    : { legal: weightLegalT, limitedBy: "weight", volumeCapM3 }
}

export function evaluate(raw) {
  const norm = normalizeConfig(raw)
  const ctx = contextFor(norm, norm.config.payloadT)
  const { checks, tanker, maxAxles } = runChecks(norm, ctx)
  const status = worstStatus(checks)
  const fit = tyreFit(norm.parts.tyre)
  return {
    ...norm,
    tare: ctx.tare,
    cgX: ctx.cgX,
    loads: ctx.loads,
    tanker,
    overallHeightM: norm.geometry.overallHeightM,
    tyreAxleCapT: tyreAxleCapT(norm.parts.tyre, fit),
    maxAxles,
    maxPayloadT: {
      ...legalMaxPayload(norm, maxPayload(norm, (c) => c.status !== "ok" && c.status !== "info" && c.status !== "warn")),
      technical: maxPayload(norm, (c) => c.group === "mechanical" && c.status === "fail")
    },
    checks,
    verdict: VERDICTS[status] ?? VERDICTS.fail
  }
}
