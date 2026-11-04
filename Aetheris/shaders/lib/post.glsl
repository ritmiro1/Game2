/*
    Aetheris Shaders - post-processing helpers: bloom chain, AO, DOF, FXAA,
    vignette, sharpen, grain and letterbox-free cinematic finishing.
*/
#ifndef POST_GLSL
#define POST_GLSL

#include "/lib/common.glsl"

/* ---------- 9-tap gaussian (separable) ---------- */
vec3 blur9(sampler2D tex, vec2 uv, vec2 dir){
    vec2 px = dir / vec2(viewWidth, viewHeight);
    vec3 sum = texture2D(tex, uv).rgb * 0.2270270270;
    sum += texture2D(tex, uv + px * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(tex, uv - px * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(tex, uv + px * 3.2307692308).rgb * 0.0702702703;
    sum += texture2D(tex, uv - px * 3.2307692308).rgb * 0.0702702703;
    return sum;
}

/* ---------- bright pass ---------- */
vec3 brightPass(vec3 c){
    float l = luma(c);
    float knee = max(BLOOM_THRESHOLD * 0.55, 0.05);
    float soft = saturate(l - BLOOM_THRESHOLD + knee) / (2.0 * knee);
    soft = soft * soft * knee;
    float contrib = max(soft, l - BLOOM_THRESHOLD) / max(l, 1e-4);
    return c * contrib;
}

/* ---------- depth linearisation ---------- */
float linearDepth(float depth, mat4 projInv){
    vec4 v = projInv * vec4(0.0, 0.0, depth * 2.0 - 1.0, 1.0);
    return -v.z / v.w;
}

/* ---------- SSAO (hemisphere kernel in view space) ---------- */
float ssao(sampler2D depthTex, vec2 uv, vec3 viewPos, vec3 viewNormal, float dither){
#if SSAO_SAMPLES == 0
    return 1.0;
#else
    float radius = SSAO_RADIUS;
    float occlusion = 0.0;
    float angle = dither * TAU;

    for (int i = 0; i < 24; i++){
        if (i >= SSAO_SAMPLES) break;
        float fi = float(i);
        /* Cosine-weighted hemisphere sample using golden spiral */
        float phi = fi * 2.39996 + angle;
        float r = sqrt((fi + 0.5) / float(SSAO_SAMPLES)) * radius;
        /* Build tangent frame */
        vec3 up = abs(viewNormal.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(up, viewNormal));
        vec3 B = cross(viewNormal, T);
        vec3 dir = normalize(T * cos(phi) + B * sin(phi) + viewNormal * 0.65);
        vec3 samplePos = viewPos + dir * r;

        vec4 clip = gbufferProjection * vec4(samplePos, 1.0);
        vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
        if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;

        float sd = texture2D(depthTex, suv).r;
        if (sd >= 1.0) continue;
        vec4 sv = gbufferProjectionInverse * vec4(vec3(suv, sd) * 2.0 - 1.0, 1.0);
        float sampleDepth = -sv.z / sv.w;
        float rangeCheck = smoothstep(0.0, 1.0, radius / max(abs(viewPos.z - sampleDepth), 1e-3));
        occlusion += (sampleDepth < -samplePos.z - SSAO_BIAS ? 1.0 : 0.0) * rangeCheck;
    }
    occlusion /= float(SSAO_SAMPLES);
    /* Fade out with distance to avoid noise far away */
    float distFade = 1.0 - smoothstep(28.0, 90.0, length(viewPos));
    return saturate(1.0 - occlusion * SSAO_STRENGTH * 1.25 * distFade);
#endif
}

/* ---------- DOF (simple gather, configurable) ---------- */
vec3 depthOfField(sampler2D colorTex, sampler2D depthTex, vec2 uv, float centerDepth, float maxCoC){
#if DOF == 1
    float depth = texture2D(depthTex, uv).r;
    float dist = linearDepth(depth, gbufferProjectionInverse);
    float coc = saturate(abs(1.0 / max(dist, 0.1) - 1.0 / max(centerDepth, 0.1)) * maxCoC * DOF_STRENGTH * 30.0);
    if (coc < 0.02) return texture2D(colorTex, uv).rgb;
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    const int TAPS = 12;
    for (int i = 0; i < TAPS; i++){
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / float(TAPS));
        vec2 off = vec2(cos(a), sin(a)) * r * coc * 14.0 / vec2(viewWidth, viewHeight);
        acc += texture2D(colorTex, uv + off).rgb;
        wsum += 1.0;
    }
    return acc / wsum;
#else
    return texture2D(colorTex, uv).rgb;
#endif
}

/* ---------- FXAA (luma based, quality preset 12) ---------- */
vec3 fxaa(sampler2D colorTex, vec2 uv, float lumaThreshold){
    vec2 rcp = 1.0 / vec2(viewWidth, viewHeight);
    vec3 rgbM = texture2D(colorTex, uv).rgb;
    vec3 rgbNW = texture2D(colorTex, uv + vec2(-1.0, -1.0) * rcp).rgb;
    vec3 rgbNE = texture2D(colorTex, uv + vec2( 1.0, -1.0) * rcp).rgb;
    vec3 rgbSW = texture2D(colorTex, uv + vec2(-1.0,  1.0) * rcp).rgb;
    vec3 rgbSE = texture2D(colorTex, uv + vec2( 1.0,  1.0) * rcp).rgb;

    float lM = luma(rgbM), lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (lMax - lMin < lMax * 0.125) return rgbM;

    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
    float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * rcp;

    vec3 rgbA = 0.5 * (texture2D(colorTex, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
                       texture2D(colorTex, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(colorTex, uv + dir * -0.5).rgb +
                                     texture2D(colorTex, uv + dir * 0.5).rgb);
    float lB = luma(rgbB);
    return (lB < lMin || lB > lMax) ? rgbA : rgbB;
}

/* ---------- vignette + grain ---------- */
vec3 vignette(vec3 c, vec2 uv, float strength){
    vec2 q = uv - 0.5;
    q.x *= screenAspect();
    float v = 1.0 - dot(q, q) * strength * 0.85;
    return c * saturate(v);
}

float filmGrain(vec2 uv, float amount){
    float g = hash12(uv * vec2(viewWidth, viewHeight) + frameTimeCounter * 61.7) - 0.5;
    return g * amount;
}

vec3 sharpen(sampler2D tex, vec2 uv, float amount){
    if (amount <= 0.001) return texture2D(tex, uv).rgb;
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 c = texture2D(tex, uv).rgb;
    vec3 n = texture2D(tex, uv + vec2(0.0, px.y)).rgb;
    vec3 s = texture2D(tex, uv - vec2(0.0, px.y)).rgb;
    vec3 e = texture2D(tex, uv + vec2(px.x, 0.0)).rgb;
    vec3 w = texture2D(tex, uv - vec2(px.x, 0.0)).rgb;
    vec3 blur = (n + s + e + w) * 0.25;
    return c + (c - blur) * amount * 2.0;
}

#endif
