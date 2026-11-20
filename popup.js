import { evaluate } from "./lib/engine.js"
import { REGIONS, REGION_ORDER } from "./lib/regulations.js"
import { MODELS, MODEL_ORDER, SUSPENSIONS, MEDIA, tyresFor } from "./lib/equipment.js"

const MODEL_URLS = {
  "fuel-tanker-trailer": "https://www.kalestruck.com/product-category/trailers/fuel-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
  "aluminum-tanker-trailer": "https://www.kalestruck.com/product-category/trailers/aluminum-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
  "stainless-steel-tanker-trailer": "https://www.kalestruck.com/product-category/trailers/stainless-steel-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
  "chemical-tanker-trailers": "https://www.kalestruck.com/product-category/trailers/chemical-tanker-trailers/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker",
  "cement-tanker-trailer": "https://www.kalestruck.com/product-category/trailers/cement-tanker-trailer/?utm_source=chrome-extension&utm_medium=referral&utm_campaign=tanker"
}

const $ = (id) => document.getElementById(id)

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([id, label]) => new Option(label, id, false, id === value)))
  select.value = value ?? options[0]?.[0] ?? ""
}

function readRaw() {
  return {
    region: $("quickRegion").value,
    model: $("quickModel").value,
    medium: $("quickMedium").value,
    suspension: $("quickSuspension").value,
    tyre: $("quickTyre").value,
    axles: Number($("quickAxles").value),
    volumeLiters: Number($("quickVol").value)
  }
}

function applyModelDefaults(modelId) {
  const model = MODELS[modelId]
  Object.assign($("quickVol"), { min: model.volumeLiters.min, max: model.volumeLiters.max, value: model.volumeLiters.default })
  $("quickAxles").value = model.axles.default
  $("quickMedium").value = model.defaultMedium
  fillSelect($("quickSuspension"), model.suspensions.map((id) => [id, SUSPENSIONS[id].label]), model.suspensions[0])
  $("quickTyre").value = model.defaultTyre
}

function render(r) {
  const { config, parts, loads } = r
  fillSelect($("quickTyre"), tyresFor().map((t) => [t.id, t.label]), config.tyre)
  const issue = r.issues.find((i) => i.field === "axles")
  $("quickAxles").setAttribute("aria-invalid", String(Boolean(issue)))
  const hint = $("quickAxlesHint")
  hint.classList.toggle("error", Boolean(issue))
  hint.textContent = issue
    ? `Only ${issue.max} fit ${config.lengthM} m — using ${issue.used}`
    : `${r.bounds.axles.min}–${r.bounds.axles.max} fit ${config.lengthM} m`

  $("quickVolVal").textContent = `${config.volumeLiters.toLocaleString()} L (${(config.volumeLiters / 1000).toFixed(0)} m³ · ${config.payloadT.toFixed(1)} t)`
  const gcw = r.checks.find((c) => c.id === "legal-gcw")
  $("qGvw").textContent = `${loads.gcwT} / ${gcw?.limit ?? "—"} t`
  const cap = Math.min(parts.suspension.ratingT, r.tyreAxleCapT)
  $("qAxle").textContent = `${loads.perAxleT} / ${cap} t`
  $("qRated").textContent = r.maxPayloadT.legal > 0 ? `${r.maxPayloadT.legal} t` : "Exceeds limits"
  $("qRated").title = r.maxPayloadT.limitedBy === "eac-volume" ? `Limited by the EAC loaded-volume cap of ${r.maxPayloadT.volumeCapM3} m³` : ""

  const worst = r.checks.find((c) => c.status === r.verdict.status && c.status !== "ok")
  const status = $("quickStatus")
  status.className = `status-pill st-${r.verdict.status}`
  status.textContent = worst ? `${r.verdict.title}: ${worst.label}${worst.limit !== null ? ` ${worst.value} > ${worst.limit} ${worst.unit}` : ""}` : `${r.verdict.title} — ${parts.region.id}`

  const link = $("quickCategoryLink")
  link.href = MODEL_URLS[config.model]
  link.textContent = `KALES ${parts.model.label} specs ↗`
}

function update() {
  render(evaluate(readRaw()))
}

function init() {
  fillSelect($("quickRegion"), REGION_ORDER.map((id) => [id, REGIONS[id].name]), "CN")
  fillSelect($("quickModel"), MODEL_ORDER.map((id) => [id, MODELS[id].label]), "aluminum-tanker-trailer")
  fillSelect($("quickMedium"), MEDIA.map((m) => [m.id, m.label]), "diesel")
  applyModelDefaults("aluminum-tanker-trailer")
  $("quickForm").addEventListener("input", (event) => {
    if (event.target.id === "quickModel") applyModelDefaults(event.target.value)
    update()
  })
  $("quickForm").addEventListener("submit", (e) => e.preventDefault())
  $("btnOpenFullTab").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("app.html") }))
  update()
}

init()
