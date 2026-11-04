#version 120
/*
    Aetheris Shaders - composite pass 3.
    Multi-radius bloom: bright pass + Poisson-disk gather at three scales.
    DRAWBUFFERS:0
*/
#include "/lib/settings.glsl"
#include "/lib/post.glsl"
#include "/lib/sky.glsl"

uniform sampler2D colortex0;

/* 12-point Poisson disk, three scales */
const vec2 POISSON[12] = vec2[12](
    vec2(-0.326, -0.406), vec2(-0.840,  0.056), vec2(-0.696,  0.457),
    vec2(-0.203,  0.621), vec2( 0.962, -0.195), vec2( 0.473, -0.480),
    vec2( 0.519,  0.767), vec2( 0.185, -0.893), vec2( 0.507,  0.064),
    vec2( 0.896,  0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598)
);

varying vec2 texcoord;

void main(){
    vec2 uv = texcoord;
    vec3 color = texture2D(colortex0, uv).rgb;

#if BLOOM == 1
    vec3 bloom = vec3(0.0);
    vec2 texel = 1.0 / vec2(viewWidth, viewHeight);

    /* three blur scales: tight glow, medium haze, wide cinematic bleed */
    for (int pass = 0; pass < 3; pass++){
        float scale = 2.5;
        float w = 0.45;
        if (pass == 1){ scale = 9.0;  w = 0.35; }
        if (pass == 2){ scale = 26.0; w = 0.20; }

        vec3 acc = vec3(0.0);
        for (int i = 0; i < 12; i++){
            vec2 off = POISSON[i] * texel * scale;
            acc += brightPass(texture2D(colortex0, uv + off).rgb);
        }
        bloom += acc / 12.0 * w;
    }

    /* Tint the glow with the ambient light colour for a filmic look */
    float day = dayFactor();
    vec3 bloomTint = mix(vec3(0.75, 0.85, 1.15), vec3(1.06, 1.0, 0.94), day);
    color += bloom * BLOOM_STRENGTH * bloomTint;
#endif

    gl_FragData[0] = vec4(color, 1.0);
}
