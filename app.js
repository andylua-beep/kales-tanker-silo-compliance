// Studio controller: binds form state -> evaluate() -> CAD SVG + checks + presets.
import { evaluate } from "./lib/engine.js"
import { REGIONS, REGION_ORDER } from "./lib/regulations.js"
import { MODELS, MODEL_ORDER, SUSPENSIONS, TRACTORS, MEDIA, TANK_SHAPES, HEIGHT_PRESETS, TANKER_HEIGHT_RULES, tyresFor } from "./lib/equipment.js"
import { renderCad } from "./lib/render-svg.js"
import { renderResults } from "./lib/ui-results.js"
import { loadPresets, savePreset, deletePreset } from "./lib/presets.js"

const MODEL_CATALOG = {
  "fuel-tanker-trailer": {
    title: "KALES Carbon Steel Fuel Tanker Trailer (Q345B)",
    url: "https://www.kalestruck.com/product-category/trailers/fuel-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    categoryUrl: "https://www.kalestruck.com/product-category/trailers/liquid-powder-transport/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    desc: "Q345B carbon steel 30,000–55,000 L multi-compartment fuel tanker with API bottom loading & vapor recovery."
  },
  "aluminum-tanker-trailer": {
    title: "KALES 5083 Aluminum Alloy Tanker Trailer",
    url: "https://www.kalestruck.com/product-category/trailers/aluminum-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    categoryUrl: "https://www.kalestruck.com/product-category/trailers/liquid-powder-transport/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    desc: "Lightweight 5083-H111 aluminum alloy tanker maximizing legal fuel payload under China GB 1589 combination limits of 43 t (5 axles) and 49 t (6 axles)."
  },
  "stainless-steel-tanker-trailer": {
    title: "KALES 304/316L Stainless Steel Tanker Trailer",
    url: "https://www.kalestruck.com/product-category/trailers/stainless-steel-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    categoryUrl: "https://www.kalestruck.com/product-category/trailers/liquid-powder-transport/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    desc: "Food-grade mirror-polished & insulated 304/316L stainless tanker for edible oil, milk, potable water & mild chemicals."
  },
  "chemical-tanker-trailers": {
    title: "KALES Corrosion-Resistant Chemical & Acid Tanker",
    url: "https://www.kalestruck.com/product-category/trailers/chemical-tanker-trailers/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    categoryUrl: "https://www.kalestruck.com/product-category/trailers/liquid-powder-transport/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    desc: "LLDPE-lined or thick-wall 316L chemical tanker engineered for sulfuric acid, HCl and caustic soda."
  },
  "cement-tanker-trailer": {
    title: "KALES V-Type Pneumatic Bulk Cement Tanker Trailer",
    url: "https://www.kalestruck.com/product-category/trailers/cement-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    categoryUrl: "https://www.kalestruck.com/product-category/trailers/liquid-powder-transport/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
    desc: "High-fluidization V-type multi-cone dry bulk powder silo with diesel engine & 12 m³/min twin-cylinder air compressor."
  }
}

const NUMERIC_FIELDS = ["fifthWheelMm", "lengthM", "rearOverhangM", "deckMm", "axles", "spacingM", "volumeLiters", "tankWidthM", "tankHeightM", "headDepthM", "internalLossPct", "compartments", "fillPct", "compressorFlow"]
const UNITS = { fifthWheelMm: "mm", lengthM: "m", rearOverhangM: "m", deckMm: "mm", axles: "", spacingM: "m", volumeLiters: "L", tankWidthM: "m", tankHeightM: "m", headDepthM: "m", internalLossPct: "%", compartments: "", fillPct: "%", compressorFlow: "m³/min" }

const $ = (id) => document.getElementById(id)
const num = (id) => {
  const v = $(id).value.trim()
  return v === "" ? undefined : Number(v)
}

let activeModel = "aluminum-tanker-trailer"
let lastResult = null

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([id, label]) => new Option(label, id, false, id === value)))
  select.value = value ?? options[0]?.[0] ?? ""
}

function setModelButtons(selected) {
  activeModel = selected
  $("modelGroup").querySelectorAll(".chip-btn").forEach((btn) => {
    const on = btn.dataset.model === selected
    btn.setAttribute("aria-pressed", String(on))
  })
}

function applyModelDefaults(modelId) {
  const model = MODELS[modelId]
  setModelButtons(modelId)
  $("tractor").value = model.defaultTractor
  $("fifthWheelMm").value = TRACTORS[model.defaultTractor].fifthWheelMm
  fillSelect($("suspension"), model.suspensions.map((id) => [id, SUSPENSIONS[id].label]), model.suspensions[0])
  $("tyre").value = model.defaultTyre
  $("medium").value = model.defaultMedium
  $("tankShape").value = model.defaultShape
  Object.assign($("formDefaults") ?? {}, {})
  $("lengthM").value = model.length.default
  $("rearOverhangM").value = model.rearOverhang.default
  $("deckMm").value = model.deckMm.default
  $("axles").value = model.axles.default
  $("spacingM").value = SUSPENSIONS[model.suspensions[0]].spacing.default
  $("volumeLiters").value = model.volumeLiters.default
  $("tankWidthM").value = model.defaultTankWidthM ?? 2.48
  $("tankHeightM").value = ""
  if ($("heightPreset")) $("heightPreset").value = "auto"
  $("headDepthM").value = TANK_SHAPES[model.defaultShape].defaultHeadDepthM
  $("internalLossPct").value = TANK_SHAPES[model.defaultShape].defaultLossPct ?? 2.0
  $("compartments").value = model.compartments.default
  $("fillPct").value = model.fillPct.default
  $("compressorFlow").value = model.compressorFlow?.default ?? 12
}

function readRaw() {
  return {
    region: $("region").value,
    model: activeModel,
    tractor: $("tractor").value,
    fifthWheelMm: num("fifthWheelMm"),
    suspension: $("suspension").value,
    tyre: $("tyre").value,
    axles: num("axles"),
    spacingM: num("spacingM"),
    lengthM: num("lengthM"),
    rearOverhangM: num("rearOverhangM"),
    deckMm: num("deckMm"),
    medium: $("medium").value,
    tankShape: $("tankShape").value,
    tankWidthM: num("tankWidthM"),
    tankHeightM: num("tankHeightM"),
    headDepthM: num("headDepthM"),
    internalLossPct: num("internalLossPct"),
    volumeLiters: num("volumeLiters"),
    compartments: num("compartments"),
    fillPct: num("fillPct"),
    compressorFlow: num("compressorFlow")
  }
}

function syncForm(r, syncAll) {
  const { config, parts } = r
  const { model } = parts
  setModelButtons(config.model)
  fillSelect($("suspension"), model.suspensions.map((id) => [id, SUSPENSIONS[id].label]), config.suspension)
  fillSelect($("tyre"), tyresFor().map((t) => [t.id, t.label]), config.tyre)
  $("region").value = config.region
  $("tractor").value = config.tractor
  $("medium").value = config.medium
  $("tankShape").value = config.tankShape

  const isSilo = model.family === "silo"
  $("compressorField").classList.toggle("is-hidden", !isSilo)
  $("compLabel").textContent = isSilo ? "Hopper cones" : "Compartments"
  $("tankWidthM").disabled = Boolean(parts.tankShape?.isCircular)

  for (const field of NUMERIC_FIELDS) {
    const input = $(field)
    const value = config[field]
    if (syncAll || input.value === "" || (document.activeElement !== input && ["tankWidthM", "tankHeightM", "volumeLiters"].includes(field))) {
      input.value = value ?? ""
    }
    const bounds = r.bounds[field]
    if (bounds) {
      input.min = bounds.min
      input.max = bounds.max
    }
  }
}

function boundsHint(r, field) {
  const b = r.bounds[field]
  if (!b) return ""
  const unit = UNITS[field]
  const range = `${b.min}–${b.max}${unit ? ` ${unit}` : ""}`
  if (field === "fifthWheelMm") return `${range} · ${r.parts.tractor.label} std ${TRACTORS[r.config.tractor].fifthWheelMm} mm`
  if (field === "deckMm") return `${range} · min ${r.geometry.minDeckOverAxleMm} mm straight over tyres`
  if (field === "axles") return `${range} fit ${r.config.lengthM} m`
  if (field === "volumeLiters") return `${range} · ${(r.config.volumeLiters / 1000).toFixed(1)} m³ net (${r.parts.tankShape.id})`
  if (field === "tankHeightM") return `${range} · overall ${r.overallHeightM.toFixed(2)} m (min ${TANKER_HEIGHT_RULES.minOverallM} m, max ${TANKER_HEIGHT_RULES.maxOverallM} m)`
  if (field === "internalLossPct") return `${range} · baffles, stiffeners & tolerance`
  return range
}

function renderHints(r) {
  const byField = new Map(r.issues.map((i) => [i.field, i]))
  for (const field of NUMERIC_FIELDS) {
    const hint = $(`hint-${field}`)
    if (!hint) continue
    const issue = byField.get(field)
    const input = $(field)
    input.setAttribute("aria-invalid", String(Boolean(issue)))
    hint.classList.toggle("error", Boolean(issue))
    hint.textContent = issue ? `Clamped ${issue.requested} → ${issue.used} (${issue.min}–${issue.max})` : boundsHint(r, field)
  }
}

function update(syncAll = false) {
  const r = evaluate(readRaw())
  lastResult = r
  syncForm(r, syncAll)
  renderHints(r)
  $("svgStage").innerHTML = renderCad(r)
  renderResults(r, MODEL_CATALOG)
}

async function renderPresetList() {
  const listEl = $("savedPresetsList")
  const presets = await loadPresets()
  if (!presets.length) {
    listEl.replaceChildren(Object.assign(document.createElement("li"), { textContent: globalThis.chrome?.storage?.local ? "No saved specs yet." : "Saved specs are active when loaded as a Chrome extension." }))
    return
  }
  listEl.replaceChildren(...presets.map((p, idx) => {
    const li = document.createElement("li")
    const load = document.createElement("button")
    load.type = "button"
    load.className = "btn-link"
    load.textContent = "Load"
    const name = Object.assign(document.createElement("span"), { textContent: `${p.name} · ${p.config.axles ?? 3} axles · ${((p.config.volumeLiters ?? 45000) / 1000).toFixed(0)} m³` })
    load.addEventListener("click", () => {
      applyModelDefaults(Object.hasOwn(MODELS, p.config.model) ? p.config.model : "aluminum-tanker-trailer")
      for (const f of NUMERIC_FIELDS) if (p.config[f] !== undefined) $(f).value = p.config[f]
      if (p.config.region) $("region").value = p.config.region
      if (p.config.tractor) $("tractor").value = p.config.tractor
      if (p.config.medium) $("medium").value = p.config.medium
      if (p.config.tankShape) $("tankShape").value = p.config.tankShape
      update(true)
    })
    const del = document.createElement("button")
    del.type = "button"
    del.className = "btn-link danger"
    del.textContent = "Delete"
    del.setAttribute("aria-label", `Delete ${p.name}`)
    del.addEventListener("click", async () => {
      await deletePreset(idx)
      await renderPresetList()
    })
    const actions = document.createElement("span")
    actions.append(load, del)
    li.append(name, actions)
    return li
  }))
}

function init() {
  fillSelect($("region"), REGION_ORDER.map((id) => [id, REGIONS[id].name]), "CN")
  fillSelect($("tractor"), Object.entries(TRACTORS).map(([id, t]) => [id, t.label]), "4x2")
  fillSelect($("medium"), MEDIA.map((m) => [m.id, m.label]), "diesel")
  fillSelect($("tankShape"), Object.values(TANK_SHAPES).map((s) => [s.id, s.label]), "square-round")
  fillSelect($("heightPreset"), HEIGHT_PRESETS.map((p) => [p.id, p.label]), "auto")

  $("modelGroup").replaceChildren(...MODEL_ORDER.map((id) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "chip-btn"
    btn.dataset.model = id
    btn.textContent = MODELS[id].label
    btn.addEventListener("click", () => {
      applyModelDefaults(id)
      update(true)
    })
    return btn
  }))

  $("configForm").addEventListener("input", (event) => {
    const { id } = event.target
    if (id === "tractor") $("fifthWheelMm").value = TRACTORS[$("tractor").value].fifthWheelMm
    if (id === "suspension") $("spacingM").value = SUSPENSIONS[$("suspension").value].spacing.default
    if (id === "tankShape") {
      const shapeSpec = TANK_SHAPES[$("tankShape").value]
      $("headDepthM").value = shapeSpec.defaultHeadDepthM
      $("internalLossPct").value = shapeSpec.defaultLossPct ?? 2.0
    }
    if (id === "heightPreset") {
      const preset = HEIGHT_PRESETS.find((p) => p.id === $("heightPreset").value)
      if (preset && preset.targetOverallM != null) {
        const topHardwareM = MODELS[activeModel].family === "silo" ? 0.16 : 0.18
        const shellH = +(preset.targetOverallM - (num("deckMm") ?? 1120) / 1000 - topHardwareM).toFixed(2)
        $("tankHeightM").value = shellH
        $("volumeLiters").value = ""
      }
    }
    if (["volumeLiters", "tankHeightM"].includes(id)) {
      $("heightPreset").value = "auto"
    }
    if (["tankWidthM", "tankHeightM", "headDepthM", "internalLossPct"].includes(id)) {
      $("volumeLiters").value = ""
    }
    update(false)
  })
  $("configForm").addEventListener("submit", (e) => e.preventDefault())

  $("btnSavePreset").addEventListener("click", async () => {
    if (!lastResult) return
    const { parts, config } = lastResult
    await savePreset(`${parts.model.label} (${(config.volumeLiters / 1000).toFixed(0)} m³)`, config)
    await renderPresetList()
  })
  $("btnPrintSpec").addEventListener("click", () => window.print())

  applyModelDefaults(activeModel)
  update(true)
  renderPresetList()
}

init()
