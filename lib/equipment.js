// KALES tanker & dry-bulk silo equipment catalog: suspensions, tyres, tractors, media and 5 trailer models.
// All dimensions in m or mm; masses in tonnes.

export const KINGPIN_SETBACK_M = 0.9 // trailer nose ahead of the kingpin centre
export const FIFTH_WHEEL_MM = { min: 1000, max: 1400 }
export const TRACTOR_TYRE_DIA_M = 1.07
export const TRACTOR_BOGIE_HALF_SPACING_M = 0.68
export const NECK_TYRE_CLEARANCE_M = 0.08
export const LANDING_LEG = { stowedFootM: 0.35, offsetFromNeckM: 1.5 }
export const TYRES_PER_AXLE = { dual: 4, wide: 2 }
export const STD_TANK_WIDTH_M = 2.5

export const TANKER_HEIGHT_RULES = {
  minOverallM: 2.8, // Small tankers start at 2.8–3.2 m; disallow lower
  smallMaxM: 3.2,
  hazmatRangeM: [3.2, 3.5], // Dangerous-goods (flammable/corrosive) recommended height
  mediumRangeM: [3.5, 4.0], // Standard medium highway tankers
  maxOverallM: 4.2 // Large tankers can reach 4.2 m; >4.0 m not generally recommended
}

export const HEIGHT_PRESETS = [
  { id: "auto", label: "Auto from volume (2.8–4.2 m)", targetOverallM: null },
  { id: "small", label: "Small tanker (2.8–3.2 m · 3.05 m)", targetOverallM: 3.05 },
  { id: "hazmat", label: "Hazmat / DG (3.2–3.5 m · 3.35 m)", targetOverallM: 3.35 },
  { id: "medium", label: "Medium tanker (3.5–4.0 m · 3.75 m)", targetOverallM: 3.75 },
  { id: "large", label: "Large / high-cube (up to 4.2 m · 4.10 m)", targetOverallM: 4.10 }
]

export const TANK_SHAPES = {
  "square-round": {
    id: "square-round",
    label: "Square-round (0.82 × W × H × L)",
    factor: 0.82,
    isCircular: false,
    defaultHeadDepthM: 0.42,
    defaultLossPct: 2.0
  },
  elliptical: {
    id: "elliptical",
    label: "Elliptical (π·a·b·L ≈ 0.785 × W × H × L)",
    factor: Math.PI / 4,
    isCircular: false,
    defaultHeadDepthM: 0.42,
    defaultLossPct: 2.0
  },
  cylindrical: {
    id: "cylindrical",
    label: "Cylindrical (π·r²·L)",
    factor: Math.PI / 4,
    isCircular: true,
    defaultHeadDepthM: 0.48,
    defaultLossPct: 2.0
  },
  "v-silo": {
    id: "v-silo",
    label: "V-type cone silo (barrel + N cone frustums + heads)",
    factor: 0.68,
    isCircular: false,
    isSilo: true,
    defaultHeadDepthM: 0.35,
    defaultLossPct: 5.0
  }
}

export const SUSPENSIONS = {
  "air-10": {
    label: "Air suspension · 10 t/axle",
    kind: "air",
    ratingT: 10,
    stackMm: 220,
    massPerAxleT: 0.42,
    spacing: { min: 1.25, max: 1.85, default: 1.31 }
  },
  "mechanical-13": {
    label: "Leaf spring · 13 t/axle",
    kind: "mechanical",
    ratingT: 13,
    stackMm: 240,
    massPerAxleT: 0.55,
    spacing: { min: 1.25, max: 1.85, default: 1.31 }
  },
  "mechanical-16": {
    label: "Heavy leaf spring · 16 t/axle",
    kind: "mechanical",
    ratingT: 16,
    stackMm: 300,
    massPerAxleT: 0.65,
    spacing: { min: 1.3, max: 1.85, default: 1.36 }
  }
}

export const TYRES = [
  { id: "12R22.5-152", label: "12R22.5 18PR (3.55 t · Ø1084 mm)", diaMm: 1084, dualT: 3.25, singleT: 3.55, fits: ["dual"] },
  { id: "12R22.5-148", label: "12R22.5 16PR (3.15 t · Ø1084 mm)", diaMm: 1084, dualT: 2.9, singleT: 3.15, fits: ["dual"] },
  { id: "11.00R20-152", label: "11.00R20 18PR (3.55 t · Ø1082 mm)", diaMm: 1082, dualT: 3.25, singleT: 3.55, fits: ["dual"] },
  { id: "12.00R20-156", label: "12.00R20 20PR (4.00 t · Ø1122 mm)", diaMm: 1122, dualT: 3.65, singleT: 4.0, fits: ["dual"] },
  { id: "315/80R22.5-154", label: "315/80R22.5 LI 154/150 (3.75 t · Ø1076 mm)", diaMm: 1076, dualT: 3.35, singleT: 3.75, fits: ["dual"] },
  { id: "295/80R22.5-152", label: "295/80R22.5 LI 152/148 (3.55 t · Ø1044 mm)", diaMm: 1044, dualT: 3.15, singleT: 3.55, fits: ["dual"] },
  { id: "385/65R22.5-160", label: "385/65R22.5 Super Single (4.50 t · Ø1072 mm)", diaMm: 1072, dualT: 4.5, singleT: 4.5, fits: ["wide"] },
  { id: "235/75R17.5-143", label: "235/75R17.5 Low-CG (2.50 t · Ø797 mm)", diaMm: 797, dualT: 2.5, singleT: 2.725, fits: ["dual"] }
]

export const TRACTORS = {
  "4x2": {
    label: "4×2 tractor",
    tareT: 6.8,
    frontTareT: 4.5,
    wheelbaseM: 3.6,
    fifthWheelLeadM: 0.45,
    frontOverhangM: 1.4,
    driveAxles: 1,
    fifthWheelMm: 1200,
    swingRadiusM: 2.1
  },
  "6x4": {
    label: "6×4 tractor",
    tareT: 8.5,
    frontTareT: 5.0,
    wheelbaseM: 3.875,
    fifthWheelLeadM: 0.4,
    frontOverhangM: 1.45,
    driveAxles: 2,
    fifthWheelMm: 1250,
    swingRadiusM: 2.35
  },
  "6x4-heavy": {
    label: "6×4 heavy tractor",
    tareT: 9.8,
    frontTareT: 5.2,
    wheelbaseM: 4.0,
    fifthWheelLeadM: 0.4,
    frontOverhangM: 1.45,
    driveAxles: 2,
    fifthWheelMm: 1300,
    swingRadiusM: 2.45
  }
}

export const MEDIA = [
  { id: "diesel", label: "Diesel fuel (0.84 t/m³)", densityT: 0.84, kind: "liquid", minUllagePct: 5, classTag: "flammable", eacProduct: "diesel" },
  { id: "gasoline", label: "Gasoline / petrol (0.74 t/m³)", densityT: 0.74, kind: "liquid", minUllagePct: 6, classTag: "flammable", eacProduct: "regular-petrol" },
  { id: "jet-fuel", label: "Jet fuel / kerosene (0.80 t/m³)", densityT: 0.80, kind: "liquid", minUllagePct: 5, classTag: "flammable", eacProduct: "aviation" },
  { id: "edible-oil", label: "Edible / palm oil (0.92 t/m³)", densityT: 0.92, kind: "liquid", minUllagePct: 5, classTag: "food" },
  { id: "raw-milk", label: "Raw milk / potable water (1.03 t/m³)", densityT: 1.03, kind: "liquid", minUllagePct: 5, classTag: "food" },
  { id: "asphalt", label: "Hot bitumen / asphalt (0.97 t/m³)", densityT: 0.97, kind: "liquid", minUllagePct: 6, classTag: "heated" },
  { id: "caustic-soda", label: "Caustic soda NaOH 50% (1.52 t/m³)", densityT: 1.52, kind: "liquid", minUllagePct: 6, classTag: "corrosive" },
  { id: "sulfuric-acid", label: "Sulfuric acid H₂SO₄ 98% (1.84 t/m³)", densityT: 1.84, kind: "liquid", minUllagePct: 7, classTag: "corrosive" },
  { id: "cement", label: "Portland cement powder (1.25 t/m³)", densityT: 1.25, kind: "powder", minUllagePct: 2, classTag: "powder" },
  { id: "fly-ash", label: "Fly ash / lime powder (0.78 t/m³)", densityT: 0.78, kind: "powder", minUllagePct: 2, classTag: "powder" }
]

export const MODELS = {
  "fuel-tanker-trailer": {
    label: "Carbon steel fuel tanker",
    family: "liquid",
    defaultShape: "square-round",
    defaultTankWidthM: 2.28,
    shellCode: "Q345B",
    length: { min: 9.0, max: 14.5, default: 11.5 },
    deckMm: { min: 950, max: 1450, default: 1140 },
    axles: { min: 2, max: 5, default: 3 },
    rearOverhang: { min: 0.8, max: 2.0, default: 1.05 },
    minFrontClearM: 3.4,
    beamDepthMm: 260,
    suspensions: ["mechanical-13", "air-10", "mechanical-16"],
    defaultTractor: "6x4",
    defaultTyre: "12R22.5-152",
    defaultMedium: "diesel",
    tare: { baseT: 2.8, perMetreT: 0.27, cgFrac: 0.5 }, // ~7.3 t trailer with 3 axles
    volumeLiters: { min: 20000, max: 60000, default: 40000 },
    compartments: { min: 1, max: 6, default: 4 },
    fillPct: { min: 50, max: 99, default: 92 },
  },
  "aluminum-tanker-trailer": {
    label: "5083 Aluminum alloy tanker",
    family: "liquid",
    defaultShape: "square-round",
    defaultTankWidthM: 2.34,
    shellCode: "5083-H111",
    length: { min: 9.0, max: 14.5, default: 11.5 },
    deckMm: { min: 920, max: 1450, default: 1120 },
    axles: { min: 2, max: 5, default: 3 },
    rearOverhang: { min: 0.8, max: 2.0, default: 1.0 },
    minFrontClearM: 3.4,
    beamDepthMm: 240,
    suspensions: ["air-10", "mechanical-13"],
    defaultTractor: "6x4",
    defaultTyre: "12R22.5-152",
    defaultMedium: "diesel",
    tare: { baseT: 1.9, perMetreT: 0.22, cgFrac: 0.5 }, // lightweight ~5.7 t trailer
    volumeLiters: { min: 25000, max: 65000, default: 42000 },
    compartments: { min: 1, max: 6, default: 4 },
    fillPct: { min: 50, max: 99, default: 92 },
  },
  "stainless-steel-tanker-trailer": {
    label: "304/316L Stainless tanker",
    family: "liquid",
    defaultShape: "elliptical",
    defaultTankWidthM: 2.08,
    shellCode: "316L",
    length: { min: 8.5, max: 13.8, default: 10.6 },
    deckMm: { min: 950, max: 1450, default: 1140 },
    axles: { min: 2, max: 4, default: 3 },
    rearOverhang: { min: 0.8, max: 1.8, default: 1.0 },
    minFrontClearM: 3.4,
    beamDepthMm: 260,
    suspensions: ["air-10", "mechanical-13"],
    defaultTractor: "6x4",
    defaultTyre: "315/80R22.5-154",
    defaultMedium: "edible-oil",
    tare: { baseT: 3.1, perMetreT: 0.27, cgFrac: 0.5 },
    volumeLiters: { min: 18000, max: 50000, default: 35000 },
    compartments: { min: 1, max: 5, default: 3 },
    fillPct: { min: 50, max: 99, default: 93 },
  },
  "chemical-tanker-trailers": {
    label: "Chemical & acid tanker",
    family: "liquid",
    defaultShape: "cylindrical",
    defaultTankWidthM: 2.48,
    shellCode: "LLDPE / 316L",
    length: { min: 8.0, max: 13.5, default: 9.8 },
    deckMm: { min: 950, max: 1450, default: 1240 },
    axles: { min: 2, max: 4, default: 3 },
    rearOverhang: { min: 0.8, max: 1.8, default: 1.0 },
    minFrontClearM: 3.3,
    beamDepthMm: 280,
    suspensions: ["air-10", "mechanical-13", "mechanical-16"],
    defaultTractor: "6x4",
    defaultTyre: "12R22.5-152",
    defaultMedium: "caustic-soda",
    tare: { baseT: 3.5, perMetreT: 0.29, cgFrac: 0.5 },
    volumeLiters: { min: 15000, max: 42000, default: 22500 },
    compartments: { min: 1, max: 4, default: 2 },
    fillPct: { min: 50, max: 99, default: 88 },
  },
  "cement-tanker-trailer": {
    label: "V-type bulk cement silo / bulker",
    family: "silo",
    defaultShape: "v-silo",
    defaultTankWidthM: 2.38,
    shellCode: "Q345 / Wear Steel",
    length: { min: 9.0, max: 14.5, default: 12.0 },
    deckMm: { min: 950, max: 1450, default: 1100 },
    axles: { min: 2, max: 5, default: 3 },
    rearOverhang: { min: 0.8, max: 2.0, default: 0.93 },
    minFrontClearM: 3.5,
    beamDepthMm: 260,
    suspensions: ["mechanical-13", "air-10", "mechanical-16"],
    defaultTractor: "6x4",
    defaultTyre: "12R22.5-152",
    defaultMedium: "cement",
    tare: { baseT: 3.2, perMetreT: 0.28, cgFrac: 0.5 }, // includes compressor + diesel engine unit
    volumeLiters: { min: 20000, max: 68000, default: 23000 }, // 23 m³ highway-legal cement; up to 68 m³ for fly ash
    compartments: { min: 2, max: 4, default: 4 }, // hopper cones
    fillPct: { min: 60, max: 98, default: 94 },
    compressorFlow: { min: 8, max: 20, default: 12 }
  }
}

export const MODEL_ORDER = Object.keys(MODELS)

export function tyresFor() {
  return TYRES
}

export function tyreFit(tyre) {
  return tyre.fits.includes("wide") ? "wide" : "dual"
}
