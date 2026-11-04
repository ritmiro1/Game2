#version 120
/*
    Aetheris Shaders - final output pass.
    Sharpen -> exposure -> ACES tonemap -> cinematic grade -> vignette ->
    FXAA -> sRGB encode -> ordered dither.  DRAWBUFFERS:0
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/post.glsl"

uniform sampler2D colortex0;
uniform sampler2D depthtex1;

varying vec2 texcoord;

/* Full grading chain for a single HDR sample (no vignette / no sharpen). */
vec3 finish(vec3 hdr){
    hdr *= EXPOSURE;
    vec3 mapped = tonemap(hdr);
    mapped = grade(mapped, normalize(sunPosition));
    return mapped;
}

/* FXAA operating on the finished (LDR) image */
vec3 fxaaPass(vec2 uv){
    vec2 rcp = 1.0 / vec2(viewWidth, viewHeight);
    vec3 rgbM  = finish(texture2D(colortex0, uv).rgb);
    vec3 rgbNW = finish(texture2D(colortex0, uv + vec2(-1.0, -1.0) * rcp).rgb);
    vec3 rgbNE = finish(texture2D(colortex0, uv + vec2( 1.0, -1.0) * rcp).rgb);
    vec3 rgbSW = finish(texture2D(colortex0, uv + vec2(-1.0,  1.0) * rcp).rgb);
    vec3 rgbSE = finish(texture2D(colortex0, uv + vec2( 1.0,  1.0) * rcp).rgb);

    float lM  = luma(rgbM);
    float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));

    /* Flat area: no edge to smooth */
    if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;

    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * rcp;

    vec3 rgbA = 0.5 * (finish(texture2D(colortex0, uv + dir * (1.0 / 3.0 - 0.5)).rgb) +
                       finish(texture2D(colortex0, uv + dir * (2.0 / 3.0 - 0.5)).rgb));
    vec3 rgbB = rgbA * 0.5 + 0.25 * (finish(texture2D(colortex0, uv + dir * -0.5).rgb) +
                                     finish(texture2D(colortex0, uv + dir * 0.5).rgb));
    float lB = luma(rgbB);
    if (lB < lMin || lB > lMax) return rgbA;
    return rgbB;
}

void main(){
    vec2 uv = texcoord;

    /* --- sharpen in linear HDR space --- */
    vec3 hdr = texture2D(colortex0, uv).rgb;
#if SHARPEN > 0.0
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 n = texture2D(colortex0, uv + vec2(0.0, px.y)).rgb;
    vec3 s = texture2D(colortex0, uv - vec2(0.0, px.y)).rgb;
    vec3 e = texture2D(colortex0, uv + vec2(px.x, 0.0)).rgb;
    vec3 w = texture2D(colortex0, uv - vec2(px.x, 0.0)).rgb;
    vec3 blur = (n + s + e + w) * 0.25;
    hdr += (hdr - blur) * SHARPEN * 2.0;
#endif

    /* --- underwater absorption, applied before tone mapping --- */
    if (isEyeInWater == 1){
        hdr *= vec3(0.62, 0.86, 1.0);
        hdr = mix(hdr, vec3(0.02, 0.07, 0.10), 0.28);
    }

    /* --- base tone mapping + grading, or anti-aliased variant --- */
    vec3 mapped;
#if FXAA == 1
    mapped = fxaaPass(uv);
#else
    mapped = finish(hdr);
#endif

    /* --- vignette --- */
    mapped = vignette(mapped, uv, VIGNETTE);

    vec3 outColor = rgb2srgb(mapped);

#if DITHER == 1
    outColor += bayer4(gl_FragCoord.xy) / 255.0;
#endif

    gl_FragData[0] = vec4(outColor, 1.0);
}
