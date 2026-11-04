/*
    Aetheris Shaders - water surface model: waves, normals, foam, caustics, depth tint.
*/
#ifndef WATER_GLSL
#define WATER_GLSL

#include "/lib/common.glsl"

/* Two-octave gerstner-ish wave height */
float waveHeight(vec2 pos, float t){
#if WATER_WAVES == 1
    float h = 0.0;
    h += vnoise(pos * 0.32 + vec2( t * 0.09,  t * 0.05)) * 0.62;
    h += vnoise(pos * 0.71 + vec2(-t * 0.13,  t * 0.11)) * 0.28;
    h += vnoise(pos * 1.63 + vec2( t * 0.21, -t * 0.17)) * 0.12;
    return h * 0.12 * WATER_WAVE_HEIGHT;
#else
    return 0.0;
#endif
}

/* Analytic normal from finite differences of the wave field */
vec3 waveNormal(vec2 pos, float t, float strength){
#if WATER_WAVES == 1
    float e = 0.09;
    float hL = waveHeight(pos - vec2(e, 0.0), t);
    float hR = waveHeight(pos + vec2(e, 0.0), t);
    float hD = waveHeight(pos - vec2(0.0, e), t);
    float hU = waveHeight(pos + vec2(0.0, e), t);
    vec3 n = normalize(vec3((hL - hR) * 9.0 * strength, 1.0, (hD - hU) * 9.0 * strength));
    return n;
#else
    return vec3(0.0, 1.0, 0.0);
#endif
}

/* Fine ripple detail, keeps the surface alive up close */
vec3 rippleNormal(vec2 pos, float t, float distFade){
    vec2 p = pos * 2.6;
    float e = 0.12;
    float n0 = fbm2(p + vec2(t * 0.42, t * 0.31), 3);
    float nx = fbm2(p + vec2(e, 0.0) + vec2(t * 0.42, t * 0.31), 3);
    float nz = fbm2(p + vec2(0.0, e) + vec2(t * 0.42, t * 0.31), 3);
    float amp = 0.55 * distFade;
    return normalize(vec3((n0 - nx) * amp * 6.0, 1.0, (n0 - nz) * amp * 6.0));
}

/* Foam: shoreline (small depth) + cresting waves */
float waterFoam(vec3 worldPos, float depth, float t, float rain){
    float shore = 1.0 - smoothstep(0.0, 1.6, depth);
    float noise = fbm2(worldPos.xz * 1.7 + vec2(t * 0.35, t * 0.22), 3);
    float crest = smoothstep(0.62, 0.92, noise) * smoothstep(0.0, 2.5, depth);
    float foam = shore * smoothstep(0.42, 0.85, noise * (0.6 + shore * 0.9)) + crest * 0.45;
    foam += smoothstep(0.4, 1.0, rain) * 0.35 * smoothstep(0.5, 0.85, noise);
    return saturate(foam);
}

/* Caustics on underwater surfaces */
vec3 caustics(vec3 worldPos, float t, float depth){
#if WATER_CAUSTICS == 1
    vec2 p = worldPos.xz * 1.25;
    float c1 = fbm2(p + vec2(t * 0.22, t * 0.17), 3);
    float c2 = fbm2(p * 1.7 - vec2(t * 0.19, t * 0.24), 3);
    float pattern = pow(saturate(1.0 - abs(c1 - c2) * 2.6), 3.0);
    float atten = exp(-max(depth, 0.0) * 0.22);
    return vec3(0.55, 0.78, 1.0) * pattern * atten * 1.6;
#else
    return vec3(0.0);
#endif
}

/* Colour of the water body itself (in-scattering), lit by sky + sun */
vec3 waterSurfaceColor(vec3 sunDir){
    float day = saturate(smoothstep(-0.12, 0.25, sunDir.y));
    vec3 deep = vec3(0.012, 0.055, 0.085);
    vec3 shallow = vec3(0.05, 0.18, 0.20);
    vec3 c = mix(deep, shallow, day);
    c += vec3(0.02, 0.09, 0.11) * day;
    return c;
}

/* Per-channel transmittance through `pathLength` metres of water */
vec3 waterTransmittance(float pathLength, float clarity){
    vec3 absorb = vec3(0.52, 0.145, 0.085) / max(clarity, 0.05);
    return exp(-absorb * max(pathLength, 0.0) * 1.35);
}

/* In-scattered colour (the water body's own glow) */
vec3 waterScatter(float pathLength, float clarity){
    vec3 trans = waterTransmittance(pathLength, clarity);
    return vec3(0.030, 0.115, 0.165) * (1.0 - trans);
}

#endif
