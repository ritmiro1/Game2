#version 120
/*
    Aetheris Shaders - water surface shading.
    Everything is done here (not deferred) because water needs the refraction
    lookup of the already-rendered opaque scene.
*/
#include "/lib/settings.glsl"
#include "/lib/lighting.glsl"
#include "/lib/water.glsl"

/* DRAWBUFFERS:012 */

uniform sampler2D gtexture;
uniform sampler2D lightmap;
uniform sampler2D colortex0;   /* opaque albedo written by gbuffers */
uniform sampler2D colortex1;   /* opaque normal + material */
uniform sampler2D depthtex0;   /* opaque depth */
uniform sampler2D depthtex1;   /* opaque + translucent depth */

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;

void main(){
    vec4 texel = texture2D(gtexture, texcoord) * tint;
    vec2 uv = gl_FragCoord.xy / vec2(viewWidth, viewHeight);
    float t = frameTimeCounter;

    /* View vector in world space */
    vec4 vposClip = gbufferProjectionInverse * vec4(vec3(uv, texture2D(depthtex1, uv).r) * 2.0 - 1.0, 1.0);
    vposClip /= vposClip.w;
    vec3 fragWorld = (gbufferModelViewInverse * vposClip).xyz + cameraPosition;
    vec3 V = normalize(cameraPosition - fragWorld);

    vec3 N = normalize(worldNormal);
    if (materialID < 6.5){
        /* animated normal from wave field + ripples */
        vec2 p = worldPos.xz;
        float distFade = 1.0 - smoothstep(24.0, 140.0, length(cameraPosition - worldPos));
        vec3 waveN = waveNormal(p, t, 1.0);
        vec3 ripN  = rippleNormal(p, t, distFade);
        N = normalize(mix(N, normalize(waveN * 0.6 + ripN * 0.7), 0.85));
        /* flatten normals seen at grazing angles to avoid sparkle */
        N = normalize(mix(N, normalize(worldNormal + vec3(0.0, 0.001, 0.0)), 0.18));
    }
    if (!gl_FrontFacing) N = -N;

    /* Fresnel */
    float NoV = saturate(dot(N, V));
    float fres = fresnelWater(NoV);

    /* G-buffer programs cannot sample shadow maps on all drivers, so the water
       uses the sky-light component (canopy / cave / tunnel exposure) as the
       shadow proxy for its sun sparkle. */
    float shadow = mix(0.18, 1.0, saturate(lmcoord.y));

    vec3 sunDir = normalize(sunPosition);
    vec3 lightCol = lightColor();
    float sunGlint = pow(saturate(dot(reflect(-V, N), sunDir)), 900.0);
    float glintWide = pow(saturate(dot(reflect(-V, N), sunDir)), 90.0) * 0.12;

    /* Reflection: sky + screen-space approximation of the scene */
    vec3 R = reflect(-V, N);
    vec3 envRefl = atmosphere(normalize(R + vec3(0.0, 0.02, 0.0)), sunDir, rainStrength);
    envRefl += skyAmbient(N, rainStrength) * 0.55;
    /* Screen-space reflections: march the reflected ray in view space and stop
       on the first depth intersection. Falls back to the analytic sky. */
    vec3 ssr = vec3(0.0);
    float ssrWeight = 0.0;
    {
        vec3 reflOrigin = worldPos + N * 0.06;
        vec3 rayDir = normalize(R);
        float stepLen = 0.55;
        float travel = 0.0;
        for (int i = 0; i < 48; i++){
            if (i >= SSR_STEPS) break;
            travel += stepLen;
            stepLen *= 1.18;
            vec3 p = reflOrigin + rayDir * travel;
            vec4 clipPos = gbufferProjection * (gbufferModelView * vec4(p - cameraPosition, 1.0));
            if (clipPos.w <= 0.0) break;
            vec2 suv = clipPos.xy / clipPos.w * 0.5 + 0.5;
            if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
            float sceneD = texture2D(depthtex0, suv).r;
            if (sceneD >= 1.0) continue;
            vec4 sv = gbufferProjectionInverse * vec4(vec3(suv, sceneD) * 2.0 - 1.0, 1.0);
            float sceneDist = length(sv.xyz / sv.w);
            if (travel > sceneDist - 0.25){
                vec3 reflAlbedo = texture2D(colortex0, suv).rgb;
                vec3 reflN = decodeNormal(texture2D(colortex1, suv));
                float ndl = saturate(dot(reflN, normalize(sunPosition)));
                vec3 reflLight = skyAmbient(reflN, rainStrength) + lightColor() * ndl * 0.45 * shadow;
                ssr = reflAlbedo * reflLight;
                ssrWeight = SSR_STRENGTH * 0.85 * saturate(1.0 - travel / 60.0);
                break;
            }
        }
    }
    vec3 reflection = mix(envRefl, ssr, saturate(ssrWeight)) * WATER_REFLECTION;

    /* Refraction */
    vec2 refractUV = uv + N.xz * 0.012 / max(1.0, length(cameraPosition - worldPos) * 0.02);
    float opaqueDepth = texture2D(depthtex0, refractUV).r;
    vec4 op = gbufferProjectionInverse * vec4(vec3(refractUV, opaqueDepth) * 2.0 - 1.0, 1.0);
    op /= op.w;
    float opaqueDist = length(op.xyz);
    vec4 wp = gbufferProjectionInverse * vec4(vec3(uv, texture2D(depthtex1, uv).r) * 2.0 - 1.0, 1.0);
    wp /= wp.w;
    float waterDist = length(wp.xyz);
    float pathLen = max(waterDist - opaqueDist, 0.0);

    vec3 refracted = texture2D(colortex0, refractUV).rgb;
    vec3 refrN = decodeNormal(texture2D(colortex1, refractUV));
    refracted *= skyAmbient(refrN, rainStrength) + lightColor() * saturate(dot(refrN, sunDir)) * shadow * 0.55 + 0.02;
    /* Underwater caustics on the submerged surface */
    vec3 caust = caustics(fragWorld, t, pathLen) * saturate(sunDir.y * 2.0);
    refracted += caust * refracted * 0.35 * WATER_CAUSTICS;

    vec3 transmittance = waterTransmittance(pathLen, WATER_CLARITY);
    vec3 waterSurface = waterSurfaceColor(sunDir);
    vec3 through = refracted * transmittance
                 + waterScatter(pathLen, WATER_CLARITY)
                 + waterSurface * (1.0 - transmittance) * 0.65;

    /* Blend reflection / refraction with fresnel */
    vec3 col = mix(through, reflection, saturate(fres * 1.05));

    /* Specular sun/moon highlight + general specular */
    vec3 spec = (vec3(sunGlint * 9.0 + glintWide * 3.0) * lightCol * shadow);
    col += spec;

    /* Foam at the shoreline */
    float depthDiff = max(waterDist - opaqueDist, 0.0);
    float foam = waterFoam(worldPos, depthDiff * 6.0, t, rainStrength);
    col = mix(col, vec3(0.92, 0.96, 1.0) * (skyAmbient(N, rainStrength) + lightCol * saturate(dot(N, sunDir)) * shadow) ,
              saturate(foam) * 0.75);

    /* Rain ripples darken + roughen */
    col *= mix(1.0, 0.82, rainStrength * 0.6);

    gl_FragData[0] = vec4(col, materialID > 6.5 ? 0.55 : 0.90);
    gl_FragData[1] = vec4(N * 0.5 + 0.5, materialID / 255.0);
    gl_FragData[2] = vec4(lmcoord, 0.0, 0.0);
}
