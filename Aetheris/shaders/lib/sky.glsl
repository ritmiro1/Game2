/*
    Aetheris Shaders - analytic atmosphere, sun/moon, stars and volumetric clouds.
    Physically inspired single-scattering approximation (Rayleigh + Mie + ozone tint).
*/
#ifndef SKY_GLSL
#define SKY_GLSL

#include "/lib/common.glsl"


/* Scattering coefficients per metre at sea level (real-world magnitudes) */
const vec3 RAYLEIGH_BASE = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const vec3 MIE_BASE      = vec3(21.0e-6);
const vec3 OZONE_ABSORB  = vec3(0.65e-6, 1.88e-6, 0.085e-6);
/* Effective column heights (metres) used for the analytic optical depth */
const float H_RAYLEIGH   = 8.0e3;
const float H_MIE        = 1.2e3;
const float H_OZONE      = 2.2e4;
/* Artist controls: how much of the scattered light reaches the camera */
const float SKY_GAIN     = 30.0;
const float MIE_GAIN     = 11.0;

float sunHeight(){ return sunPosition.y; }

/* 0 at night, 1 at noon */
float dayFactor(){
    return saturate(smoothstep(-0.12, 0.22, sunPosition.y));
}

/* Golden hour weight */
float goldenHour(){
    float h = saturate(sunPosition.y);
    return exp(-pow(h * 3.4, 1.5)) * step(-0.08, sunPosition.y);
}

/* Sun tint: deep orange at the horizon, near-white at zenith */
vec3 sunTint(){
    float h = saturate(sunPosition.y);
    vec3 horizon = vec3(1.0, 0.36, 0.10);
    vec3 mid     = vec3(1.0, 0.72, 0.44);
    vec3 noon    = vec3(1.0, 0.965, 0.918);
    vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
    c = mix(c, noon, smoothstep(0.20, 0.65, h));
    /* Atmospheric reddening when low */
    c *= mix(1.0, 0.72, exp(-h * 8.0));
    return c;
}

vec3 moonTint(){ return vec3(0.52, 0.66, 1.0) * 1.05; }

/* Key light direction + colour used by all lighting passes */
vec3 lightDirection(){
    return normalize(sunPosition.y > -0.02 ? sunPosition : moonPosition);
}

vec3 lightColor(){
    float day = dayFactor();
    vec3 sun  = sunTint() * 2.15;
    vec3 moon = moonTint() * 0.22;
    return mix(moon, sun, saturate(day * 1.25));
}

/* ---------- atmospheric single scattering ---------- */
vec3 atmosphere(vec3 dir, vec3 sunDir, float rain){
    float mu = dot(dir, sunDir);
    float zenith = saturate(dir.y * 0.5 + 0.5);

    /* Air mass along the view ray and along the light ray (analytic) */
    float airMass = min(1.0 / (max(dir.y, 0.0) + 0.095), 14.0);
    float sunAirMass = min(1.0 / (max(sunDir.y, 0.0) + 0.095), 22.0);

    vec3 betaR = RAYLEIGH_BASE * H_RAYLEIGH;
    vec3 betaM = MIE_BASE * H_MIE;
    vec3 betaO = OZONE_ABSORB * H_OZONE;

    /* Ozone absorption on the way in, Rayleigh + Mie extinction on the way out */
    vec3 sunT = exp(-(betaR + betaM) * sunAirMass - betaO * sunAirMass);
    /* Violet cast of the blue hour */
    sunT = mix(sunT, sunT * vec3(0.92, 0.94, 1.12), saturate(1.0 - sunDir.y * 6.0));
    /* Extinction along the view ray (aerial perspective inside the sky itself) */
    vec3 viewT = exp(-(betaR + betaM) * airMass * 0.55);

    float rayleighPhase = 0.0596831 * (1.0 + mu * mu);
    const float g = 0.78;
    float miePhase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5));

    vec3 scatterR = betaR * rayleighPhase * sunT * viewT * SKY_GAIN;
    vec3 scatterM = betaM * miePhase * sunT * viewT * MIE_GAIN;

    vec3 sky = scatterR + scatterM;

    /* Long optical path near the horizon means much more multiply-scattered
       light: give sunrise/sunset its dramatic luminous band. */
    float golden = exp(-pow(saturate(sunDir.y) * 3.4, 1.5)) * smoothstep(-0.10, 0.02, sunDir.y);
    float horizonBand = pow(1.0 - saturate(dir.y), 3.0);
    sky *= mix(1.0, 2.30, golden);
    sky += sunT * sunTint() * golden * horizonBand * 0.075;
    /* warm glow surrounding the sun itself */
    sky += sunT * sunTint() * golden * pow(saturate(mu), 6.0) * 0.25;

    /* Horizon haze + ground bounce */
    float horizon = pow(1.0 - saturate(dir.y), 4.0);
    sky += sunT * vec3(0.42, 0.30, 0.24) * horizon * 0.055;

    /* Night: deep blue with faint airglow */
    vec3 night = mix(vec3(0.0135, 0.0225, 0.0510), vec3(0.0340, 0.0560, 0.1150), zenith);
    night += vec3(0.050, 0.075, 0.130) * horizon * 0.55;

    float dayW = dayFactor();
    vec3 result = mix(night, sky, dayW);
    result = mix(result, result * vec3(0.72, 0.75, 0.82), saturate(1.0 - sunDir.y * 3.0) * dayW * 0.6);
    /* Rain: desaturate + darken, lift fog */
    result = mix(result, vec3(luma(result)) * vec3(0.62, 0.66, 0.72), rain * 0.75);
    return max(result, vec3(0.0));
}

/* ---------- stars ---------- */
vec3 starField(vec3 dir, float night){
#if STARS == 0
    return vec3(0.0);
#endif
    if (night <= 0.001) return vec3(0.0);
    /* Equirectangular-ish projection, keeps stars stable while rotating */
    vec3 p = dir * 220.0;
    vec3 cell = floor(p);
    float h = hash13(cell);
    float star = smoothstep(0.9965, 1.0, h);
    vec3 local = fract(p) - 0.5;
    float dist = length(local);
    float twinkle = 0.7 + 0.3 * sin(frameTimeCounter * (2.0 + h * 9.0) + h * 40.0);
    float brightness = star * smoothstep(0.42, 0.0, dist) * twinkle;
    vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), hash13(cell + 3.7));
    vec3 stars = tint * brightness * 2.4;
    #if MILKY_WAY == 1
        /* Galactic band: bright dust lane near a tilted great circle */
        vec3 axis = normalize(vec3(0.35, 0.88, -0.32));
        float band = 1.0 - abs(dot(dir, axis));
        band = pow(saturate(band), 14.0);
        float dust = fbm3(dir * 9.0 + 4.0, 4);
        float dust2 = fbm3(dir * 22.0, 3);
        vec3 milky = mix(vec3(0.16, 0.18, 0.30), vec3(0.42, 0.40, 0.50), dust) * band;
        milky *= (0.55 + 0.9 * dust2);
        stars += milky * 0.22 * twinkle;
    #endif
    return stars * night;
}

/* ---------- sun & moon discs ---------- */
vec3 celestialDiscs(vec3 dir, float night){
    vec3 col = vec3(0.0);

    /* Sun */
    vec3 sDir = normalize(sunPosition);
    float sunCos = dot(dir, sDir);
    /* Angular radius of the sun scaled by the SUN_SIZE setting */
    float sunEdge = 1.0 - 0.00035 * SUN_SIZE;
    float sunDisc = smoothstep(sunEdge - 0.00022 * SUN_SIZE, sunEdge + 0.00008, sunCos);
    col += sunDisc * sunTint() * 46.0 * saturate(smoothstep(-0.06, 0.03, sunPosition.y));

    /* Sun halo / forward scattering */
    float halo = pow(saturate(sunCos), 220.0);
    float wideHalo = pow(saturate(sunCos), 14.0);
    col += (halo * 1.9 + wideHalo * 0.16) * sunTint() * SUN_GLOW
           * saturate(smoothstep(-0.10, 0.06, sunPosition.y));

    /* Moon with phase */
    vec3 mDir = normalize(moonPosition);
    float moonCos = dot(dir, mDir);
    float moonDisc = smoothstep(0.99955, 0.99985, moonCos);
    if (moonDisc > 0.0){
        /* phase: offset a virtual light direction */
        float phaseAng = float(moonPhase) / 8.0 * TAU;
        vec3 tangent = normalize(cross(mDir, vec3(0.0, 1.0, 0.0)) + 1e-4);
        vec3 bitangent = cross(tangent, mDir);
        vec2 localUV = vec2(dot(dir - mDir, tangent), dot(dir - mDir, bitangent)) * 780.0;
        vec2 phaseShift = vec2(cos(phaseAng), sin(phaseAng)) * 0.85;
        float lit = 1.0 - smoothstep(0.35, 1.05, length(localUV * 0.62 + phaseShift));
        float maria = 0.86 + 0.14 * fbm2(localUV * 3.0 + 11.0, 3);
        col += moonDisc * vec3(1.0, 0.98, 0.93) * (0.25 + lit * 2.4) * maria * night * 1.6;
    }
    float moonHalo = pow(saturate(moonCos), 240.0);
    col += moonHalo * vec3(0.35, 0.44, 0.72) * 0.55 * night;

    return col;
}

/* ---------- volumetric clouds (analytic march, 2 layers) ---------- */
vec4 cloudLayer(vec3 dir, vec3 sunDir, float rain){
#if CLOUDS_ENABLED == 1
    if (dir.y < 0.008) return vec4(0.0);

    float planeY = CLOUD_HEIGHT;
    float t = (planeY - cameraPosition.y) / dir.y;
    if (t < 0.0) return vec4(0.0);

    vec2 wind = vec2(frameTimeCounter * 3.1, frameTimeCounter * 1.35);
    vec2 p = cameraPosition.xz + dir.xz * t * 1.0 + wind;

    float scale = 1.0 / 1400.0;
    /* CLOUD_QUALITY controls how many fbm octaves the cloud field is built from */
    int octaves = 3 + CLOUD_QUALITY / 2;
    float n = fbm2(p * scale, octaves);
    n = mix(n, fbm2(p * scale * 2.7 + 41.0, max(octaves - 1, 2)), 0.45);

    float coverage = mix(0.52, 0.16, saturate(rain * 0.9));
    coverage /= max(CLOUD_COVERAGE, 0.1);
    float density = smoothstep(coverage, coverage + 0.30, n);

    /* horizon fade so the plane edge is invisible */
    float horizonFade = smoothstep(0.015, 0.16, dir.y);
    density *= horizonFade;

    /* Cheap self-shadow: sample density toward the sun */
    vec2 sOff = normalize(sunDir.xz + 1e-4) * 260.0;
    float n2 = fbm2((p + sOff) * scale, 3);
    float lightTrans = saturate(1.0 - smoothstep(coverage, coverage + 0.34, n2));
    float powder = 1.0 - density * 0.55;

    vec3 lit = sunTint() * (0.42 * lightTrans + 0.18) * powder;
    vec3 ambient = mix(vec3(0.10, 0.13, 0.20), vec3(0.52, 0.62, 0.80), dayFactor());
    ambient *= 0.55 + 0.45 * (1.0 - density);

    /* moonlit clouds */
    lit = mix(lit * 0.12 + moonTint() * 0.10 * lightTrans, lit, dayFactor());

    vec3 col = ambient * 0.9 + lit;
    /* silver lining near the sun */
    float silver = pow(saturate(dot(dir, sunDir)), 8.0);
    col += sunTint() * silver * (1.0 - density) * 0.55 * dayFactor();

    float alpha = saturate(density * (0.92 - 0.35 * exp(-t / 2600.0)));
    alpha *= mix(1.0, 0.82, rain);
    col = mix(col, col * vec3(0.66, 0.68, 0.74), rain * 0.8);

    /* sunset tinting */
    col *= mix(vec3(1.0), sunTint() * 1.15, goldenHour() * 0.55);
    return vec4(col, alpha);
#else
    return vec4(0.0);
#endif
}

/* Combined sky + clouds + celestial layer, already in linear HDR */
vec3 renderSky(vec3 dir, float rain){
    vec3 sunDir = normalize(sunPosition);
    float night = 1.0 - dayFactor();
    vec3 col = atmosphere(dir, sunDir, rain);
    col += starField(dir, night * (1.0 - rain) * step(0.0, -sunPosition.y + 0.05));
    col += celestialDiscs(dir, night);

    vec4 clouds = cloudLayer(dir, sunDir, rain);
    col = mix(col, clouds.rgb * mix(vec3(0.35), vec3(1.0), max(clouds.a, dayFactor() * 0.7)), clouds.a * 0.92);

    return col;
}

/* Approximate cloud coverage above a world position -> shadow multiplier */
float cloudShadow(vec3 worldPos, vec3 sunDir){
#if CLOUD_SHADOWS == 1 && CLOUDS_ENABLED == 1
    if (sunDir.y < 0.05) return 1.0;
    float t = (CLOUD_HEIGHT - worldPos.y) / max(sunDir.y, 0.05);
    if (t < 0.0) return 1.0;
    vec2 p = worldPos.xz + sunDir.xz * t + vec2(frameTimeCounter * 3.1, frameTimeCounter * 1.35);
    float n = fbm2(p / 1400.0, 4);
    float coverage = 0.52 / max(CLOUD_COVERAGE, 0.1);
    float d = smoothstep(coverage - 0.10, coverage + 0.36, n);
    return mix(1.0, 0.42, d);
#else
    return 1.0;
#endif
}

/* Analytic aerial perspective */
vec3 applyFog(vec3 color, vec3 worldDir, float dist, vec3 sunDir, float rain){
    float density = 1.0;
    /* height-based fog: thinner up high */
    float h = max(cameraPosition.y, 0.0);
    density *= mix(1.0, 0.35, saturate(h / 420.0));

    float f = 1.0 - exp(-dist * 0.00085 * density);
    f = saturate(f) * mix(0.55, 1.0, saturate(dist / 220.0));

    vec3 fogCol = atmosphere(normalize(vec3(worldDir.x, max(worldDir.y, 0.02), worldDir.z)), sunDir, rain);
    /* In-scattering highlight toward the sun */
    float mu = pow(saturate(dot(worldDir, sunDir)), 6.0);
    fogCol += sunTint() * mu * 0.55 * dayFactor();

    /* Underwater fog is handled by the water pass */
    return mix(color, fogCol, f * 0.92);
}

#endif
