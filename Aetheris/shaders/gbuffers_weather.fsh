#version 120
/*
    Aetheris Shaders - rain / snow particles.
    Shaded here (the weather pass runs before deferred) and written with
    alpha < 1 so the deferred pass passes it through untouched.
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/lighting.glsl"

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 tint;
varying vec3 worldPos;

/* DRAWBUFFERS:0 */
void main(){
    vec4 texel = texture2D(gtexture, texcoord) * tint;
    if (texel.a < 0.04) discard;

    vec3 sunDir = normalize(sunPosition);
    float day = smoothstep(-0.12, 0.22, sunDir.y);

    /* Particles scatter light: bright against the sun, dim away from it */
    vec3 V = normalize(worldPos - cameraPosition);
    float fwd = pow(saturate(dot(V, sunDir)), 4.0);

    vec3 lightCol = mix(vec3(0.10, 0.14, 0.26), sunTint() * 1.15, day);
    vec3 ambient = skyAmbient(vec3(0.0, 1.0, 0.0), rainStrength) * 0.55;

    vec3 col = texel.rgb * (lightCol * (0.75 + fwd * 1.6) + ambient);
    /* Snow reads brighter, rain darker */
    col *= 1.0 - rainStrength * 0.22;
    col += lightCol * fwd * 0.12;

    gl_FragData[0] = vec4(col, 0.5);
}
