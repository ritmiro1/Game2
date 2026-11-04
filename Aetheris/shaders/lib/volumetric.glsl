/*
    Aetheris Shaders - screen-space volumetric light (god rays) + cloud shadowing.
*/
#ifndef VOLUMETRIC_GLSL
#define VOLUMETRIC_GLSL

#include "/lib/common.glsl"

uniform sampler2D depthtex0;

float rainAttenuation(float rain){ return mix(1.0, 0.55, rain); }

vec3 keyLightColour(){
    vec3 sunDir = normalize(sunPosition);
    float h = saturate(sunDir.y);
    vec3 horizon = vec3(1.0, 0.40, 0.14);
    vec3 noon    = vec3(1.0, 0.96, 0.90);
    vec3 c = mix(horizon, noon, smoothstep(0.0, 0.45, h));
    return c * 2.6;
}

/*
    March along the view ray toward the sun and accumulate in-scattering.
    viewPos   : view-space position of the fragment (negative z forward)
    sunViewDir: sun direction in view space (already negated where needed)
*/
vec3 volumetricLight(vec2 uv, vec3 viewPos, vec3 sunViewDir, float dither, float rain){
#if VOLUMETRIC_LIGHT == 0
    return vec3(0.0);
#else
    float dayW = saturate(smoothstep(-0.10, 0.18, sunPosition.y));
    if (dayW <= 0.001) return vec3(0.0);

    float sunFacing = saturate(dot(normalize(viewPos), sunViewDir) * 0.5 + 0.55);
    float sceneDepth = length(viewPos);
    float marchLen = min(sceneDepth, 130.0);

    float steps = float(VOLUMETRIC_STEPS);
    float jitter = dither * (1.0 / steps);

    vec3 acc = vec3(0.0);
    float transmittance = 1.0;

    for (int i = 0; i < 32; i++){
        if (i >= VOLUMETRIC_STEPS) break;
        float f = (float(i) + jitter) / steps;
        float t = marchLen * f * f;               // quadratically spaced samples
        vec3 sampleView = normalize(viewPos) * t;
        vec4 clip = gbufferProjection * vec4(sampleView, 1.0);
        vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
        float sd = texture2D(depthtex0, suv).r;
        float sampleDepth = 1e6;
        if (sd < 1.0){
            vec4 sv = gbufferProjectionInverse * vec4(vec3(suv, sd) * 2.0 - 1.0, 1.0);
            sampleDepth = -sv.z / sv.w;
        }
        float visible = (t < sampleDepth - 0.08) ? 1.0 : 0.0;

        float d = t * 0.0125;
        float density = 0.55 + 0.45 * vnoise3(vec3(suv * 14.0, t * 0.08 + frameTimeCounter * 0.05));
        float stepT = exp(-d * density);
        acc += keyLightColour() * visible * density * (1.0 - stepT) * transmittance;
        transmittance *= stepT;
    }

    float phase = 0.35 + 0.65 * pow(saturate(sunFacing), 3.0);
    acc *= phase * 0.055 * VOLUMETRIC_STRENGTH * rainAttenuation(rain) * dayW;
    return acc;
#endif
}


#endif
