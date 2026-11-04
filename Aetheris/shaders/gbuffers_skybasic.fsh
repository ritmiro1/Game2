#version 120
/*
    Aetheris Shaders - procedural sky.
    Full HDR atmosphere, sun & moon discs, stars, Milky Way and volumetric clouds.
*/
#include "/lib/settings.glsl"
#include "/lib/sky.glsl"

varying vec3 viewDir;

/* DRAWBUFFERS:0 */
void main(){
    vec3 dir = normalize(viewDir);
    if (dot(dir, dir) < 1e-6) dir = vec3(0.0, 1.0, 0.0);

    float rain = rainStrength;
    vec3 col = renderSky(dir, rain);

    /* Eye-in-water tint (looking up from below the surface) */
    if (isEyeInWater == 1){
        col = mix(col, vec3(0.02, 0.09, 0.13), 0.88);
    }

    gl_FragData[0] = vec4(col, 1.0);
}
