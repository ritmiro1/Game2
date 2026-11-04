# Aetheris Shaders

A photorealistic, cinematic shader pack for **Minecraft 1.21.4** running on
**Iris (Fabric)** or **OptiFine**. Written from scratch in GLSL 1.20.

> **Status:** the pack is fully built, statically validated and shipped as a
> release ZIP. It has **not** been run inside a live Minecraft client in this
> environment (no GPU / game client available here) — see
> [Verification](#verification) for exactly what was and was not tested.

---

## Download

| File | Size | Description |
|------|------|-------------|
| `Aetheris_v1.0.0.zip` | 46 KB | Ready-to-install shader pack (drop into `.minecraft/shaderpacks/`) |
| `Aetheris_v1.0.0_SOURCE.zip` | 104 KB | Complete source archive (shaders, docs, tools) |

Both files are committed to this repository and are served straight from it:

```
https://codeload.github.com/ritmiro1/Game2/zip/refs/heads/arena/bce8e69d-game2
```

Download that archive, open it, and take `Aetheris_v1.0.0.zip` (or the
`Aetheris/` folder itself — an unpacked folder also works in `shaderpacks/`).

SHA-256:

```
Aetheris_v1.0.0.zip        9b53647783459c44e183fe170d172a5e4179a3d95038a8409549ce3b9c5cf653
Aetheris_v1.0.0_SOURCE.zip c6105e05dea659b715be2b533212651e9e77a6c4747e307577f589ae51973246
```

Releases page: <https://github.com/ritmiro1/Game2/releases/tag/aetheris-v1.0.0>
(the release entry exists, but the release-asset upload endpoint is blocked from
the build sandbox, so the binaries live in the branch above rather than as
release assets).

---

## Installation

1. Install Minecraft **1.21.4**.
2. Install **Iris Shaders** (Fabric) or **OptiFine**.
3. Place `Aetheris_v1.0.0.zip` in `.minecraft/shaderpacks/` — **do not unzip it**.
4. Launch the game → `Options → Video Settings → Shader Packs`.
5. Select **Aetheris v1.0.0**.
6. Open `Shader Pack Settings` and pick a preset (`LOW` / `MEDIUM` / `HIGH` / `ULTRA`).

## Requirements

| Preset | GPU guidance |
|--------|--------------|
| LOW | GTX 1050 / RX 560 |
| MEDIUM | GTX 1060 / RX 580 |
| HIGH | GTX 1660 Ti / RX 5600 XT |
| ULTRA | RTX 3060 / RX 6700 XT or better |

8 GB RAM minimum. Iris is recommended for best Fabric compatibility.

---

## What the pack renders

### Lighting model
* Deferred, physically based shading: Cook-Torrance GGX specular with
  Smith height-correlated visibility and Schlick Fresnel, plus an
  Oren-Nayar diffuse term.
* Per-material roughness / metallic values derived from block and entity
  material classification, with foliage using wrapped + back-lit translucency.
* Analytic single-scattering atmosphere (Rayleigh + Mie + ozone absorption)
  drives the sky, the directional light colour and all ambient terms, so the
  world and the sky agree at every time of day.
* Emissive blocks (torch, lantern, glowstone, sea lantern, lava, campfire,
  shroomlight, froglight, amethyst, respawn anchor…) light the scene through
  a screen-space emissive gather, on top of the vanilla light map.

### Shadows
* Shadow map with configurable resolution (1024 / 2048 / 3072 / 4096).
* Rotated Vogel-disk PCF with 1–16 taps, configurable penumbra softness.
* Slope-aware bias, distance fade and translucent (water / glass) softening.
* Foliage and grass are alpha-tested in the shadow pass and sway with the same
  wind field as the visible geometry, so shadows match the leaves.

### Water
* Animated multi-octave wave normals plus fine ripples, distance faded.
* Fresnel blend between refraction and reflection.
* Screen-space reflections (projected ray march against the opaque depth
  buffer) blended with the analytic sky, quality-controlled.
* Beer-Lambert per-channel absorption, in-scattering, depth tinted colour,
  Procedural shoreline foam, rain foam, sun/moon glints, and underwater
  caustics projected onto submerged surfaces.
* Correct when above the surface, at the surface, and submerged.

### Sky & atmosphere
* Sun disc sized/scaled by setting, with halo and wide forward scattering.
* Moon disc with real phase, maria detail and moon halo.
* Procedural star field with twinkle and a Milky Way dust band.
* Two-layer drifting volumetric cloud sheet with self-shadowing, powder term,
  silver lining, sunset tinting and rain darkening.
* Cloud shadows projected on to terrain.
* Analytic height fog / aerial perspective with sun in-scattering.

### Post-processing
* Screen-space volumetric light (god rays) marched against the depth buffer,
  with jittered sampling and dithering.
* Procedural lens flare: aperture ghosts, anamorphic streak, halo ring,
  depth-occluded.
* Multi-scale Poisson bloom (three radii), threshold with soft knee.
* Hue-preserving ACES filmic tone mapping (plus Reinhard / AgX / extended
  Reinhard options).
* Cinematic grading: split toning (warm highlights, cool shadows),
  saturation, contrast, white balance.
* Optional depth of field, sharpen, vignette, film grain — and a real
  luminance-based **FXAA** on the final pass (it evaluates the whole grading
  chain per tap, so it does not smear untonemapped HDR).
* Ordered-dither debanding for night skies.

---

## Configuration

Everything is exposed in the shader GUI, grouped into screens:

| Screen | Options |
|--------|---------|
| Presets | LOW / MEDIUM / HIGH / ULTRA |
| Shadows | resolution, samples, softness, distance, fade |
| Ambient Occlusion | samples, radius, strength, bias |
| Volumetric Light | on/off, steps, intensity |
| Bloom and Flare | on/off, strength, threshold, sun glow |
| Water | waves, wave height, reflection, clarity, caustics |
| Sky and Clouds | clouds, detail, coverage, altitude, stars, Milky Way, cloud shadows, sun size |
| Colour Grading | exposure, saturation, contrast, white balance, tone curve, vignette, emissive strength |
| Camera FX | DOF, DOF strength, FXAA, sharpen, dither, SSR steps/intensity |

Defaults come from `Aetheris/shaders/lib/settings.glsl`; every option in
`shaders.properties` is validated against the allowed values in that file.

---

## Repository layout

```
Aetheris/shaders/
  shaders.properties        GUI definition, presets, buffer formats
  block.properties          block ID groups
  entity.properties         entity ID groups
  lang/en_US.lang           GUI labels
  lib/
    settings.glsl           all user settings (compile-time)
    common.glsl             uniforms, math, colour, tonemapping, grading
    noise.glsl              hashes, value noise, fbm, worley
    sky.glsl                atmosphere, sun/moon/stars, clouds, fog
    shadows.glsl            PCF shadow sampling
    lighting.glsl           PBR material model + sky ambient + shading
    water.glsl              waves, normals, foam, caustics, absorption
    post.glsl               bloom helpers, SSAO, DOF, FXAA, vignette
    volumetric.glsl         god rays
  gbuffers_*.{vsh,fsh}      terrain, water, skybasic, clouds, entities,
                            hand, basic, textured, weather
  shadow.{vsh,fsh}
  deferred.{vsh,fsh}
  composite{,1,2}.{vsh,fsh}
  final.{vsh,fsh}
tools/
  validator.js              static shader-pack checker
  reference_render.py       CPU port of the colour pipeline + chart renderer
  preview_lighting_chart.png
```

### Render pipeline

```
shadow        → shadow map (alpha-tested, wind animated, translucent aware)
gbuffers_*    → colortex0 albedo | colortex1 normal+material | colortex2 lightmap+emissive
                (water / hand / weather shade themselves and mark alpha < 1)
deferred      → PBR lighting + AO + block light + emissive spill + fog
composite     → god rays
composite1    → lens flare
composite2    → bloom
final         → sharpen, exposure, tonemap, grade, vignette, FXAA, dither
```

---

## Verification

**Automated checks that were run** (`node tools/validator.js`, all passing):

* every `#include` resolves (including nested includes and include guards);
* every sampler (`colortex*`, `depthtex*`, `shadowtex*`, `gtexture`, …) used in
  a program is declared in that program;
* every function called in a program is defined somewhere in its translation
  unit or is a GLSL builtin (this caught missing includes for `skyAmbient`,
  `sunTint`, `vignette`, `lightColor`);
* every `#if <NAME>` evaluates a symbol that is actually `#define`d — a `#if`
  on an undefined symbol silently evaluates to 0 in GLSL and disables effects;
* every setting referenced by any shader exists in `settings.glsl`, and every
  setting in `settings.glsl` is referenced by at least one shader (no dead
  toggles — this is why `CLOUD_QUALITY`, `STARS`, `SSR_STEPS`, `SSR_STRENGTH`
  are wired into real code paths);
* varying declarations match between each `.vsh` / `.fsh` pair, including type;
* every fragment program that writes `gl_FragData` has a `DRAWBUFFERS` comment;
* braces balanced, `shaders.properties` option values are within the allowed
  ranges of their `#define`, profiles only set real settings.

**Colour pipeline check** (`python3 tools/reference_render.py`): the shading
maths from the GLSL libraries is ported to Python and rendered to
`tools/preview_lighting_chart.png`, then measured. This found and fixed three
real defects:

1. atmospheric optical depth was two orders of magnitude too large, making
   sunrise/sunset render as black;
2. night sky radiance was ~20× too dark to read;
3. the sun-lit sky clipped to white while the ground clipped to white too —
   ACES was desaturating the sky. The pack now uses a hue-preserving ACES
   variant and rebalanced sky/key-light gains.

Current measured results (HDR linear / display values):

| Time | HDR p50 | HDR p97 | LDR p50 | LDR max | Clipped |
|------|---------|---------|---------|---------|---------|
| Noon | 0.315 | 1.225 | 0.690 | 0.941 | 0.00 % |
| Afternoon | 0.331 | 0.744 | 0.706 | 0.912 | 0.00 % |
| Sunset | 0.134 | 0.275 | 0.445 | 0.752 | 0.00 % |
| Dusk | 0.055 | 0.081 | 0.172 | 0.379 | 0.00 % |
| Night | 0.050 | 0.071 | 0.154 | 0.265 | 0.00 % |

**Not verified here:** actual in-game rendering. This sandbox has no GPU, no
Minecraft client and no GLSL compiler, so shader compilation on your driver,
the in-game result and frame rates are unconfirmed. The static checks above
target the failure modes that make a pack refuse to load or silently render
wrong, but they are not a substitute for launching the game.

---

## License

Source is provided for learning and personal use. Do not re-upload the pack as
your own work.
