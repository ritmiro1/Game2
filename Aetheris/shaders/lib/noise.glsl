/*
    Aetheris Shaders - hashing + procedural noise.
    Original implementations (integer-free hash, value noise, fbm, worley).
*/
#ifndef NOISE_GLSL
#define NOISE_GLSL

float hash11(float p){
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float hash13(vec3 p){
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

/* value noise 2D in [0,1] */
float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/* value noise 3D in [0,1] */
float vnoise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
               mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

float fbm2(vec2 p, int octaves){
    float v = 0.0, a = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++){
        if (i >= octaves) break;
        v += a * vnoise(p);
        norm += a;
        p = p * 2.03 + vec2(17.1, 9.3);
        a *= 0.5;
    }
    return v / max(norm, 1e-4);
}

float fbm3(vec3 p, int octaves){
    float v = 0.0, a = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++){
        if (i >= octaves) break;
        v += a * vnoise3(p);
        norm += a;
        p = p * 2.02 + vec3(9.7, 3.1, 5.5);
        a *= 0.5;
    }
    return v / max(norm, 1e-4);
}

/* Worley / cellular noise, F1 distance */
float worley2(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float best = 8.0;
    for (int y = -1; y <= 1; y++){
        for (int x = -1; x <= 1; x++){
            vec2 g = vec2(float(x), float(y));
            vec2 o = hash22(i + g);
            best = min(best, length(g + o - f));
        }
    }
    return best;
}

/* billowy cloud-shaped fbm */
float billow(vec2 p, int octaves){
    return 1.0 - abs(fbm2(p, octaves) * 2.0 - 1.0);
}

#endif
