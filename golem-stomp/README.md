# Golem Stomp

Fan-made arcade game for the Seismic community. Spy bots crawl through the city to read encrypted transactions; you are the rock golem, and every stomp is an earthquake.

Open `index.html` in a browser. It is one self-contained file (canvas + synthesized WebAudio, no build step, no assets), so it can be hosted anywhere static: GitHub Pages, Vercel, Netlify.

## Controls

| Input | Action |
| --- | --- |
| Tap / click / Space | Quick stomp (small quake) |
| Hold, then release | Charged stomp. The dashed ring shows the reach and the Richter magnitude (M 3.0 to M 7.6) |
| E or the ⚡ button | Overload: an M 9.0 quake that clears the street. Fills as you stomp bots |
| P / Esc | Pause |

## Enemies

- **Crawler**: walks in from the edges.
- **Sprinter**: faster, hops (from Block 3).
- **Drone**: hovers high and scans the golem. Needs a charged quake to reach (from Block 2).
- **Brute**: takes three hits and gets knocked back (from Block 4).

Each block (wave) adds more bots. Clearing an even-numbered block restores a shield. Chains of kills raise the score multiplier; a stomp that hits nothing breaks the chain. Best score, biggest quake and furthest block are saved in the browser.
