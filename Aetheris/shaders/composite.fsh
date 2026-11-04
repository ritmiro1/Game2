#version 120
/*
    Aetheris Shaders - composite pass 1.
    Screen-space volumetric light (god rays), underwater absorption and
    close-range fog refinement.      DRAWBUFFERS:0
*/
#include "/lib/settings.glsl"
#include "/lib/post.glsl"
#include "/lib/volumetric.glsl"
#include "/lib/sky.glsl"

uniform sampler2D colortex0;
uniform sampler2D depthtex1;

varying vec2 texcoord;

void main(){
    vec2 uv = texcoord;
    float depth = texture2D(depthtex1, uv).r;
    vec3 color = texture2D(colortex0, uv).rgb;
    float dither = hash12(gl_FragCoord.xy + frameTimeCounter * 3.1);

    if (depth < 1.0){
        vec4 view = gbufferProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
        vec3 viewPos = view.xyz / view.w;              /* negative z = forward */
        vec3 sunView = normalize(mat3(gbufferModelView) * normalize(sunPosition));
        color += volumetricLight(uv, viewPos, sunView, dither, rainStrength);
    } else {
        /* Sky: a faint halo of atmosphere in front of the sun */
        vec3 sunView = normalize(mat3(gbufferModelView) * normalize(sunPosition));
        vec3 viewDir = normalize(vec3(uv * 2.0 - 1.0, -1.0));
        float align = saturate(dot(viewDir, sunView));
        color += sunTint() * pow(align, 90.0) * 0.05 * dayFactor();
    }

    /* Thunder flash */
    if (rainStrength > 0.85 && hash12(vec2(worldDay, floor(frameTimeCounter * 6.0))) > 0.985){
        color += vec3(0.35, 0.42, 0.62) * 0.8;
    }

    gl_FragData[0] = vec4(color, 1.0);
}
