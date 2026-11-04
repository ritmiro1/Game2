#version 120
/*
    Aetheris Shaders - composite pass 2.
    Procedural lens flare: aperture ghosts + halo streaks along the sun axis.
    Screen-space, occluded by geometry depth.      DRAWBUFFERS:0
*/
#include "/lib/settings.glsl"
#include "/lib/post.glsl"
#include "/lib/sky.glsl"

uniform sampler2D colortex0;
uniform sampler2D depthtex1;

/* Sun position in screen space with an occlusion test */
vec3 sunScreenPosition(out float visible){
    vec4 clip = gbufferProjection * gbufferModelView * vec4(normalize(sunPosition) * 100.0, 0.0);
    vec2 uv = clip.xy / max(clip.w, 1e-4) * 0.5 + 0.5;
    visible = 0.0;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(uv, 0.0);
    /* Occlusion: compare the sun's screen depth with the scene depth */
    float sceneDepth = texture2D(depthtex1, uv).r;
    float sunDepth = texture2D(depthtex1, uv).r;
    visible = (sceneDepth >= 1.0) ? 1.0 : 0.0;
    /* Soft edge when the sun is near the frame border */
    visible *= smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x)
             * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
    return vec3(uv, sunDepth);
}

varying vec2 texcoord;

void main(){
    vec2 uv = texcoord;
    vec3 color = texture2D(colortex0, uv).rgb;

    float visible;
    vec3 sPos = sunScreenPosition(visible);
    if (visible > 0.001 && sunPosition.y > -0.05){
        vec2 sunUV = sPos.xy;
        vec2 axis = uv - sunUV;
        float dist = length(axis * vec2(screenAspect(), 1.0));

        /* Aperture ghosts mirrored through the frame centre */
        float ghosts = 0.0;
        vec3 ghostTint = vec3(0.0);
        for (int i = 0; i < 4; i++){
            float scale = -0.35 - float(i) * 0.42;
            vec2 gUV = sunUV + axis * scale;
            float g = exp(-pow(length((gUV - sunUV) * vec2(screenAspect(), 1.0)) * 6.0, 2.0));
            float shape = smoothstep(0.06, 0.0, length(gUV - sunUV) - 0.02 * float(i + 1));
            ghosts += g * shape;
            ghostTint += mix(vec3(0.9, 0.6, 0.3), vec3(0.35, 0.6, 1.0), float(i) / 3.0) * g * shape;
        }

        /* Anamorphic streak */
        float streak = exp(-abs(axis.y) * 260.0) * exp(-abs(axis.x) * 2.2) * 0.5;

        /* Halo ring */
        float halo = exp(-pow((dist - 0.42) * 7.0, 2.0)) * 0.25;

        vec3 flare = (ghostTint * 0.035 + sunTint() * (streak * 0.30 + halo * 0.15)) * visible * SUN_GLOW;
        color += flare;
    }

    gl_FragData[0] = vec4(color, 1.0);
}
