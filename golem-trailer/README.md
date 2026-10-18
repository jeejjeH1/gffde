# Golem Brawl trailer

A 42-second 1920×1080 / 30 fps trailer for X, made from real game footage. The game runs in film mode (`../golem-brawl/index.html?film`): no realtime loop, so a director script steps the world one frame at a time, stages each shot with real game objects, moves the camera, and lays kinetic type over the top. The sound is synthesized offline: a 120 BPM score cut to the shots, plus every game sound effect at the exact frame it happened.

Output: `out/golem-brawl-trailer.mp4` (and `out/golem-brawl-trailer-x.mp4`, a smaller copy for posting).

## Shots

| Time | Shot | What happens |
| --- | --- | --- |
| 0:00 | city | Fly down into the plaza. "Every transaction in this city is encrypted." |
| 0:04 | bots | Spy bots drop in. "Spy bots want to read them." |
| 0:08 | land | The golem falls from the sky and slams down. "Meet the golem." |
| 0:11.5 | hero | Close orbit while it roars; the title drops in. |
| 0:15.5 | punch | 01 Punch: two three-hit combos. |
| 0:19 | slam | 02 Slam: full charge, jump, quake. |
| 0:23 | throw | 03 Throw: grab one bot and bowl it into five. |
| 0:27 | return | 04 Return: punch a drone's orb back at it. |
| 0:30 | flex | Block cleared, threat meter. |
| 0:33.5 | card | The share card flies in. |
| 0:37 | end | End card. |

## Render

```sh
npm install                 # three@0.160.0 (served locally while rendering) and playwright
node stills.mjs out/stills  # quick check: a still from every shot
node render.mjs out         # full render, about 30–45 minutes on CPU (SwiftShader)
node render.mjs out --only=slam   # one shot, silent, for iterating
```

`WORKERS=n` sets how many browser pages render in parallel (shots are independent). Fonts (Unbounded, Geist, Geist Mono; OFL) are in `fonts/` so the render needs no network.

## Files

- `director.js`: shots, camera moves, cues, overlay typography. Injected into the game page.
- `audio.mjs`: score and sound effects, written to WAV.
- `render.mjs`: captures frames with Playwright, encodes with ffmpeg, muxes the audio.
- `stills.mjs`: renders chosen frames only.
