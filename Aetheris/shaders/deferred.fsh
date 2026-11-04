#version 120
/*
    Aetheris Shaders - deferred PBR lighting pass.

    Inputs : colortex0 albedo, colortex1 normal+material, colortex2 lightmap/emissive,
             depthtex0/depthtex1
    Outputs: colortex0 = fully lit HDR colour, colortex3.r = ambient occlusion
*/
#include "/lib/settings.glsl"
#include "/lib/lighting.glsl"
#include "/lib/volumetric.glsl"
#include "/lib/post.glsl"

/* DRAWBUFFERS:0 */

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D depthtex1;

vec3 reconstructWorld(vec2 uv, float depth){
    vec4 view = gbufferProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
    view /= view.w;
    return (gbufferModelViewInverse * view).xyz + cameraPosition;
}

/* Radial gather of emissive pixels -> local torch spill */
vec3 emissiveSpill(vec2 uv, vec3 worldPos, float radius, float dither){
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    const int TAPS = 12;
    for (int i = 0; i < TAPS; i++){
        float a = float(i) * 2.39996 + dither * TAU;
        float r = sqrt((float(i) + 0.5) / float(TAPS));
        vec2 off = vec2(cos(a), sin(a)) * r * radius / vec2(viewWidth, viewHeight);
        vec2 suv = uv + off;
        vec3 em = texture2D(colortex2, suv).b * texture2D(colortex0, suv).rgb;
        if (luma(em) < 0.002) continue;
        float d = texture2D(depthtex1, suv).r;
        if (d >= 1.0) continue;
        vec3 p = reconstructWorld(suv, d);
        vec3 delta = p - worldPos;
        float dist2 = dot(delta, delta);
        float w = 1.0 / (1.0 + dist2 * 0.55);
        acc += em * w;
        wsum += w;
    }
    return acc * 1.1;
}

varying vec2 texcoord;

void main(){
    vec2 uv = texcoord;
    float depth = texture2D(depthtex1, uv).r;
    if (depth >= 1.0){
        /* sky and cloud pixels are already HDR-lit by their gbuffers */
        gl_FragData[0] = vec4(texture2D(colortex0, uv).rgb, 1.0);
        return;
    }

    vec4 surface = texture2D(colortex0, uv);
    vec3 albedo = surface.rgb;

    /* Anything that shaded itself (water, weather, glass) is marked with
       alpha < 1.0 and is passed through untouched. */
    if (surface.a < 0.99){
        gl_FragData[0] = vec4(albedo, 1.0);
        return;
    }

    vec4 data = texture2D(colortex1, uv);
    vec3 normal = decodeNormal(data);
    float materialID = decodeMaterial(data);
    vec4 lightData = texture2D(colortex2, uv);
    vec2 lm = lightData.rg;
    float emissive = lightData.b;

    vec3 worldPos = reconstructWorld(uv, depth);
    vec3 V = normalize(cameraPosition - worldPos);
    vec3 sunDir = normalize(sunPosition);
    float dither = hash12(gl_FragCoord.xy + frameTimeCounter * 7.0);

    /* View-space normal / position for AO */
    vec4 viewPos4 = gbufferProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
    vec3 viewPos = viewPos4.xyz / viewPos4.w;
    vec3 viewNormal = normalize(mat3(gbufferModelView) * normal);

    float ao = ssao(depthtex1, uv, viewPos, viewNormal, dither);

    /* Shadow lookup */
    vec4 shadowClip = shadowProjection * (shadowModelView * vec4(worldPos, 1.0));
    vec3 shadowScreen = shadowClip.xyz / shadowClip.w * 0.5 + 0.5;
    float translucency = (materialID > 6.5) ? 0.5 : 0.0;

    float roughness, metallic, f0;
    materialProperties(albedo, materialID, normal, roughness, metallic, f0);

    float cloudVis = cloudShadow(worldPos, sunDir);
    vec3 color = shadeSurface(albedo, normal, V, worldPos, roughness, metallic, f0,
                              materialID, shadowScreen, translucency, dither, cloudVis);

    /* Ambient occlusion on indirect light only */
    color *= mix(1.0, ao, 0.85);

    /* Block light (torches, lava, glowstone in the world) */
    float blockLight = clamp(lm.x, 0.0, 1.0);
    /* Light carried in hand spills a little onto nearby surfaces */
    float heldLight = float(heldBlockLightValue) / 15.0;
    float distToPlayer = length(worldPos - cameraPosition);
    blockLight = max(blockLight, heldLight * heldLight * (1.0 - smoothstep(2.0, 7.0, distToPlayer)));
    vec3 torchCol = vec3(1.0, 0.60, 0.28) * pow(blockLight, 2.0) * 1.45;
    torchCol = mix(torchCol, vec3(0.35, 0.75, 1.0) * pow(blockLight, 2.0), 0.0);
    color += albedo * torchCol * (0.9 + 0.1 * normal.y);

    /* Sky light from the lightmap value (caves stay dark) */
    float skyLight = clamp(lm.y, 0.0, 1.0);
    color *= mix(vec3(0.055, 0.06, 0.075), vec3(1.0), smoothstep(0.0, 1.0, skyLight));

    /* Emissive geometry (lava, glowstone, torches) */
    color += albedo * emissive * 5.0 * EMISSIVE_STRENGTH;

    /* Local spill light from nearby emissive surfaces. Weighted down where the
       lightmap already gives us block light so surfaces are not double-lit. */
    vec3 spill = emissiveSpill(uv, worldPos, 14.0, dither);
    color += albedo * spill * 1.35 * EMISSIVE_STRENGTH * (1.0 - blockLight * 0.75);

    /* Underwater: absorb the scene */
    if (isEyeInWater == 1){
        vec3 absorb = vec3(0.42, 0.13, 0.09);
        color *= exp(-absorb * 0.85);
        color += vec3(0.02, 0.08, 0.11);
    }

    /* Aerial perspective */
    float dist = length(worldPos - cameraPosition);
    vec3 dir = normalize(worldPos - cameraPosition);
    color = applyFog(color, dir, dist, sunDir, rainStrength);

    gl_FragData[0] = vec4(color, 1.0);
}
