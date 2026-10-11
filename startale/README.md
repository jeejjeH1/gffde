# Startale × JPYSC — "Can stablecoins transform cross-border payments?"

16:9 (1920×1080, 30fps, 69s) motion graphic for an X/Twitter post, in the pastel holographic theme.
Final video: `out/startale-jpysc.mp4` (H.264 + AAC, 48 MB — uploads directly to X)

| Time | Scene |
|---|---|
| 0–5.5s | 8 holographic cubes swirl in and lock into the Startale logo (impact, light sweep), wordmark |
| 5.5–10.5s | Camera flies through the logo → "Can stablecoins transform cross-border payments?" |
| 10.5–19s | The problem: a ¥ coin hops through bank / correspondent / FX / clearing, losing fees, T+3d settlement |
| 19–24s | "This is where Startale comes into the picture" — intermediaries shatter, logo rebuilds |
| 24–33.5s | JPYSC coin hero (with SBI Holdings), logo cubes in orbit → bridge between traditional currencies and the onchain economy |
| 33.5–40.5s | Dotted globe, yen arcs settling on-chain: move across borders / settle / new financial apps |
| 40.5–50.5s | The four theme shapes + glass cards for the 4 benefits |
| 50.5–55s | Challenges: regulation, liquidity, real-world adoption (scene desaturates) |
| 55–60.5s | "Not just digital assets — new ways to move money": grey coins turn holographic through the logo portal |
| 60.5–69s | Closing question, cubes converge into the final logo lockup |

## Files
- `scene.js` — the whole animation as a pure function `render(t)`: Three.js 3D layer (custom holographic / bubble / globe shaders) + 2D canvas compositing (type, glass cards, effects)
- `tools/audio.mjs` — synthesized soundtrack (pad, plucked arps, kick/hats/bass with sidechain) + synced sound design
- `tools/render.mjs` — renders frames with Playwright, mixes audio, encodes with ffmpeg
- `tools/stills.mjs` — render single frames for checking: `node tools/stills.mjs <dir> 4 12.5 30`

Preview live: `npx http-server startale` then open `index.html?live` (append `&t=24` to start at a time).
Re-render: `node tools/render.mjs out`
