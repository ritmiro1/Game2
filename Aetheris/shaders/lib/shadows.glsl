/*
    Aetheris Shaders - shadow map sampling.
    PCF with a rotated Vogel disk, plus translucent (coloured) shadow support.
*/
#ifndef SHADOWS_GLSL
#define SHADOWS_GLSL

#include "/lib/common.glsl"

uniform sampler2D shadowtex1;     // opaque only

const vec2 VOGEL[16] = vec2[16](
    vec2( 0.0000,  0.0000), vec2(-0.3260, -0.4064), vec2(-0.8407,  0.0568),
    vec2(-0.1761,  0.7690), vec2( 0.2953, -0.5858), vec2( 0.7950,  0.4709),
    vec2( 0.9115, -0.0735), vec2( 0.0839, -0.9619), vec2(-0.6832, -0.6648),
    vec2(-0.9391,  0.3283), vec2(-0.5596,  0.8287), vec2( 0.2179,  0.9724),
    vec2( 0.9875,  0.1573), vec2( 0.5141, -0.8576), vec2(-0.3492, -0.9371),
    vec2(-0.9652, -0.2597)
);

/* Radial pre-filter towards the player would go here; kept linear for stability
   across Iris / OptiFine shadow-matrix handling. */

/*
    shadowScreen : shadow clip space position, xyz/w
    translucent  : 0 for opaque emitters, >0 for water/glass (uses tinted shadow)
    dither       : per-pixel random value for PCF rotation
    softness     : extra penumbra multiplier (1.0 = default)
*/
float getShadow(vec3 shadowScreen, float translucent, float dither, float softness){
    if (shadowScreen.x < 0.0 || shadowScreen.x > 1.0 ||
        shadowScreen.y < 0.0 || shadowScreen.y > 1.0 ||
        shadowScreen.z > 1.0 || shadowScreen.z < 0.0) return 1.0;

    float bias = 0.00028 + 0.0012 * translucent;
    float radius = (1.0 / float(SHADOW_RESOLUTION)) * 1.5 * SHADOW_SOFTNESS * softness;

    float angle = dither * TAU;
    float sa = sin(angle), ca = cos(angle);
    mat2 rot = mat2(ca, -sa, sa, ca);

    float sum = 0.0;
    for (int i = 0; i < 16; i++){
        if (i >= SHADOW_SAMPLES) break;
        vec2 offset = (rot * VOGEL[i]) * radius;
        float depth = texture2D(shadowtex1, shadowScreen.xy + offset).r;
        sum += step(shadowScreen.z - bias, depth);
    }
    float visibility = sum / float(SHADOW_SAMPLES);

    /* Thin geometry gaps: soften core shadows slightly */
    visibility = mix(visibility, 1.0, SHADOW_FADE * 0.0);

    /* Translucent geometry keeps more light than opaque geometry */
    if (translucent > 0.001){
        float soft = 0.65 + 0.35 * visibility;
        visibility = mix(visibility, soft, saturate(translucent) * 0.45);
    }
    return saturate(visibility);
}

/* Global shadow distance falloff, hides the shadow-map border seam. */
float shadowDistanceFade(float distFromCamera, float distLimit){
    return 1.0 - smoothstep(distLimit * (1.0 - SHADOW_FADE), distLimit, distFromCamera);
}

#endif
