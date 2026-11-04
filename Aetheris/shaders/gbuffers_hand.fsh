#version 120
/*
    Aetheris Shaders - held item shading.
    The hand pass runs AFTER deferred lighting, so it shades itself: sun + sky +
    shadows + the player's own block light (a torch in hand lights the tool).
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/lighting.glsl"

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;

/* DRAWBUFFERS:0 */
void main(){
    vec4 albedo = texture2D(gtexture, texcoord) * tint;
    if (albedo.a < 0.06) discard;

    vec3 linear = srgb2rgb(albedo.rgb);
    vec3 normal = normalize(worldNormal);
    if (dot(normal, normal) < 0.5) normal = vec3(0.0, 1.0, 0.0);
    vec3 V = normalize(cameraPosition - worldPos);
    vec3 sunDir = normalize(sunPosition);

    /* The hand sits a few centimetres from the camera: use the player's sky
       exposure as the shadow term (shadow samplers are not available here). */
    float shadow = mix(0.35, 1.0, saturate(lmcoord.y));

    float ndl = saturate(dot(normal, sunDir));
    vec3 direct = lightColor() * ndl * shadow;

    /* Ambient sky + held/carried block light */
    vec3 ambient = skyAmbient(normal, rainStrength);
    /* Held torches / lanterns light the item in hand */
    float heldLight = float(heldBlockLightValue) / 15.0;
    float blockLight = max(clamp(lmcoord.x, 0.0, 1.0), heldLight * heldLight);
    float skyLight = clamp(lmcoord.y, 0.0, 1.0);
    vec3 torch = vec3(1.0, 0.60, 0.28) * pow(blockLight, 2.0) * 1.6;
    ambient *= mix(0.10, 1.0, skyLight);

    /* Specular sheen so tools and metal glint */
    vec3 f0 = mix(vec3(0.04), linear, 0.55);
    vec3 spec = specularGGX(normal, V, sunDir, f0, 0.35) * lightColor() * shadow;

    vec3 color = linear * (direct + ambient + torch) + spec;

    float emissive = saturate((linear.r - max(linear.g, linear.b)) * 1.5 - 0.4) * EMISSIVE_STRENGTH;
    color += linear * emissive * 4.0;

    /* Never let the hand go fully black in caves */
    color += linear * 0.012;

    gl_FragData[0] = vec4(color, 0.5);
}
