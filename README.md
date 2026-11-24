# Leadlight

A pinball roguelite inside a giant stained-glass rose window at dusk: you are a drop of molten light, and every hit sends light running along the lead to set the dark glass glowing.

**Play:** https://gorzawebk.github.io/Leadlight/

Plays on PC (keyboard or gamepad) and on phones and tablets (touch, best held upright). Everything is made in code: the glass, the stone, the light shafts and dust, the favicon, the music and every sound. There are no image or audio files.

*"Leadlight" is a working title.*

## Controls

| Input | Keyboard | Touch | Gamepad |
| --- | --- | --- | --- |
| Left flipper | ← or Z | Hold the left half of the screen | LB / LT |
| Right flipper | → or / | Hold the right half of the screen | RB / RT |
| Plunger | Hold Space or ↓, let go to launch | Hold the shooter lane (bottom right), let go | Hold A, let go |
| Nudge | Shift or ↑ | Swipe up | B, or flick the left stick |
| Pause | Esc or P | Pause button | Start |
| Mute | M | Sound button | Back |

Every key can be rebound in **Settings** (three keys per action, saved on the device). Menus work with the arrow keys and Enter, the d-pad and A/B, or touch.

## How to play

The table **is** the window. Black lead lines (the came) divide it into glass panes that start dark. Every bumper, slingshot, target, lane, spinner and bell you hit sends a spark along the lead to the nearest dark panes, which ignite in ruby, cobalt, emerald, amber or violet. **Light every pane to finish the window.** The little rose in the HUD fills as you go.

- **A pilgrimage (run)** is five windows in a row with **three balls**. Finishing a window gives one ball back (never more than three) and lets you choose **one of three relics** to carry on. Lose your last ball and the run ends. Score is what counts.
- **A single window** is one window and three balls, for high scores. When you light the whole window it floods with light, dims again from the top, and every point is worth more next time (Gloria II, III…). A window opens here once you've reached it in a pilgrimage.

### On every window

- **Candles.** The top lanes are candles. Light them all for the next multiplier (up to ×5 for the ball). The flippers move the lit candles left and right.
- **Skill shot.** One candle burns blue as you plunge. Roll into it for 25,000 points and a burst of light. The gilt marks on the shooter lane show the pull that reaches the candles, and the plunger glows while you are in it.
- **Combos.** Hits in quick succession build a combo multiplier, up to ×3.
- **Ball save.** A ball lost in the first nine seconds after launch comes straight back.
- **Nudge and tilt.** A nudge knocks the ball up the table. Two quick nudges bring a warning, three tilt the table: the flippers die and the ball is lost without its bonus.
- **End-of-ball bonus:** 150 × panes lit with that ball × multiplier.

### The five windows

| # | Window | Shape | Colours | Feature |
| --- | --- | --- | --- | --- |
| I | Dawn | Lancet (pointed) arch | Amber, rose, cobalt | **Three swinging bells.** Ring all three while they still swing for the **Angelus**. |
| II | Saints | Four-centred (Tudor) arch | Cobalt, ruby, gold | **A rotating rosette** at the heart of the window. Strike all six haloes for the **Litany**; it reverses. |
| III | Orchard | Trefoil head | Emerald, leaf, apple red | **The hidden root cellar.** Knock down the three apples and the scoop drops the ball into a chamber of crystal roots below the window, then sends it back. |
| IV | Tempest | Ogee arch | Storm blue, violet, teal | **Wind.** Gusts sweep across the upper glass and bend the ball's path (the flipper area stays sheltered). Hit the lightning rod mid-gust for a **thunderclap**. |
| V | Rose | Round arch, great rose | Every jewel colour | **All of them**: the rosette, two bells, the wind and the crypt below. |

### Relics

Sixteen relics. Ten are available from the start; the rest are found by playing.

| Relic | Effect | Found by |
| --- | --- | --- |
| Broad Came | Flippers a fifth longer | |
| Guardian Angel | The first ball lost on each window is given back | |
| Choir of Echoes | A combo of 8 hits releases another ball (multiball) | Finishing Saints |
| Twin Panes | Every pane lit brings a neighbour with it | |
| Vespers Hourglass | Nudging slows time for a moment | Finishing a run |
| Molten Trail | A fast ball lights the dark panes it rolls across | Reaching Tempest |
| Sanctuary Post | A stone post rises between the flippers for 25 s each ball | |
| Pilgrim's Return | Both outlanes kick the ball back once; a cleared bank recharges them | |
| Prism | Every bumper hit also sends a bolt to a far, dark pane | Lighting 1,500 panes |
| Vigil Candle | An extra ball, now | |
| Martyr's Crown | All points ×2, but no ball save | Scoring 750,000 in a run |
| Feather of Gabriel | 15% less gravity | |
| Lantern Bumpers | Bumpers light an extra pane and score 50% more | |
| Gilded Lead | +×0.5 to all scoring for each window finished | Finishing 8 windows |
| Censer | Combos last 60% longer and climb to ×4 | |
| St Christopher's Medal | Far stronger nudges, twice the tilt tolerance | |

## Look and feel

- **The window.** Each window's glass is cut in code from a design of zones: rose rings, lancet panels, diamond quarries, honeycomb and slanted "rain" panes. Every pane has its own tone, a radial gradient for uneven thickness, streaks, mottling and seed bubbles from a generated glass texture, and darker glass at its edges. The lead is drawn with a slight hand-made wobble, solder blobs at the joints and a dull sheen.
- **Light.** Dark panes keep a faint dusk tint, so you can see the design before it's lit. A hit sends a spark along the lead (the shortest path through the lead network), and the pane ignites with a bloom, a ripple and the lead around it glowing gold. A blurred copy of the glass is added back over everything, so lit glass bleeds light across the came. Shafts of dusk light fall through the window with dust drifting in them, brighter as the window fills. The ball is molten light with a short glowing trail.
- **Finishing a window.** The rest of the glass ignites in a wave from the last hit, the window floods with light and the camera pulls back to show it whole, set in its carved stone wall.
- **Stone.** Indigo ashlar, moulded arch frames with crockets and a finial, colonnettes with leaf capitals, a sill, aprons carved FIAT and LVX, and (in Orchard and Rose) a vault hidden under a stone slab.
- **Menus and HUD.** Pointed arches and four-centred arches with cusps, a trefoil and crockets, drawn in SVG for each panel's real shape. Buttons are stone tablets with gilt edges and pointed heads. The score is gilt old-style numerals cut into a stone plaque, the balls are candles, the window's name is on a ribbon banner and progress is a rose that fills petal by petal.
- **Type:** Cormorant Garamond for titles and numerals, Spectral for reading. Both are bundled through Fontsource, so they work offline and inside iframes.
- **Palette:** stone `#0b0918` `#211c38` `#3d355f`, lead `#0a0910`, gilt `#d9b56a`, and jewel glass: ruby `#c8203f`, cobalt `#2448c8`, emerald `#14915a`, amber `#e89a1c`, violet `#7a3cc4`.

## Sound

All synthesised live with the Web Audio API, through a generated four-second cathedral reverb:

- **Glass chimes** (inharmonic partials, a quick strike and a long ring) tuned to D Dorian. Each hit takes a step from the last note and leans towards the organ's current chord, so a run of hits makes a little melody. Bumpers sit in the middle, slingshots low, lanes and targets high.
- **Bells**: bronze bells with hum, prime, minor tierce, quint and nominal partials for milestones, features, and the Dawn and Rose bells.
- **Music:** a slow organ (additive drawbars with a tremulant) on an eight-chord Dorian progression with a pedal note and a wandering flute-stop melody, under a **choir pad** made of detuned voices through vowel formants. Each window has its own key.
- **The rest:** soft wooden flipper knocks, a creaking plunger spring, wind that follows the gusts, distant thunder, a descending glass fall when you drain. Nothing harsh, nothing chiptune.

Sound starts after the first tap, click or key press, and pauses with the game when the tab is hidden.

## Settings

Music and effects volume, mute, **reduced motion** (no screen shake or flashes; follows the system setting until changed), **high-contrast lead** (thicker lead lines and rails with a light outline), **colour-blind markings** (each glass colour gets its own pattern once lit) and key bindings. Best scores, settings, keys, stats and found relics are saved in `localStorage` (wrapped in try/catch, with an in-memory fallback).

## Embedding

The game fills whatever box it's placed in (`#game` is 100% × 100% of its container, a `ResizeObserver` resizes the canvas, and the menus and HUD scale with container-query units). On wide boxes the HUD sits beside the table; on tall ones above it. It works in a page or an iframe: keys only act while the game has focus (and then don't scroll the host page), sound starts on the first click, and the game pauses itself when the tab is hidden or focus leaves it.

## How it's built

- Plain JavaScript modules and [Vite](https://vite.dev). No framework and no physics library. Canvas 2D.
- **Physics** (`src/physics/`): a fixed 120 Hz step, split into substeps so that no ball and no moving surface (a flipper tip, the rosette, a bell, the plunger) travels more than a third of the ball's radius per substep. Contacts are found while the ball's centre is still well outside the surface, so even a zero-thickness wall can't be tunnelled through. Capsules, circles, tapered flippers with surface velocity, one-way gates, sensors, pendulums and rotors, Coulomb friction, jittered kickers (so slingshots can't lock into a loop), and a broad-phase grid.
- **The rules** (`src/game/`, `src/relics/`, `src/tables/`) have no DOM or drawing code, so they run and are tested in Node.
- **Rendering:** the stone, frame and glass are drawn once into an offscreen layer; lighting a pane redraws just that pane and its lead into it. A frame is that one image, a small blurred copy for the bloom, the fixtures, the balls and effects. Device pixel ratio is capped at 2, and if frames are consistently slow the game lowers it, then the layer's resolution.
- **Performance:** about 1.3 ms of script per frame on a desktop CPU, around 5 ms with the CPU throttled 4×.

| File | What it does |
| --- | --- |
| `src/main.js` | Start-up, the main loop, layout, the flow between menus, windows and runs |
| `src/physics/world.js` | The physics world: balls, segments, circles, flippers, sensors, substepping |
| `src/physics/bodies.js` | Swinging bells (pendulums) and the rotating rosette |
| `src/tables/common.js` | Shared geometry: the lower playfield, shooter lane and the five arch shapes |
| `src/tables/panes.js` | Cutting a window into panes (Sutherland–Hodgman), welding, neighbours, the lead graph and paths along it |
| `src/tables/dawn.js` … `rose.js` | The five windows: layout, palette, glass design, feature |
| `src/game/table.js` | Turns a table definition into physics bodies and fixture state |
| `src/game/game.js` | One window in play: flippers, plunger, nudge and tilt, every fixture's rules, ball save, drains |
| `src/game/lighting.js` | Which panes are lit, and which a hit lights |
| `src/game/scoring.js` | Points, combos, multipliers and bonuses |
| `src/game/run.js` | A pilgrimage: five windows, balls, relic offers |
| `src/relics/relics.js` | The sixteen relics and how they combine |
| `src/render/renderer.js` | Camera, bloom, flood, balls, screen effects |
| `src/render/glass.js` | The cached window layer: glass panes, lead, solder, bloom copy |
| `src/render/stone.js` | Masonry, the carved frame, colonnettes, sill, aprons, cellar |
| `src/render/fixtures.js` | Bumpers, slingshots, candles, targets, bells, rosette, flippers, plunger |
| `src/render/effects.js` | Sparks along the lead, ignition, ripples, embers, light shafts, dust, wind |
| `src/render/sprites.js`, `colour.js`, `thumb.js`, `favicon.js` | Glow sprites and textures, colour helpers, window thumbnails, the favicon |
| `src/audio/audio.js` | Chimes, bells, organ, choir, effects and the reverb |
| `src/input/input.js` | Rebindable keyboard, touch zones and swipes, gamepad |
| `src/ui/ui.js`, `art.js`, `style.css` | Menus, HUD, banners and toasts; the SVG arches, ribbon, candles, rose and relic icons |
| `src/storage.js` | Settings, keys, best scores, stats, unlocks (`localStorage` with a fallback) |
| `tests/` | Vitest: physics (tunnelling, flippers, energy), lighting, scoring, every relic, runs, features, save data |
| `tools/` | Headless helpers: plunge paths, flipper reach, skill-shot bands, an autoplayer and a stuck-ball finder |

### Decisions made along the way

The brief left some details open; these are the choices made (more in [DESIGN.md](DESIGN.md)):

- **Lighting:** a hit lights the *nearest unlit* panes to where it happened, so light creeps outwards from each fixture and no pane is ever out of reach. Bumpers light a pane every second hit, slingshots every third, spinners every fifth turn; targets, lanes and drops light one or two each, features a burst.
- **Balls:** three for the whole run, as asked; finishing a window gives one back (up to three) so a five-window run is winnable. The ball in play when a window completes isn't lost: it rises into the light.
- **The skill shot** is a plunger-strength shot, as on real tables, with gilt marks on the lane showing the band and lane change on the flippers to adjust.
- **Unlocks:** ten relics from the start, six through play; windows open in single-window mode once reached in a run. `?unlock=all` opens everything (for testing).
- **The cellar** is a real chamber in the physics world below the table; the camera follows the ball down and back.
- The autoplayer (`npm run bot`) found ledges where a ball could rest; every wall-side bank now has a small stone wedge above it, and both scoops are cut into the walls.

## Running locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173 (also on your LAN for phone testing)
npm test           # physics, lighting, scoring, relics, runs, features, save data
npm run build      # static site in dist/
npm run preview
```

Helpers: `npm run bot -- rose 4` (autoplayer stats for a window), `npm run skill -- saints` (which plunger pull reaches the candles), `npm run stuck -- orchard` (where balls get stuck). In the browser console, `window.leadlight` gives you the `game`, the `run`, the `renderer`, `startSingle(id)` and `startRun()`.

## Deployment

Every push to `main` runs the tests, builds the game and publishes it to GitHub Pages via `.github/workflows/deploy.yml`. Vite's `base` is `'./'`, so the build works at `https://<user>.github.io/Leadlight/`, in any subfolder and inside an iframe. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
