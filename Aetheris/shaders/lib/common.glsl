/*
    Aetheris Shaders - common math, hashing, color and encoding helpers.
    Included by every pass.
*/
#ifndef COMMON_GLSL
#define COMMON_GLSL

#include "/lib/settings.glsl"

/* ---------- shared uniforms (declared once, guarded) ---------- */
uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjection;
uniform mat4 gbufferProjectionInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowModelViewInverse;
uniform mat4 shadowProjection;

uniform vec3 cameraPosition;
uniform vec3 previousCameraPosition;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform vec3 shadowLightPosition;
uniform vec3 upPosition;
uniform vec3 fogColor;
uniform vec3 skyColor;

uniform float sunAngle;
uniform float worldTime;
uniform float worldDay;
uniform float frameTimeCounter;
uniform float rainStrength;
uniform float wetness;
uniform float viewWidth;
uniform float viewHeight;
uniform float near;
uniform float far;
uniform float eyeAltitude;
uniform float blindness;
uniform float nightVision;
uniform float screenBrightness;
uniform int moonPhase;
uniform int isEyeInWater;
uniform int heldBlockLightValue;
uniform int heldItemId;


const float PI  = 3.14159265359;
const float TAU = 6.28318530718;
const float EPS = 1e-5;

/* ---------- small utils ---------- */
float saturate(float x){ return clamp(x, 0.0, 1.0); }
vec2  saturate(vec2 x){ return clamp(x, vec2(0.0), vec2(1.0)); }
vec3  saturate(vec3 x){ return clamp(x, vec3(0.0), vec3(1.0)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sqr(float x){ return x * x; }
vec3  rgb2srgb(vec3 c){ return pow(max(c, vec3(0.0)), vec3(1.0/2.2)); }
vec3  srgb2rgb(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }

#include "/lib/noise.glsl"

/* ---------- dielectrics / fresnel ---------- */
float fresnelSchlick(float cosTheta, float f0){
    return f0 + (1.0 - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}

float fresnelWater(float cosTheta){
    return fresnelSchlick(cosTheta, 0.02);
}

/* ---------- tonemapping ---------- */
vec3 tonemapACES(vec3 x){
    /* Narkowicz approximation of the ACES RRT+ODT curve */
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

/*
    ACES alone desaturates bright colours (the sunlit sky turns white). Blend it
    with a luminance-preserving variant so highlights keep their hue.
*/
vec3 tonemapACEHue(vec3 c){
    vec3 perChannel = tonemapACES(c);
    float l = luma(c);
    float mappedLuma = tonemapACES(vec3(l)).x;
    vec3 hueKept = min(c * (mappedLuma / max(l, 1e-4)), vec3(1.0));
    return mix(perChannel, hueKept, 0.55);
}

vec3 tonemapReinhard(vec3 x){ return x / (1.0 + luma(x)); }

vec3 tonemapAgX(vec3 c){
    /* AgX-ish log-sigmoid curve, simplified */
    const mat3 agxIn = mat3(0.8424, 0.0784, 0.0796,
                            0.0784, 0.8424, 0.0796,
                            0.0796, 0.0796, 0.8424);
    c = agxIn * c;
    c = clamp((log2(max(c, 1e-4)) + 12.47393) / 16.5, 0.0, 1.0);
    c = c * c * (3.0 - 2.0 * c);
    return saturate(c);
}

vec3 tonemap(vec3 c){
    #if TONEMAP_CURVE == 0
        return tonemapReinhard(c);
    #elif TONEMAP_CURVE == 2
        return tonemapAgX(c);
    #elif TONEMAP_CURVE == 3
        return c / (1.0 + c); // simple extended reinhard
    #else
        return tonemapACEHue(c);
    #endif
}

/* ---------- color grading ---------- */
vec3 contrastCurve(vec3 c, float amount){
    return clamp((c - 0.5) * amount + 0.5, 0.0, 1.0);
}

vec3 applySaturation(vec3 c, float s){
    return mix(vec3(luma(c)), c, s);
}

vec3 liftGammaGain(vec3 c, vec3 lift, vec3 gain){
    return c * gain + lift * (1.0 - c);
}

vec3 grade(vec3 c, vec3 sunDir){
    /* Warm highlights / cool shadows split toning */
    float l = luma(c);
    float shadowW = 1.0 - smoothstep(0.0, 0.45, l);
    float highW   = smoothstep(0.45, 1.0, l);
    vec3 coolShadows = vec3(-0.012, 0.004, 0.030);
    vec3 warmHighs   = vec3(0.030, 0.011, -0.016);
    c += coolShadows * shadowW + warmHighs * highW;
    c = applySaturation(c, SATURATION);
    c = contrastCurve(c, CONTRAST);
    /* white balance */
    c.r *= 1.0 + WHITE_BALANCE * 0.35;
    c.b *= 1.0 - WHITE_BALANCE * 0.35;
    return saturate(c);
}

/* ---------- dither ---------- */
float bayer4(vec2 p){
    const float m[16] = float[16](0.0, 8.0, 2.0, 10.0,
                                  12.0, 4.0, 14.0, 6.0,
                                  3.0, 11.0, 1.0, 9.0,
                                  15.0, 7.0, 13.0, 5.0);
    ivec2 i = ivec2(mod(p, 4.0));
    return m[i.y * 4 + i.x] / 16.0 - 0.5;
}

/* ---------- encoding for intermediate buffers ---------- */
vec4 encodeData(vec3 normal, float material){
    return vec4(normal * 0.5 + 0.5, material / 255.0);
}

vec3 decodeNormal(vec4 data){
    return normalize(data.xyz * 2.0 - 1.0);
}

float decodeMaterial(vec4 data){ return floor(data.w * 255.0 + 0.5); }

/* ---------- misc ---------- */
vec3 safeNormalize(vec3 v){ return v / max(length(v), 1e-5); }

float screenAspect(){ return viewWidth / max(viewHeight, 1.0); }

#endif
