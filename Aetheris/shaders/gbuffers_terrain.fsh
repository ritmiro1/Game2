#version 120
/*
    Aetheris Shaders - terrain fragment stage.
    Writes: colortex0 = albedo, colortex1 = encoded normal + material id,
            colortex2 = lightmap + emissive mask (used by deferred).
    Lighting itself happens in deferred/composite.
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

/* DRAWBUFFERS:012 */

uniform sampler2D gtexture;
uniform sampler2D lightmap;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;
varying float blockID;

/* emissive strength per material family */
float emissiveMask(float mat, vec3 albedo){
    if (mat > 3.5 && mat < 4.5) return 1.0;
    /* lava-like saturated orange surfaces also glow a bit */
    float orangeness = saturate((albedo.r - max(albedo.g, albedo.b)) * 2.4);
    return saturate(orangeness * 0.35);
}

void main(){
    vec4 albedo = texture2D(gtexture, texcoord) * tint;

    if (albedo.a < 0.08) discard;

    vec3 albedoLinear = srgb2rgb(albedo.rgb);
    vec3 normal = normalize(worldNormal);

    /* micro-detail normal jitter for a less plastic surface */
    float detail = vnoise(texcoord * 28.0) - 0.5;
    vec3 nJitter = normalize(normal + vec3(detail, detail, 0.0) * 0.055);

    float emission = emissiveMask(materialID, albedoLinear) * EMISSIVE_STRENGTH;

    /* Handheld lightmap is applied here so held torches illuminate terrain */
    vec2 lm = lmcoord;
    lm = clamp(lm, 0.0, 1.0);

    gl_FragData[0] = vec4(albedoLinear, 1.0);
    gl_FragData[1] = vec4(nJitter * 0.5 + 0.5, materialID / 255.0);
    /* r = block light, g = sky light, b = emissive amount, a = wetness mask */
    gl_FragData[2] = vec4(lm.x, lm.y, saturate(emission), 0.0);
}
