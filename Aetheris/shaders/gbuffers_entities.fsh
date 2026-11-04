#version 120
/*
    Aetheris Shaders - entity fragment stage (also used for block entities).
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

/* DRAWBUFFERS:012 */

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;

void main(){
    vec4 albedo = texture2D(gtexture, texcoord) * tint;
    if (albedo.a < 0.06) discard;

    vec3 linear = srgb2rgb(albedo.rgb);
    vec3 normal = normalize(worldNormal);
    float detail = vnoise(texcoord * 22.0) - 0.5;
    normal = normalize(normal + vec3(detail, 0.0, -detail) * 0.04);

    /* Blaze, magma cube, glow squid style self-illumination */
    float emissive = saturate((linear.r - max(linear.g, linear.b)) * 1.6 - 0.35) * EMISSIVE_STRENGTH;

    gl_FragData[0] = vec4(linear, 1.0);
    gl_FragData[1] = vec4(normal * 0.5 + 0.5, materialID / 255.0);
    gl_FragData[2] = vec4(clamp(lmcoord, 0.0, 1.0), emissive, 0.0);
}
