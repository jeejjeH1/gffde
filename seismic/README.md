# Seismic — Infrastructure (motion graphic)

16:9 (1920×1080, 30fps, 95s) keynote-style motion graphic for an X/Twitter post, in the Seismic
brand palette (Mauve `#825A6D`, Purple `#523542`, greys) with the gem logo rebuilt as vectors.

- `out/seismic-infrastructure.mp4` — master (H.264 / AAC)
- `out/seismic-infrastructure-x.mp4` — smaller copy for uploading to X

## Structure (every cut is on the 96 BPM bar grid)

| time | scene |
|---|---|
| 0–7.5 | Gem facets assemble → wordmark |
| 7.5–15 | "Onchain privacy" + "Stablecoin-powered financial services" come together |
| 15–20 | But why does this matter? |
| 20–32.5 | A coin sends fast → "not enough" → what businesses need |
| 32.5–45 | 01 Better Financial Infrastructure — onchain money → Seismic → rails |
| 45–60 | 02 Privacy (dark) — a public ledger gets sealed |
| 60–72.5 | 03 Real-world finance — cross-border/FX, virtual accounts, compliance |
| 72.5–82.5 | Payments, privacy, financial services → together |
| 82.5–95 | Stablecoins are the money layer → end card |

## Files

- `scene.js` — the whole animation on canvas, a pure function `render(t)`; it also emits the sound-effect cue list
- `tools/audio.mjs` — the synthesized score (pad, FM e-piano, arp, bass, soft drums) and effects, with reverb
- `tools/render.mjs` — renders frames with Playwright, mixes audio, muxes with ffmpeg
- `tools/audio-only.mjs` — re-synthesizes just the soundtrack
- `tools/stills.mjs` — renders stills at chosen times

Preview live: open `index.html` in a browser (`index.html?t=50` freezes on one frame).
Re-render: `node tools/render.mjs out`
