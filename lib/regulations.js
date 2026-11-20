// Statutory axle-load, gross-weight and dimension limits per market.
// All weights in tonnes, distances in metres.
// SINGLE SOURCE OF TRUTH: edit chrome-extensions/shared/regulations.js, then run
// scripts/sync-shared.mjs and rebuild the bundles. Each region's `basis` says how far
// its numbers were traced (see BASIS_LABELS); `verified` only means "enforce a missing
// axle-group limit as a permit case" rather than "confirm locally".

/** How each region's figures were sourced. Shown as the badge next to the region name. */
export const BASIS_LABELS = {
  official: { label: "Official text", status: "ok", note: "" },
  secondary: { label: "Secondary source", status: "warn", note: " — figures taken from secondary/corridor sources; confirm with the local authority" },
  "not-in-force": { label: "Not yet in force", status: "warn", note: " — published rule whose implementation was postponed; confirm current enforcement" },
  unverified: { label: "Partly verified", status: "warn", note: " — axle limits not verifiable" }
}

const LB_PER_T = 2204.62
const FT_PER_M = 3.28084

/** US Federal Bridge Formula, 23 CFR 658.17(e). L in metres, n axles -> tonnes. */
export function bridgeFormulaTonnes(lengthM, n) {
  if (n < 2) return null
  const lFt = Math.round(lengthM * FT_PER_M)
  const lb = 500 * ((lFt * n) / (n - 1) + 12 * n + 36)
  return +(lb / LB_PER_T).toFixed(2)
}

const byBand = (bands) => (spacing) => {
  const band = bands.find(([max]) => spacing <= max)
  return band ? band[1] : bands[bands.length - 1][1]
}

const pick = (table, n) => table[Math.min(n, Math.max(...Object.keys(table).map(Number)))] ?? null

// Russian Decree 2200 Appendix 3: [maxSpacing, singleWheel, dualWheel]
const ruBands = (rows) => ({
  single: (spacing) => byBand(rows.map(([max, s]) => [max, s]))(spacing),
  dual: (spacing) => byBand(rows.map(([max, , d]) => [max, d]))(spacing)
})

function russia(roadClass) {
  const is115 = roadClass === 11.5
  const tandem = ruBands(is115
    ? [[1.0, 11.5, 12.5], [1.3, 14, 16], [1.8, 17, 18], [2.5, 18, 20]]
    : [[1.0, 10, 11], [1.3, 13, 14], [1.8, 15, 16], [2.5, 17, 18]])
  const tridem = ruBands(is115
    ? [[1.0, 17, 18], [1.3, 20, 21], [1.8, 23.5, 24], [2.5, 25, 26]]
    : [[1.0, 15, 16.5], [1.3, 18, 19.5], [1.8, 21, 22.5], [2.5, 22, 23]])
  // Groups with >3 axles: per-axle values; last table row is for axles with 4+ wheels.
  const over3 = ruBands(is115
    ? [[1.0, 5.5, 6], [1.3, 6.5, 7], [1.8, 7.5, 8], [2.5, 8.5, 9]]
    : [[1.0, 5, 5.5], [1.3, 6, 6.5], [1.8, 6.5, 7], [2.5, 7, 7.5]])
  const over3FourWheel = byBand(is115
    ? [[1.0, 11], [1.3, 12], [1.8, 14], [2.5, 16]]
    : [[1.0, 9.5], [1.3, 10.5], [1.8, 12], [2.5, 13.5]])
  const tyreKey = (tyre) => (tyre === "wide" ? "single" : "dual")
  return {
    id: is115 ? "RU115" : "RU10",
    basis: "official",
    name: `Russia — ${is115 ? "11.5" : "10"} t/axle roads (PP No. 2200)`,
    source: "Government Decree No. 2200 of 21.12.2020, Appendices 1–3",
    verified: true,
    notes: ["Values in brackets of Appendix 3 (dual wheels) used for dual tyres; spring thaw restrictions not modelled."],
    steer: is115 ? 10.5 : 9,
    driveSingle: is115 ? 11.5 : 10,
    driveTandem: () => tandem.dual(1.35),
    trailerGroup(n, spacing, tyre) {
      if (n === 1) return is115 ? (tyre === "wide" ? 10.5 : 11.5) : (tyre === "wide" ? 9 : 10)
      if (n === 2) return tandem[tyreKey(tyre)](spacing)
      if (n === 3) return tridem[tyreKey(tyre)](spacing)
      const perAxle = tyre === "line" ? over3FourWheel(spacing) : over3[tyreKey(tyre)](spacing)
      return +(perAxle * n).toFixed(1)
    },
    gcw: ({ totalAxles }) => pick({ 3: 28, 4: 36, 5: 40, 6: 44 }, totalAxles),
    maxCombinationLength: 20,
    maxWidth: 2.55,
    maxHeight: 4.0
  }
}

/**
 * EAC bulk-liquid tank limits for semi-trailer combinations, keyed "<prime-mover axles>+<trailer axles>".
 * tankM3: Part A max tank capacity (reg. 6(1)), valid only up to maxTareT combined tare.
 * products: Part B max loaded volume per product (reg. 6(2)–(3)), columns (vi)–(ix).
 */
const EAC_LIQUID_TANK = {
  source: "EAC Vehicle Load (Vehicle Dimensions and Axle Configurations) Regulations 2018, reg. 6 & Second Schedule",
  productLabels: {
    "regular-petrol": "Regular petrol",
    "super-petrol": "Super petrol",
    kerosene: "Kerosene",
    aviation: "Aviation fuel",
    "power-alcohol": "Power alcohol",
    diesel: "Diesel",
    "industrial-diesel": "Industrial diesel"
  },
  combos: {
    "3+3": { tankM3: 35, maxTareT: 18, products: { "regular-petrol": 35, "super-petrol": 35, kerosene: 34, aviation: 34, "power-alcohol": 34, diesel: 31, "industrial-diesel": 30 } },
    "2+3": { tankM3: 28, maxTareT: 17, products: { "regular-petrol": 28, "super-petrol": 28, kerosene: 27, aviation: 27, "power-alcohol": 27, diesel: 25, "industrial-diesel": 24 } },
    "3+2": { tankM3: 24, maxTareT: 17, products: { "regular-petrol": 24, "super-petrol": 24, kerosene: 23, aviation: 23, "power-alcohol": 23, diesel: 22, "industrial-diesel": 21 } },
    "2+2": { tankM3: 19, maxTareT: 15, products: { "regular-petrol": 19, "super-petrol": 18, kerosene: 18, aviation: 18, "power-alcohol": 18, diesel: 17, "industrial-diesel": 16 } }
  }
}

function eacCorridor({ id, name, source, extraNotes = [] }) {
  return {
    id,
    basis: "secondary",
    name,
    source,
    verified: true,
    notes: [
      "5% enforcement tolerance on axle limits is not applied here.",
      "Axle groups are limited to 3 axles; vehicles to 7 axles and 56 t.",
      "Bulk-liquid tankers: tank capacity and loaded volume per product are capped by the 2018 Vehicle Dimensions Regulations, Second Schedule.",
      ...extraNotes
    ],
    steer: 8,
    driveSingle: 10,
    driveTandem: () => 18,
    trailerGroup(n, spacing, tyre) {
      const isWide = tyre === "wide"
      if (n === 1) return isWide ? 8.5 : 10
      if (n === 2) return isWide ? 16 : 18
      if (n === 3) return isWide ? 22.5 : 24
      return null
    },
    gcw: ({ totalAxles }) => (totalAxles <= 7 ? 56 : null),
    maxCombinationLength: 17.4,
    maxWidth: 2.65,
    maxHeight: 4.3,
    liquidTank: EAC_LIQUID_TANK
  }
}

const ECOWAS_NOTES = [
  "Checked: ECOWAS Supplementary Act A/SP.17/02/12 Art. 4 caps a single load-carrying axle at 11.5 t.",
  "Not checked: the tandem / tridem limits (Annex 2) and GCW caps below come from secondary sources — the official annex could not be retrieved; confirm with the national road agency.",
  "UEMOA Regulation 14/2005/CM Art. 7 requires an exceptional-transport authorisation above 51 t."
]

function ecowasMember({ id, name, source, notes, tandemBands, tridemBands, driveTandem = 18, maxHeight = 4.0 }) {
  const tandem = byBand(tandemBands)
  const tridem = byBand(tridemBands)
  return {
    id,
    basis: "unverified",
    name,
    source,
    verified: false,
    notes: [...ECOWAS_NOTES, ...notes],
    steer: 10,
    driveSingle: 11.5,
    driveTandem: () => driveTandem,
    trailerGroup(n, spacing) {
      if (n === 1) return 11.5
      if (n === 2) return tandem(spacing)
      if (n === 3) return tridem(spacing)
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 26, 4: 38, 5: 46, 6: 51 }, totalAxles),
    maxCombinationLength: 16.5,
    maxWidth: 2.55,
    maxHeight
  }
}

export const REGIONS = {
  CN: {
    id: "CN",
    basis: "official",
    name: "China — GB 1589-2016",
    source: "GB 1589-2016 Tables 1–4, §4.1.3.2, §4.5, §4.6.1, §4.7.1",
    verified: true,
    notes: [
      "Single non-driving axle may carry 11.5 t with air suspension (Table 3 note b).",
      "Single-tyre axles: 7 t, or 10 t with tyres ≥425 mm section width (Table 3 note a).",
      "Groups with more than 3 axles are not tabulated — operate under an oversize/overweight permit."
    ],
    steer: 7,
    driveSingle: 11.5,
    driveTandem: (isAir) => (isAir ? 19 : 18),
    trailerGroup(n, spacing, tyre, { isAir = false, tyreWidthMm = 0 } = {}) {
      if (n === 1) {
        if (tyre === "wide") return tyreWidthMm >= 425 ? 10 : 7
        return isAir ? 11.5 : 10
      }
      if (n === 2) return byBand([[0.999, 11], [1.299, 16], [Infinity, 18]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    trailerGvw: ({ model, trailerAxles }) => (model === "hydraulic-modular-trailer" ? null : pick({ 1: 18, 2: 35, 3: 40 }, trailerAxles)),
    gcw: ({ totalAxles }) => pick({ 3: 27, 4: 36, 5: 43, 6: 49 }, totalAxles),
    minDriveShare: 0.25,
    maxCombinationLength: ({ is45Container } = {}) => (is45Container ? 18.1 : 17.1),
    trailerLength: ({ model, trailerAxles, is45Container } = {}) =>
      model.includes("tipper") ? pick({ 1: 8.6, 2: 10, 3: 13 }, trailerAxles) : (is45Container ? 13.95 : 13.75),
    maxKingpinToRear: 12,
    maxRearOverhang: 3.5,
    rearOverhangRatio: 0.55,
    maxWidth: 2.55,
    maxWidthLowbed: 3.0,
    maxHeight: ({ isContainer } = {}) => (isContainer ? 4.2 : 4.0)
  },
  EU: {
    id: "EU",
    basis: "official",
    name: "European Union — Directive 96/53/EC",
    source: "Council Directive 96/53/EC Annex I (consolidated 2019)",
    verified: true,
    notes: [
      "Tri-axle limits are tabulated only up to 1.4 m spacing; 24 t is applied above that.",
      "44 t intermodal exemption applies to 5+ axle combinations carrying 40ft/45ft ISO containers (Annex I §2.2.2(c))."
    ],
    steer: 10,
    driveSingle: 11.5,
    driveTandem: (isAir) => (isAir ? 19 : 18),
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[0.999, 11], [1.299, 16], [1.799, 18], [Infinity, 20]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    gcw: ({ totalAxles, is40PlusContainer } = {}) => (totalAxles >= 5 ? (is40PlusContainer ? 44 : 40) : 36),
    maxCombinationLength: ({ is45Container } = {}) => (is45Container ? 16.65 : 16.5),
    maxKingpinToRear: ({ is45Container } = {}) => (is45Container ? 12.15 : 12),
    maxWidth: 2.55,
    maxHeight: 4.0
  },
  US: {
    id: "US",
    basis: "official",
    name: "United States — Federal (Interstate)",
    source: "23 CFR 658.17 (80,000 lb GVW, 20,000 lb single, 34,000 lb tandem, Bridge Formula)",
    verified: true,
    notes: [
      "Groups of 3+ axles are limited by the Federal Bridge Formula.",
      "States may grant higher grandfathered weights or permits for non-divisible loads."
    ],
    steer: 9.07,
    driveSingle: 9.07,
    driveTandem: () => 15.42,
    trailerGroup(n, spacing) {
      if (n === 1) return 9.07
      if (n === 2 && spacing >= 1.02 && spacing <= 2.44) return 15.42
      return Math.min(bridgeFormulaTonnes((n - 1) * spacing, n), 9.07 * n)
    },
    gcw: ({ totalAxles, outerSpanM }) => Math.min(36.29, bridgeFormulaTonnes(outerSpanM, totalAxles) ?? Infinity),
    maxWidth: 2.6,
    maxHeight: null
  },
  ZA: {
    id: "ZA",
    basis: "official",
    name: "South Africa — NRTR Reg. 240",
    source: "National Road Traffic Regulations 2000, Reg. 240 (axle massloads)",
    verified: true,
    notes: [
      "56 t combination ceiling per the permissible maximum combination mass rules.",
      "Reg. 240 tabulates axle units of up to three axles; larger groups need an abnormal-load permit.",
      "Tri-axle limit applied as 24 t for every tyre layout — a single-tyre derating is not modelled."
    ],
    steer: 7.7,
    driveSingle: 9,
    driveTandem: () => 18,
    trailerGroup(n, spacing, tyre) {
      const isDual = tyre !== "wide"
      if (n === 1) return isDual ? 9 : 8
      if (n === 2) return isDual ? 18 : 16
      if (n === 3) return 24
      return null
    },
    gcw: () => 56,
    maxWidth: 2.6,
    maxHeight: 4.3
  },
  EAC: eacCorridor({
    id: "EAC",
    name: "East Africa — EAC Vehicle Load Control Act",
    source: "EAC Vehicle Load Control Act 2016, Second Schedule (as tabulated by the Shippers Council of Eastern Africa) & EAC Vehicle Load (Vehicle Dimensions and Axle Configurations) Regulations 2018"
  }),
  TZ: eacCorridor({
    id: "TZ",
    name: "Tanzania — EAC Act 2016 / TANROADS",
    source: "EAC Vehicle Load Control Act 2016 & Tanzania TANROADS Weighbridge Enforcement",
    extraNotes: ["Tanzania designated container / trunk corridors allow up to 4.60 m height clearance; abnormal loads require a TANROADS permit."]
  }),
  JP: {
    id: "JP",
    basis: "secondary",
    name: "Japan — Vehicle Restriction Order (車両制限令)",
    source: "Road Act & Vehicle Restriction Order (道路法・車両制限令), MLIT Special 8 Types & Designated Routes",
    verified: true,
    notes: [
      "General roads cap at 20–25 t GVW, 12.0 m length, and 3.8 m height; 16.5 m semi-trailer length & up to 36 t (Tokurei 5 Types, by outer axle span) apply on expressways / 重さ指定道路.",
      "44 t exemption applies to 40ft/45ft ISO maritime container combinations on designated 重さ指定 / 重要物流道路 routes.",
      "Height: 4.1 m for any vehicle on 高さ指定道路 (designated-height roads, Vehicle Restriction Order as amended 2004) is applied here; other roads allow only 3.8 m.",
      "Tandem (1.3–1.8 m spacing) is 19 t when each axle ≤ 9.5 t (18 t <1.3 m, 20 t ≥1.8 m)."
    ],
    steer: 10,
    driveSingle: 10,
    driveTandem: () => 19,
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[1.299, 18], [1.799, 19], [Infinity, 20]])(spacing)
      if (n === 3) return 24
      return null
    },
    gcw: ({ totalAxles, outerSpanM = 0, is40PlusContainer = false } = {}) => {
      if (is40PlusContainer && totalAxles >= 5) return 44
      if (totalAxles <= 3) return 25
      if (outerSpanM >= 15.5) return 36
      if (outerSpanM >= 13.5) return 34
      if (outerSpanM >= 11.5) return 31
      return 28
    },
    maxCombinationLength: 16.5,
    maxWidth: 2.5,
    maxHeight: 4.1
  },
  AU: {
    id: "AU",
    basis: "official",
    name: "Australia — NHVR HVNL (GML / HML)",
    source: "NHVR Heavy Vehicle National Law (HVNL) — General Mass Limits (GML) & Higher Mass Limits (HML)",
    verified: true,
    notes: [
      "General Mass Limits (GML): 6.0 t steer (6.5 t ADR 80/01 complying), 9.0 t single, 16.5 t tandem drive, 20.0 t tri-axle, 42.5 t 6-axle combination.",
      "Higher Mass Limits (HML: 17.0 t tandem, 22.5 t tri-axle, 45.5 t 6-axle) are NOT applied: they need Road-Friendly Suspension certification, NHVAS mass-management accreditation and an approved HML route, not just air suspension.",
      "Standard width limit 2.50 m (2.55 m for ADR Safer Freight Vehicles); standard semi-trailer length 19.0 m, height 4.30 m."
    ],
    steer: 6,
    driveSingle: 9,
    driveTandem: () => 16.5,
    trailerGroup(n) {
      if (n === 1) return 9
      if (n === 2) return 16.5
      if (n === 3) return 20
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 24, 4: 31.5, 5: 39, 6: 42.5 }, totalAxles),
    maxCombinationLength: 19.0,
    maxWidth: 2.5,
    maxHeight: 4.3
  },
  TW: {
    id: "TW",
    basis: "secondary",
    name: "Taiwan — Road Traffic Safety Rules Art. 38",
    source: "道路交通安全規則 第38條・第79條 & 附件十一 (MOTC Road Traffic Safety Rules)",
    verified: true,
    notes: [
      "Base semi-trailer GCW limit is 35 t; type-approved multi-axle combinations (附件十一) qualify up to 43 t.",
      "Type-approved axle caps: 10 t single (11.5 t drive axle), 17.5 t tandem (14.5 t non-approved), 22 t tridem; retracted/lifted axles void the 43 t allowance.",
      "Art. 38 caps unladen vehicle height at 3.80 m; Art. 79 allows 4.00 m loaded height (>4.20 m expressway permit under Art. 80)."
    ],
    steer: 10,
    driveSingle: 11.5,
    driveTandem: () => 17.5,
    trailerGroup(n) {
      return n <= 3 ? { 1: 10, 2: 17.5, 3: 22 }[n] : null
    },
    gcw: ({ totalAxles }) => (totalAxles >= 5 ? 43 : totalAxles >= 4 ? 35 : 25),
    maxCombinationLength: 18.0,
    maxWidth: 2.5,
    maxHeight: 4.0
  },
  VN: {
    id: "VN",
    basis: "secondary",
    name: "Vietnam — Circular 39/2024/TT-BGTVT",
    source: "Circular No. 39/2024/TT-BGTVT Art. 15 (superseding Circular 46/2015/TT-BGTVT, eff. 2025)",
    verified: true,
    notes: [
      "5–6+ axle combination GCW caps at 44 t (4.5–6.5 m kingpin-to-first-trailer-axle span) or 48 t (>6.5 m span); the lower cap for spans under 4.5 m is not modelled — 44 t is applied.",
      "Loads exceeding 48 t GCW require an overweight/oversize transport permit.",
      "Standard loaded height limit is 4.20 m; ISO container semi-trailers receive a 4.35 m height allowance."
    ],
    steer: 10,
    driveSingle: 10,
    driveTandem: () => 18,
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[0.999, 11], [1.299, 16], [Infinity, 18]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    gcw: ({ totalAxles, kingpinToFirstAxleM = 0 } = {}) => {
      if (totalAxles <= 3) return 26
      if (totalAxles === 4) return 34
      return kingpinToFirstAxleM > 6.5 ? 48 : 44
    },
    maxCombinationLength: 20.0,
    maxWidth: 2.5,
    maxHeight: ({ isContainer } = {}) => (isContainer ? 4.35 : 4.2)
  },
  ID: {
    id: "ID",
    basis: "secondary",
    name: "Indonesia — PP 55/2012 & Zero ODOL (MST 10 t)",
    source: "PP No. 55/2012 (Vehicles), UU No. 22/2009 & Zero ODOL UPPKB Class I/II (MST 10 t)",
    verified: true,
    notes: [
      "Modelled on Class I/II arterial roads (MST 10 t single dual-wheel axle; Class III roads drop to MST 8 t).",
      "JBI / JBKI gross limits: 40 t typical 5-axle, up to 48 t for 6-axle combinations subject to chassis JBB approval.",
      "Strict Zero ODOL enforcement at UPPKB weighbridges: width ≤ 2.50 m, height ≤ 4.20 m, overall length ≤ 18.0 m."
    ],
    steer: 10,
    driveSingle: 10,
    driveTandem: () => 18,
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[1.299, 16], [Infinity, 18]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 26, 4: 34, 5: 40, 6: 48 }, totalAxles),
    maxCombinationLength: 18.0,
    maxWidth: 2.5,
    maxHeight: 4.2
  },
  NG: ecowasMember({
    id: "NG",
    name: "Nigeria — Federal Highways & ECOWAS Act",
    source: "ECOWAS Supplementary Act A/SP.17/02/12 & Nigeria National Road Traffic Regulations 2012 (Schedule 15, Form MVA 29)",
    notes: [
      "Nigeria's own NRTR 2012 Schedule 15 is older and stricter: tandem 18.5–20 t by spacing, articulated vehicles up to 32 t, loaded height 3.353 m, width 2.8 m — the ECOWAS corridor values are applied here.",
      "5% weighbridge margin not pre-deducted."
    ],
    tandemBands: [[1.299, 16], [Infinity, 18]],
    tridemBands: [[1.3, 21], [Infinity, 24]],
    driveTandem: 18,
    maxHeight: 4.0
  }),
  GN: ecowasMember({
    id: "GN",
    name: "Guinea — Code de la Route & ECOWAS Act",
    source: "Guinea Code de la Route & ECOWAS Supplementary Act A/SP.17/02/12 / A/SA.3/07/22",
    notes: [
      "Conakry transit corridors enforce 11.5 t single drive axle, 18 t tandem, 24 t tridem, and 51 t 6-axle GCW cap.",
      "5% weighbridge transit tolerance not applied here; mining / bauxite corridor indivisible loads require special route permits."
    ],
    tandemBands: [[1.299, 16], [Infinity, 18]],
    tridemBands: [[1.3, 21], [Infinity, 24]],
    driveTandem: 18,
    maxHeight: 4.0
  }),
  GH: ecowasMember({
    id: "GH",
    name: "Ghana — Road Traffic Regs L.I. 2180 / ECOWAS",
    source: "Ghana Road Traffic Regulations, 2012 (L.I. 2180) & GHA / ECOWAS Axle Load Control",
    notes: [
      "GHA / ECOWAS transit enforcement applies 51 t GCW ceiling for 6-axle trucks (legacy L.I. 2180 domestic allowance up to 60 t).",
      "Height limit 4.50 m, width 2.55 m (2.60 m reefer), articulated length 16.5 m under GHA corridor enforcement."
    ],
    tandemBands: [[1.299, 16], [Infinity, 18]],
    tridemBands: [[1.3, 21], [Infinity, 24]],
    driveTandem: 18,
    maxHeight: 4.5
  }),
  RU10: russia(10),
  RU115: russia(11.5),
  AE: {
    id: "AE",
    basis: "not-in-force",
    name: "UAE — Cabinet Resolution 138/2023",
    source: "Cabinet Resolution No. 138 of 2023, Tables 1–2 (implementation postponed by the Cabinet)",
    verified: true,
    notes: ["Implementation was postponed; confirm current enforcement status with MoEI before quoting."],
    steer: 8,
    driveSingle: 13,
    driveTandem: () => 26,
    trailerGroup(n) {
      return n <= 3 ? { 1: 13, 2: 26, 3: 33 }[n] : null
    },
    gcw: ({ totalAxles }) => pick({ 2: 21, 3: 34, 4: 45, 5: 56, 6: 65 }, totalAxles),
    maxWidth: null,
    maxHeight: null
  },
  SA: {
    id: "SA",
    basis: "unverified",
    name: "Saudi Arabia — RGA Highway Code",
    source: "Roads General Authority statement, Sept 2024 (gross weight by axle count, dimensions)",
    verified: false,
    notes: [
      "No official axle/axle-group table could be verified; only gross weight and dimensions are checked.",
      "RGA publishes up to 5 axles (45 t); the same cap is applied to 6+ axles."
    ],
    steer: null,
    driveSingle: null,
    driveTandem: () => null,
    trailerGroup: () => null,
    gcw: ({ totalAxles }) => pick({ 2: 21, 3: 34, 4: 42, 5: 45 }, totalAxles),
    maxCombinationLength: 23,
    maxWidth: 2.6,
    maxHeight: 4.8
  },
  PE: {
    id: "PE",
    basis: "secondary",
    name: "Peru — D.S. 058-2003-MTC (RNV)",
    source: "Decreto Supremo N° 058-2003-MTC, Anexo IV (Pesos y Medidas, mod. D.S. 007-2019-MTC)",
    verified: true,
    notes: [
      "48 t base PBV cap; +5% bonificación (50.4 t) with air suspension, or +10% (52.8 t) with air + super-single tyres (requires Provías Nacional certificate).",
      "Air suspension grants +10% on trailer axle-group limits; ≥385 mm super-single tyres qualify for dual-wheel group limits.",
      "4.10 m base height limit (4.30 m exemption for container / car-carrier bodies under Anexo IV)."
    ],
    steer: 7,
    driveSingle: 11,
    driveTandem: () => 18,
    trailerGroup(n, spacing, tyre, { isAir = false, tyreWidthMm = 0 } = {}) {
      const isDualOrSuper = tyre !== "wide" || tyreWidthMm >= 385
      const base = n === 1 ? (isDualOrSuper ? 11 : 7) : n === 2 ? (isDualOrSuper ? 18 : 12) : n === 3 ? (isDualOrSuper ? 25 : 16) : null
      if (base === null) return null
      return isAir ? +(base * 1.1).toFixed(2) : base
    },
    gcw: ({ isAir, isWide, tyreWidthMm = 0 } = {}) => {
      if (isAir && isWide && tyreWidthMm >= 385) return 52.8
      if (isAir) return 50.4
      return 48
    },
    trailerLength: () => 14.68,
    maxCombinationLength: 20.5,
    maxWidth: 2.6,
    maxHeight: ({ isContainer, isCarrier } = {}) => (isContainer || isCarrier ? 4.3 : 4.1)
  },
  CL: {
    id: "CL",
    basis: "official",
    name: "Chile — D.S. 158 MOP / Res. 1 MTT",
    source: "Decreto Supremo N° 158/1980 MOP (pesos) & Resolución N° 1/1995 MTT (dimensiones)",
    verified: true,
    notes: [
      "45 t PBT ceiling; 4-axle combinations scale 39/42/45 t by outer axle span (<13 m / 13–15 m / >15 m).",
      "Dedicated car-carrier exemption (Res. 1/1995 MTT): up to 22.40 m combination length and 4.30 m height on authorized corridors.",
      "Steer axle 7 t base (8 t permitted with ≥315 mm tyres under D.S. 181 MOP)."
    ],
    steer: 7,
    driveSingle: 11,
    driveTandem: () => 18,
    trailerGroup(n, spacing, tyre) {
      const isWide = tyre === "wide"
      if (n === 1) return isWide ? 7 : 11
      if (n === 2) return isWide ? 14 : 18
      if (n === 3) return isWide ? 19 : 25
      return null
    },
    gcw: ({ totalAxles, outerSpanM }) => {
      if (totalAxles <= 3) return 29
      if (totalAxles === 4) return outerSpanM < 13 ? 39 : outerSpanM <= 15 ? 42 : 45
      return 45
    },
    trailerLength: ({ isCarrier } = {}) => (isCarrier ? null : 14.4),
    maxCombinationLength: ({ isCarrier } = {}) => (isCarrier ? 22.4 : 18.6),
    maxWidth: 2.6,
    maxHeight: ({ isCarrier } = {}) => (isCarrier ? 4.3 : 4.2)
  },
  MX: {
    id: "MX",
    basis: "official",
    name: "Mexico — NOM-012-SCT-2-2017 (ET / A)",
    source: "NOM-012-SCT-2-2017, Tables 6.1.2.1 & 6.2.1 (ET / A Highway Network, T3-S2 / T3-S3)",
    verified: true,
    notes: [
      "Modelled on ET / A federal trunk highways (T3-S2 5-axle 44.0 t, T3-S3 6-axle 48.5 t; B/C roads drop to 38–42 t).",
      "Air suspension + low-profile/ABS equipment qualifies for +1.5 t to +5.5 t NOM-012 bonus on designated ET corridors (not auto-applied here).",
      "Double articulated combinations (Full / T3-S2-R4 up to 66.5–75.5 t) are outside single semi-trailer scope."
    ],
    steer: 6.5,
    driveSingle: 11,
    driveTandem: () => 19.5,
    trailerGroup(n) {
      if (n === 1) return 10
      if (n === 2) return 18
      if (n === 3) return 23.5
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 27.5, 4: 35.5, 5: 44, 6: 48.5 }, totalAxles),
    maxCombinationLength: 20.8,
    maxWidth: 2.6,
    maxHeight: 4.25
  },
  BR: {
    id: "BR",
    basis: "official",
    name: "Brazil — CONTRAN Resolution 882/2021",
    source: "CONTRAN Resolução nº 882/2021 (Pesos e Dimensões, PBTC & Eixos)",
    verified: true,
    notes: [
      "Standard articulated semi-trailer PBTC: 41.5 t (5 axles) and 48.5 t (6 axles, 3+3); 53 t applies to 4-axle spaced trailers, 57 t to Bitrem and 74 t to Rodotrem (AET).",
      "Dual-tyre axle limits: 10 t single, 17 t tandem (1.20–2.40 m), 25.5 t tridem (1.20–2.40 m); 5% PBTC / 12.5% axle enforcement tolerance not pre-applied."
    ],
    steer: 6,
    driveSingle: 10,
    driveTandem: () => 17,
    trailerGroup(n, spacing, tyre) {
      const isWide = tyre === "wide"
      if (n === 1) return isWide ? 6 : 10
      if (n === 2) return spacing > 2.4 ? 20 : 17
      if (n === 3) return 25.5
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 26, 4: 33, 5: 41.5, 6: 48.5 }, totalAxles),
    maxCombinationLength: 18.6,
    maxWidth: 2.6,
    maxHeight: 4.4
  },
  CO: {
    id: "CO",
    basis: "official",
    name: "Colombia — Resolución 4100/2004 (MINTRA)",
    source: "Ministerio de Transporte Resolución 4100 de 2004 (mod. Res. 2888/2005), Tablas 1–3",
    verified: true,
    notes: [
      "Classic articulated classes: 2S1 (27 t), 2S2 (32 t), 3S2 (48 t), 3S3 (52 t PBV).",
      "2.5% weighbridge positive tolerance (Res. 2888/2005) is not pre-deducted here."
    ],
    steer: 6,
    driveSingle: 11,
    driveTandem: () => 22,
    trailerGroup(n) {
      if (n === 1) return 11
      if (n === 2) return 22
      if (n === 3) return 24
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 27, 4: 32, 5: 48, 6: 52 }, totalAxles),
    maxCombinationLength: 18.5,
    maxWidth: 2.6,
    maxHeight: 4.4
  },
  KZ: {
    id: "KZ",
    basis: "secondary",
    name: "Kazakhstan — Order No. 342 / EAEU TR CU 018",
    source: "Ministry of Investment & Development Order No. 342 (2015) & EAEU TR CU 018/2011",
    verified: true,
    notes: [
      "Standard republican highways cap single axles at 10 t, tandem 16–18 t, tridem 21–24 t, and GCW at 40 t (5-axle) / 44 t (6-axle / ISO container transit).",
      "Spring thaw axle-load reductions (typically 8 t/axle in March–May by region) are not modelled."
    ],
    steer: 10,
    driveSingle: 10,
    driveTandem: () => 18,
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[1.0, 11], [1.3, 14], [1.8, 16], [Infinity, 18]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 28, 4: 36, 5: 40, 6: 44 }, totalAxles),
    maxCombinationLength: 20.0,
    maxWidth: 2.55,
    maxHeight: 4.0
  },
  PH: {
    id: "PH",
    basis: "official",
    name: "Philippines — RA 8794 Anti-Overloading Act",
    source: "Republic Act No. 8794 & DPWH / LTO Revised IRR (Truck/Trailer Codes 12-1, 12-2, 12-3)",
    verified: true,
    notes: [
      "DPWH enforces a 13.5 t single-axle cap alongside strict code-based Maximum Allowable GVW (12-1: 35.2 t, 12-2 5-axle: 41.5 t, 12-3 6-axle: 42.0 t).",
      "Overweight / oversize indivisible machinery requires a DPWH Special Permit."
    ],
    steer: 6,
    driveSingle: 13.5,
    driveTandem: () => 22,
    trailerGroup(n) {
      if (n === 1) return 13.5
      if (n === 2) return 22
      if (n === 3) return 27
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 29.7, 4: 35.2, 5: 41.5, 6: 42 }, totalAxles),
    maxCombinationLength: 18.0,
    maxWidth: 2.5,
    maxHeight: ({ isContainer } = {}) => (isContainer ? 4.2 : 4.0)
  },
  TH: {
    id: "TH",
    basis: "secondary",
    name: "Thailand — Dept. of Highways (50.5 t / 6-Axle)",
    source: "Department of Highways (DOH) Announcement on Semi-Trailer Axle & Gross Weight Limits",
    verified: true,
    notes: [
      "Standard 6-axle (22-wheel) semi-trailer cap is 50.5 t (5-axle 45 t, 4-axle 35 t); steer axle capped at 5.5 t.",
      "Standard articulated length 16.0 m (designated container / port corridors allow up to 18.0 m length and 4.2 m height)."
    ],
    steer: 5.5,
    driveSingle: 11,
    driveTandem: () => 20,
    trailerGroup(n) {
      if (n === 1) return 11
      if (n === 2) return 20
      if (n === 3) return 25.5
      return null
    },
    gcw: ({ totalAxles }) => pick({ 3: 25, 4: 35, 5: 45, 6: 50.5 }, totalAxles),
    maxCombinationLength: ({ isContainer } = {}) => (isContainer ? 18.0 : 16.0),
    maxWidth: 2.55,
    maxHeight: ({ isContainer } = {}) => (isContainer ? 4.2 : 4.0)
  },
  SADC: {
    id: "SADC",
    basis: "secondary",
    name: "Southern Africa — SADC Corridor (ZM / ZW / MZ)",
    source: "SADC Protocol on Transport, Communications & Meteorology (Zambia / Zimbabwe / Mozambique Copperbelt Corridors)",
    verified: true,
    notes: [
      "56 t maximum combination mass across up to 7 axles (7.7 t steer, 9 t single dual, 18 t tandem, 24 t tridem).",
      "Copperbelt & Beira/Walvis Bay corridors enforce bridge-formula checks and abnormal-load permits for mining machinery & acid/fuel tankers."
    ],
    steer: 7.7,
    driveSingle: 9,
    driveTandem: () => 18,
    trailerGroup(n, spacing, tyre) {
      const isWide = tyre === "wide"
      if (n === 1) return isWide ? 8 : 9
      if (n === 2) return isWide ? 16 : 18
      if (n === 3) return 24
      return null
    },
    gcw: ({ totalAxles }) => (totalAxles <= 7 ? 56 : null),
    maxCombinationLength: 18.5,
    maxWidth: 2.6,
    maxHeight: 4.3
  },
  UK: {
    id: "UK",
    basis: "official",
    name: "United Kingdom — C&U Regulations (44 t)",
    source: "Road Vehicles (Construction and Use) Regulations 1986 & Authorised Weight Regulations 1998",
    verified: true,
    notes: [
      "6-axle articulated combinations qualify for 44 t general haulage (not restricted to intermodal) with road-friendly suspension and ≤ 10.5 t drive axle.",
      "No statutory vehicle height cap in Great Britain, though bridges below 5.03 m (16'6\") are signed and motorway clearance is typically 4.95 m."
    ],
    steer: 10,
    driveSingle: 11.5,
    driveTandem: (isAir) => (isAir ? 19 : 18),
    trailerGroup(n, spacing) {
      if (n === 1) return 10
      if (n === 2) return byBand([[0.999, 11], [1.299, 16], [1.799, 18], [Infinity, 20]])(spacing)
      if (n === 3) return byBand([[1.3, 21], [Infinity, 24]])(spacing)
      return null
    },
    gcw: ({ totalAxles }) => (totalAxles >= 6 ? 44 : totalAxles === 5 ? 40 : 36),
    maxCombinationLength: 16.5,
    maxKingpinToRear: 12.0,
    maxWidth: 2.55,
    maxHeight: null
  }
}

export const REGION_ORDER = [
  "CN", "EU", "UK", "US", "JP", "AU", "TW", "VN", "ID", "PH", "TH",
  "MX", "BR", "CO", "PE", "CL",
  "TZ", "EAC", "SADC", "ZA", "NG", "GN", "GH",
  "KZ", "RU10", "RU115", "AE", "SA"
]

/**
 * Standard semi-trailer engineering design dimension boundaries (ISO 1726, UN ECE R58/R73,
 * GB 11567, ADR 6.8.2.1.28 / EN 13094, and heavy-haul loading ramp geometry).
 */
export const DESIGN_STANDARDS = {
  iso1726: {
    maxFrontSwingRadiusM: 2.04,       // ISO 1726-1: kingpin to front corners ≤ 2,040 mm
    minLandingGearClearanceM: 2.30,   // ISO 1726-1: kingpin to landing gear/drop ≥ 2,300 mm
    standardFifthWheelMm: [1150, 1300], // ISO 1726-1 laden standard tractor
    lowCouplingFifthWheelMm: [900, 975] // ISO 1726-2 laden low-coupling mega tractor
  },
  rupd: {
    maxGroundClearanceMm: 550,        // UN ECE R58 / GB 11567 unladen lower edge ≤ 550 mm
    maxRearSetbackMm: 450,            // UN ECE R58: within 450 mm of rear extremity
    minRearOverhangM: 0.70,           // Practical mounting space behind rear tyres
    maxRecommendedOverhangM: 2.20     // Tail-swing & departure angle (<14° at 550 mm bar)
  },
  lowboyRamp: {
    optimalMaxDeg: 12,                // Optimal low-stress excavator loading angle
    safeMaxDeg: 15,                   // Standard safe max for tracked excavators
    cautionMaxDeg: 18,                // High-centering caution threshold
    stdHydraulicRampLengthM: 2.8      // Typical double-fold hydraulic rear ramp length
  },
  tankerCoaming: {
    typicalHeightM: 0.15              // ADR 6.8.2.1.28 / EN 13094 top rollover coaming allowance
  }
}
