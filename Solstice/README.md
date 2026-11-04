# Solstice Shader Pack 1.0.0

A compact, original GLSL shader pack aimed at Iris (Fabric) and OptiFine for Minecraft 1.21.x. The implementation prioritizes a cinematic palette, directional diffuse lighting, 4-tap shadow filtering, screen-space depth occlusion, Fresnel water tinting/highlights, bloom, and ACES tone mapping.

## Install
1. Put `Solstice_v1.0.0.zip` (do not unzip) into `.minecraft/shaderpacks/`.
2. Select **Solstice** in Video Settings → Shader Packs.
3. Choose a profile and adjust available shader options in the pack settings.

## Honest compatibility and feature notes
This is a fast first release, not a path tracer. The water uses animated Fresnel/specular approximation rather than true ray-marched SSR/refraction; AO is a small depth-neighbor approximation; volumetric light is a subtle depth haze. OptiFine/Iris version and GPU behavior can vary. No Minecraft client or GPU compiler is available in this workspace, so in-game loading and visual results have not been verified. Try Iris first and report any log errors before using in a world.

All shader code in this pack is original. Source includes reusable GLSL utilities in `shaders/lib/`.
