#version 120
/*
    Aetheris Shaders - vanilla cloud rendering, relit.
    Adds scattering, silver lining, moon tinting and rain darkening on top of the
    vanilla cloud geometry so the pack still shows clouds on every quality level.
*/
#include "/lib/settings.glsl"
#include "/lib/sky.glsl"

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 tint;
varying vec3 worldPos;

/* DRAWBUFFERS:0 */
void main(){
    vec4 texel = texture2D(gtexture, texcoord);
    if (texel.a < 0.05) discard;

    vec3 sunDir = normalize(sunPosition);
    vec3 V = normalize(worldPos - cameraPosition);
    float day = dayFactor();

    /* Simple forward scatter: clouds near the sun are bright and warm */
    float mu = saturate(dot(V, sunDir));
    float scatter = pow(mu, 6.0) * 0.6 + 0.4;

    vec3 lit = mix(moonTint() * 0.09, sunTint() * 1.35, day) * scatter;
    vec3 ambient = mix(vec3(0.05, 0.07, 0.12), vec3(0.45, 0.55, 0.72), day);
    ambient *= 0.5 + 0.5 * (1.0 - mu);

    vec3 col = (lit + ambient) * tint.rgb;
    col = mix(col, col * vec3(0.62, 0.65, 0.72), rainStrength * 0.8);
    col *= mix(vec3(1.0), sunTint() * 1.2, goldenHour() * 0.5);

    /* Fade the cloud shell into atmosphere at the horizon */
    float horizonFade = smoothstep(0.0, 0.16, abs(V.y));
    col = mix(atmosphere(normalize(vec3(V.x, 0.02, V.z)), sunDir, rainStrength), col, horizonFade);

    gl_FragData[0] = vec4(col, texel.a * tint.a);
}
