# Leadlight: design notes

*Written before any code. "Leadlight" is a working title.*

## 1. The other games, and how Leadlight stays apart

I read the README and skimmed the UI code (`index.html`, `style.css`, `ui.js`/`hud.js`, `audio.js`) of every public repo on **GorzaWebK** and **GorzaWebA**.

| Game | Account | What it looks and sounds like |
| --- | --- | --- |
| **Skyhook** | K | First-person 3D grappling (three.js). Orange anchor blocks, bright sky and clouds. Plain system UI: Segoe UI / system sans, monospace numbers. Synth music in A minor that builds with speed. |
| **FOUNDRY-ARENA** | K | Three.js arena shooter. Tempered steel and safety orange, **Saira Stencil One** plus Barlow Condensed, shop-floor bot names, industrial room reverb, hazard-stripe UI. |
| **Redline** | K | Time-trial racing (three.js). Segoe UI plus a condensed face, racing HUD with speedo and medals, engine synths and generated music that follows your speed. |
| **orb-dash** | K | Neon space endless runner in one `index.html`. **Orbitron**, glowing cyan/magenta on black, arcade blips. |
| **hop-across** | K | Voxel lane hopper (three.js). Bright sky blue `#7fd0f5`, white panels, yellow `#ffcf3f` accent, chunky rounded sans HUD. |
| **Blueprint-Heist** | K | Top-down stealth on cyanotype **Prussian blue** `#0d3866` paper with white line work, amber highlighter cones, red pencil. Tracing-paper menus with drafting tape, an architect's title-block HUD. Architects Daughter + IBM Plex Sans Condensed. Late-night jazz trio. |
| **Needle-Drop** | K | Rhythm game on a spinning vinyl record. Hot pink `#ff48b0`, navy, yellow; risograph/halftone print look, price-sticker buttons, record-shop crates. **Bungee** + Rubik. Genre sequencer music, vinyl crackle, scratches. |
| **Paper-Tides** | K | Calm hex puzzle in ink and watercolour on cream paper `#f4ecd8`. Torn field-journal pages, ink-stamp buttons. **Fraunces** + Caveat. Wind chimes, surf, D major pentatonic generative music. |
| **Idle-Island** | A | Idle settlement/defence game. Pale sea-grey surfaces `#e2e7e6`, ochre accent, **Grenze** display + Barlow. Flat light UI cards. |
| **Gravity.io** | A | Grow-into-a-black-hole .io game. Space ink `#090b18`, bone and ember orange, **Unbounded** + Manrope. D major pentatonic, layered generative music. |
| **Stuntrun** | A | Low-poly desert stunt show. Marquee yellow, show red, hard ink shadows, tickets and rosettes. **Alfa Slab One** + Barlow Condensed. Six-cylinder engine audio. |
| **Borderfall** | A | Real-time world conquest. Old-map parchment `#efe5cf`, umber and brass. **Alegreya / Alegreya SC / Alegreya Sans**. |

### What Leadlight takes from them (conventions only)

- Vite plus plain JavaScript ES modules, no framework, no physics library, and a small `src/` split by job.
- Game rules with no DOM or drawing code, so they run and are tested in Node (Vitest here, as the brief asks).
- `localStorage` wrapped in try/catch with an in-memory fallback, under one versioned key.
- Rebindable keys (several per action), gamepad, touch; Esc/P pause, M mute.
- `#game` fills its container, a `ResizeObserver` drives the canvas, it pauses when the tab is hidden, and there are no ads inside the game.
- Everything (art, favicon, music, sound) is made in code. Fonts are bundled with @fontsource so they work offline and in iframes.
- A GitHub Actions workflow that tests, builds and publishes `dist/` to Pages on every push to `main`, with a relative Vite base.
- README layout: pitch, Play link, platforms, controls table, how to play, look and feel, sound, how it's built (file table), the decisions made along the way, running locally, deployment.

### How Leadlight is different

| | The others | Leadlight |
| --- | --- | --- |
| **Setting** | Sky, factory, race track, space, voxel roads, blueprint paper, a record shop, a watercolour island, parchment maps, a desert show | The inside of a **gothic cathedral at dusk**: a stained-glass rose window lit from behind |
| **Light** | Flat light colours (Paper-Tides, Idle-Island, hop-across), neon on black (orb-dash), print colours (Needle-Drop) | **Transmitted light**: dark glass that ignites into ruby, cobalt, emerald, amber and violet, with bloom, light shafts and dust motes. The only "glow" comes from glass and molten light, never neon edges |
| **Palette** | Orange/steel, Prussian blue, pink/navy, cream, sea grey, ember on space ink, marquee yellow, parchment | Near-black **indigo stone** `#120f1f` / `#1d1830`, lead black `#0a0910`, gilt `#d9b56a`, and jewel glass (ruby `#c8203f`, cobalt `#2448c8`, emerald `#14915a`, amber `#e89a1c`, violet `#7a3cc4`) |
| **Type** | Orbitron, Saira Stencil, Bungee, Architects Daughter, Fraunces, Caveat, Grenze, Unbounded, Alfa Slab, Alegreya, Barlow, system sans | **Cormorant Garamond** (an elegant old-style Garamond with old-style numerals) for titles and the score; **Spectral** (a plain, very readable book serif) for body text. No sans-serif anywhere, no all-caps tech labels |
| **Menus** | Tracing paper, journal pages, price stickers, tickets, steel panels, flat cards | **Pointed gothic arches** with carved stone tracery (trefoils, cusps, crockets) drawn in SVG, stone tablets for buttons, a gilt-edged **ribbon banner** for titles |
| **HUD** | Title block, logbook strip, speedo, neon counters | The score is **gilt numerals cut into a stone plaque**; balls are **three candles**; the window's name is on a ribbon; progress is a small rose that fills with colour |
| **Motion** | Bounce-in cards, chasing bulbs, sunburst pulses | Slow and liturgical: panes **ignite** with a bloom and a ripple, light runs along the lead, dust drifts in the light shafts, and a finished window floods with light while the camera pulls back |
| **Sound** | Jazz trio, chiptune-ish blips, engines, vinyl, wind chimes, pentatonic noodling | **Glass chimes** (inharmonic glass partials) tuned to **D Dorian**, so hits make melodies over the current chord; **bell tolls** for milestones; a **choir pad** (formant-filtered voices); a slow **organ** loop, all in a long generated cathedral reverb |

None of them is a pinball game or uses 2D rigid-body physics, so the genre is also new.

## 2. Leadlight in one paragraph

A portrait pinball table that *is* a stained-glass window. Black lead lines (the came) divide it into dark panes. Every bumper, target, lane and spinner sends light running along the lead to the nearest dark panes, which ignite in colour. Light every pane to finish the window. A run is five windows (Dawn, Saints, Orchard, Tempest, Rose) with three balls, and between windows you take one of three relics. There is also a single-window mode for high scores.

## 3. Plan and build order

1. **Physics and a test table.** `src/physics/`: fixed 120 Hz step, substeps sized so nothing (ball or flipper tip) moves more than about a third of the ball's radius per substep; capsules (segments), circles, one-way gates, sensors, flippers as rotating tapered capsules, kinematic bodies with surface velocity, pendulums; a broad-phase grid. Vitest: no tunnelling, flipper hits, energy.
2. **Feel.** Flipper speeds, elasticity and friction, plunger with hold-to-pull, slingshots, inlanes and outlanes, nudge with tilt warning and tilt, ball save. Keyboard, touch and gamepad.
3. **Lighting.** Panes are generated: each window is a set of zones (rose rings, lancets, quarries, honeycomb, slanted rain panels), each zone is cut into convex cells, and the window outline is clipped by each cell (Sutherland–Hodgman). Vertices are welded into a lead graph; light travels along it (Dijkstra) from the hit to the panes it lights.
4. **Five tables**, each with its own outline, palette, glass design and one feature.
5. **Relics and runs**, single-window mode, saves and unlocks.
6. **Menus and HUD.**
7. **Audio.**
8. **Polish**, settings, README, deploy.

## 4. Decisions (where the brief left room)

Added as they were made.

- **Canvas 2D, not WebGL.** The glass is drawn once into an offscreen layer and only the panes that change are redrawn into it, so a frame is mostly one image copy. Bloom comes from a small, downscaled copy of that layer drawn back with additive blending, which is cheap on phones and still bleeds light over the lead lines. WebGL would add a lot of code for little gain here.
- **Table size.** 640 × 1060 table units, ball radius 12; gravity along the table 1500 units/s². The camera fits the table to the screen; on phones the HUD sits above it, on wide screens beside it.
- **Lighting rule.** A hit lights the nearest *unlit* panes to where it happened, so light spreads outwards from each fixture over time and there is never a pane you can't reach. Panes are lit in the rules the moment they are earned; the spark along the lead is just the visual.
- **Balls.** Three for the whole run, as the brief says. To keep a five-window run winnable, finishing a window gives one ball back (never more than three in hand). Finishing a window doesn't cost the ball in play: it is drawn up into the light.
- **Single window** has no relics. When you finish the window it dims again in a sweep and the next lighting is worth more ("Gloria" level ×2, ×3…), so scores can keep climbing.
- **Unlocks.** Ten relics are available from the start; six unlock through play. In single-window mode a window is open once you've reached it in a run (Dawn always is); `?unlock=all` opens everything for testing.
- **Vite base** is `'./'` (relative), like the other games: it works at `https://<user>.github.io/Leadlight/`, in any subfolder and in an iframe.
