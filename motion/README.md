# GenLayer — Appeals (motion graphic)

16:9 (1920×1080, 30fps, 80s) motion graphic for an X/Twitter post.
Final video: `out/genlayer-appeals.mp4`

- `scene.js` — the whole animation, drawn on canvas as a pure function `render(t)`
- `tools/audio.mjs` — synthesized sound design (soft typing ticks, whooshes, booms, ambient pad)
- `tools/render.mjs` — renders frames with Playwright, mixes audio, muxes with ffmpeg

Preview live: open `index.html` in a browser. Re-render: `node tools/render.mjs out`
