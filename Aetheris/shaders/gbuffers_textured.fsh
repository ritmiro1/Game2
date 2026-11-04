#version 120
/*
    Aetheris Shaders - textured fallback (particles, nametags, block destroy overlay).
    Uses the same G-buffer layout as terrain so it is lit correctly.
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float partID;

/* DRAWBUFFERS:012 */
void main(){
    vec4 albedo = texture2D(gtexture, texcoord) * tint;
    if (albedo.a < 0.04) discard;

    vec3 normal = normalize(worldNormal);
    if (dot(normal, normal) < 0.5) normal = vec3(0.0, 1.0, 0.0);

    /* partID 1 == block destroy overlay: keep it marked as translucent-ish
       so the deferred pass does not double-darken it */
    float material = (partID > 0.5) ? 0.0 : 0.0;

    gl_FragData[0] = vec4(srgb2rgb(albedo.rgb), 1.0);
    gl_FragData[1] = vec4(normal * 0.5 + 0.5, material / 255.0);
    gl_FragData[2] = vec4(clamp(lmcoord, 0.0, 1.0), 0.0, 0.0);
}
