# Golem Brawl

Fan-made 3D brawler for the Seismic community. Spy bots drop into a plaza to read encrypted transactions; you are the rock golem.

Open `index.html` in a browser. It is one file: Three.js (r160, loaded from jsDelivr) plus procedural geometry, procedural animation and synthesized WebAudio. No models, textures or build step, so it can be hosted anywhere static.

## The golem

- Cel-shaded faceted rock (toon ramp, per-facet colour, inverted-hull black outline) with the Seismic mark glowing on the chest.
- A full joint rig (hips, spine, neck, head, shoulders, elbows, fists, thighs, knees, feet) animated procedurally with damped poses: idle breathing, run cycle with footstep dust, a three-hit combo ending in a double-fist hammer, a crouch-charge, jump and ground slam, grab, carry overhead and throw, hit flinch, roar, victory flex, knock-out.
- A face: glowing eyes that blink and squint, rock brows that tilt for angry, worried and happy, a mouth that opens to roar. The head turns toward the nearest bot.

## Controls

| Desktop | Touch | Action |
| --- | --- | --- |
| WASD / arrows | Left-side stick | Move |
| J / click / Space | Punch | Punch (tap three times for a combo) |
| K / right click, hold | Slam, hold | Charge a jump slam; the ring shows its reach |
| L | Grab | Grab a bot, press again (or punch) to throw it |
| P / Esc | Pause button | Pause |

## Bots

- **Peeper**: hops around, telegraphs with an aim line, then fires a laser. Step out of the line.
- **Drone**: circles high and lobs orbs. Punch an orb to send it back.
- **Brute**: heavy, flashes its visor, then charges. Slam it to stun it.

When the golem falls, the game draws a 1200×675 share card (a hero render of the golem flexing, the score, a rank from Pebble to Tectonic Titan, and stats). Players can save it, copy it, or open a prefilled post on X.

Bots drop crystals that heal the golem. Clearing a block heals 25 and starts a tougher one.

## Difficulty

One curve drives everything: `diff = 1 - e^(-(block-1)/6)`. It is 0 on block 1, about 0.5 by block 5 and 0.8 by block 10, and levels off toward 1, so the game gets harder every block but never runs away. At the ceiling bots move 30% faster, attack about 40% more often, telegraph 20% faster and hit 25% harder, with at most 8 on screen. Bot counts per block go 4, 6, 8, 9, 10, 11 … and settle around 17. Each block's banner shows a threat level from 1 to 10.
