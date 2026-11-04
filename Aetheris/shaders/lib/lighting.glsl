/*
    Aetheris Shaders - physical material model, sun/sky lighting and emissive light.
    Cook-Torrance GGX specular + Lambert/Oren-Nayar diffuse, wrapped in a
    deferred-friendly shading function.
*/
#ifndef LIGHTING_GLSL
#define LIGHTING_GLSL

#include "/lib/common.glsl"
#include "/lib/shadows.glsl"
#include "/lib/sky.glsl"

/* ---------- material IDs (must match gbuffers) ---------- */
const int MAT_DEFAULT   = 0;
const int MAT_FOLIAGE   = 2;
const int MAT_METAL     = 3;
const int MAT_EMISSIVE  = 4;
const int MAT_WATER     = 6;
const int MAT_GLASS     = 7;
const int MAT_SUBSURF   = 8;
const int MAT_SAND      = 9;

/* ---------- material property estimation from screen-space data ---------- */
void materialProperties(vec3 albedo, float materialID, vec3 worldNormal, out float roughness, out float metallic, out float f0){
    float t = materialID;
    roughness = 0.72;
    metallic  = 0.0;

    if (t < 0.5){ roughness = 0.74; metallic = 0.0; }
    else if (t < 1.5){ roughness = 0.62; metallic = 0.0; }   // glowing / noisy
    else if (t < 2.5){ roughness = 0.58; metallic = 0.0; }   // leaves
    else if (t < 3.5){ roughness = 0.42; metallic = 0.5; }   // metal
    else if (t < 4.5){ roughness = 0.55; metallic = 0.0; }   // emissive
    else if (t < 8.5){ roughness = 0.35; metallic = 0.0; }   // glass / water-ish
    else if (t < 9.5){ roughness = 0.86; metallic = 0.0; }   // sand
    else { roughness = 0.66; metallic = 0.0; }

    /* Winkler estimation: metal-ish albedo with strong colour + upward faces */
    float lum = luma(albedo);
    if (roughness < 0.5 && lum < 0.12) roughness = 0.55;
    if (roughness < 0.5 && metallic > 0.1) roughness = 0.55;

    /* Cheap dielectric roughness from texture detail (or wool from luminance) */
    roughness = clamp(roughness + (0.5 - luma(albedo)) * 0.06, 0.16, 0.98);
    f0 = mix(0.04, 0.9, metallic);
}

/* GGX / Cook-Torrance ------------------------------------------------------------------ */
float D_GGX(float NoH, float a){
    float a2 = a * a;
    float d = NoH * NoH * (a2 - 1.0) + 1.0;
    return a2 / max(PI * d * d, 1e-5);
}

float V_SmithGGX(float NoV, float NoL, float a){
    float a2 = a * a;
    float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
    float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
    return 0.5 / max(gv + gl, 1e-5);
}

vec3 F_Schlick(vec3 f0, float VoH){
    return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
}

vec3 specularGGX(vec3 N, vec3 V, vec3 L, vec3 f0, float roughness){
    vec3 H = normalize(V + L);
    float NoV = max(dot(N, V), 1e-3);
    float NoL = saturate(dot(N, L));
    float NoH = saturate(dot(N, H));
    float VoH = saturate(dot(V, H));
    float a = max(roughness * roughness, 0.0035);
    float D = D_GGX(NoH, a);
    float Vis = V_SmithGGX(NoV, NoL, a);
    vec3 F = F_Schlick(f0, VoH);
    return D * Vis * F * NoL;
}

/* Oren-Nayar diffuse, softly wrapped for foliage */
float diffuseOrenNayar(vec3 N, vec3 V, vec3 L, float roughness){
    float NoL = dot(N, L);
    if (NoL <= 0.0) return 0.0;
    float NoV = max(dot(N, V), 1e-3);
    float s2 = roughness * roughness;
    float A = 1.0 - 0.5 * s2 / (s2 + 0.33);
    float B = 0.45 * s2 / (s2 + 0.09);
    vec3 Lp = normalize(L - N * NoL);
    vec3 Vp = normalize(V - N * NoV);
    float cosDelta = saturate(dot(Lp, Vp));
    float thetaL = acos(clamp(NoL, -1.0, 1.0));
    float thetaV = acos(clamp(NoV, -1.0, 1.0));
    return NoL * (A + B * cosDelta * sin(max(thetaL, thetaV)) * tan(min(thetaL, thetaV)));
}

/* Ambient / sky irradiance based on world normal + sky illumination */
vec3 skyAmbient(vec3 N, float rain){
    float upness = N.y * 0.5 + 0.5;
    float day = dayFactor();
    vec3 zenith = atmosphere(vec3(0.0, 1.0, 0.0), normalize(sunPosition), rain);
    vec3 horizon = atmosphere(normalize(vec3(N.x, 0.04, N.z) + 1e-4), normalize(sunPosition), rain);
    vec3 ground = vec3(0.055, 0.05, 0.042) * (0.35 + day);

    vec3 amb = mix(horizon, zenith, saturate(N.y * 1.2 + 0.25));
    amb = mix(amb, ground, saturate(-N.y * 1.4));
    /* Hemisphere bounce boost */
    amb *= mix(0.72, 1.18, upness);
    amb *= 0.72 + 0.28 * day;
    amb = mix(amb, amb * vec3(0.72, 0.75, 0.80), rain * 0.7);

    /* Moonlight keeps the night readable instead of pitch black */
    amb *= mix(2.15, 1.0, day);
    /* Golden hour: warm sky fill so the world does not fall off a cliff
       the moment the sun touches the horizon */
    amb += sunTint() * goldenHour() * 0.055;
    return amb;
}

/* ---------- point lights from hand / block light value ---------- */
vec3 blockLightColour(float blockLight){
    /* Vanilla block light is warm; soul fire is cyan. */
    vec3 warm = vec3(1.0, 0.62, 0.30);
    vec3 cool = vec3(0.35, 0.72, 1.0);
    vec3 c = mix(warm, cool, 0.0);
    return c * (blockLight * blockLight);
}

/* ---------- fake local lights from emissive geometry in screen space ---------- */
/* A 12-tap radial gather of emissive pixels, used to spill torch light on nearby
   geometry. Cheap, stable and view independent enough for cinematic look. */
vec3 gatherEmissiveLight(sampler2D emissiveTex, sampler2D depthTex, vec2 uv, vec3 worldPos, float radius){
    vec3 acc = vec3(0.0);
    float total = 0.0;
    const int TAPS = 12;
    for (int i = 0; i < TAPS; i++){
        float a = float(i) * 2.39996;
        float r = sqrt(float(i) + 0.5) / sqrt(float(TAPS));
        vec2 offset = vec2(cos(a), sin(a)) * r * radius / vec2(viewWidth, viewHeight);
        vec2 suv = uv + offset;
        vec3 emissive = texture2D(emissiveTex, suv).rgb;
        float d = texture2D(depthTex, suv).r;
        if (d >= 1.0) continue;
        vec4 vpos = gbufferProjectionInverse * vec4(vec3(suv, d) * 2.0 - 1.0, 1.0);
        vpos /= vpos.w;
        vec3 spos = (gbufferModelViewInverse * vpos).xyz + cameraPosition;
        vec3 delta = spos - worldPos;
        float dist2 = dot(delta, delta);
        float falloff = 1.0 / (1.0 + dist2 * 0.65);
        acc += emissive * falloff;
        total += falloff;
    }
    return acc / max(float(TAPS), 1.0) * 0.55;
}

/* ---------- main directional shading ---------- */
vec3 shadeSurface(
    vec3 albedo, vec3 N, vec3 V, vec3 worldPos,
    float roughness, float metallic, float f0base, float materialID,
    vec3 shadowScreen, float translucency, float dither, float cloudVis
){
    vec3 sunDir = normalize(sunPosition);
    vec3 keyDir = lightDirection();
    vec3 keyCol = lightColor();
    float NoL = saturate(dot(N, keyDir));

    /* Shadow */
    float shadow = 1.0;
    if (NoL > 0.0){
        shadow = getShadow(shadowScreen, translucency, dither, 1.0);
        float dist = length(worldPos - cameraPosition);
        shadow = mix(1.0, shadow, shadowDistanceFade(dist, SHADOW_DISTANCE));
        shadow *= cloudVis;
    }

    /* Diffuse: foliage gets wrap-lighting + translucency, rest uses Oren-Nayar */
    float diffuseTerm;
    if (materialID > 1.5 && materialID < 2.5){
        float wrap = saturate((dot(N, keyDir) + 0.35) / 1.35);
        float back = pow(saturate(dot(-N, keyDir)), 3.0) * 0.35;
        diffuseTerm = wrap + back;
    } else {
        diffuseTerm = diffuseOrenNayar(N, V, keyDir, roughness);
        diffuseTerm = mix(NoL, diffuseTerm, 0.65);
    }

    vec3 f0 = mix(vec3(f0base), albedo, metallic);
    vec3 spec = specularGGX(N, V, keyDir, f0, roughness);
    vec3 kD = (1.0 - f0) * (1.0 - metallic);

    vec3 direct = (albedo * diffuseTerm * kD + spec) * keyCol * shadow;

    /* Ambience */
    vec3 ambient = skyAmbient(N, rainStrength) * albedo;
    ambient *= mix(0.55, 1.0, saturate(roughness));
    /* Bounce light from the sun-lit ground */
    ambient += albedo * sunTint() * 0.10 * saturate(N.y) * dayFactor() * shadow;

    /* Time-of-day tint on indirect light */
    ambient *= mix(vec3(0.86, 0.92, 1.12), vec3(1.0), dayFactor());

    vec3 color = direct + ambient;

    /* Specular ambient (rough reflection of sky) */
    vec3 R = reflect(-V, N);
    float fres = fresnelSchlick(saturate(dot(N, V)), f0base);
    vec3 envRefl = atmosphere(normalize(R), sunDir, rainStrength);
    color += envRefl * fres * (1.0 - roughness) * mix(0.4, 1.0, dayFactor()) * 0.35;

    return color;
}

#endif
