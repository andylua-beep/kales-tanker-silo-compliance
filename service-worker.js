chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("kales_tanker_presets")
  if (!existing.kales_tanker_presets) {
    await chrome.storage.local.set({
      kales_tanker_presets: [
        {
          name: "45,000L 4-Compartment Aluminum Fuel Tanker (Diesel 0.84 kg/L)",
          model: "aluminum-tanker-trailer",
          axles: 3,
          volumeLiters: 45000,
          compartments: 4,
          fillPct: 93
        }
      ]
    })
  }
})
