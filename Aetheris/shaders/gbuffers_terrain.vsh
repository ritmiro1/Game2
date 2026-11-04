#version 120
/*
    Aetheris Shaders - terrain vertex stage.
    Adds foliage / grass wind animation and forwards albedo, lightmap and tint.
*/
#include "/lib/settings.glsl"

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjection;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
uniform vec3 cameraPosition;
uniform float frameTimeCounter;
uniform float rainStrength;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;
varying float blockID;

/* World-space wind field. Tall grass and leaves sway, trunks barely move. */
vec3 windOffset(vec3 worldPosition, float sway){
    if (sway <= 0.001) return vec3(0.0);
    float t = frameTimeCounter;
    vec3 p = worldPosition;
    float gust = 0.6 + 0.4 * sin(t * 0.31 + p.x * 0.012 + p.z * 0.017);
    vec2 swayDir = vec2(sin(t * 1.7 + p.x * 0.35 + p.z * 0.21),
                        cos(t * 1.3 + p.z * 0.31 + p.x * 0.11));
    vec3 offs = vec3(swayDir.x, 0.12 * sin(t * 2.3 + p.x * 0.5), swayDir.y);
    offs *= sway * (0.055 + rainStrength * 0.03) * gust;
    return offs;
}

void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    tint     = gl_Color;

    blockID = mc_Entity.x;
    materialID = 0.0;

    /* Foliage detection: grass/plants/leaves and crops */
    bool isLeaves = (blockID > 17.5 && blockID < 18.5) || (blockID > 161.5 && blockID < 162.5);
    bool isPlant  = (blockID > 30.5 && blockID < 32.5) || (blockID > 58.5 && blockID < 60.5) ||
                    (blockID > 103.5 && blockID < 106.5) || (blockID > 110.5 && blockID < 116.5) ||
                    (blockID > 140.5 && blockID < 142.5) || (blockID > 174.5 && blockID < 176.5);
    if (isLeaves) materialID = 2.0;
    else if (isPlant) materialID = 2.0;

    /* Metal / polished blocks */
    if ((blockID > 41.4 && blockID < 42.6) || (blockID > 56.5 && blockID < 58.5) ||
        (blockID > 152.5 && blockID < 153.5) || (blockID > 133.5 && blockID < 134.5) ||
        (blockID > 212.5 && blockID < 214.5)) materialID = 3.0;

    /* Emissive geometry */
    if ((blockID > 49.5 && blockID < 51.5) || (blockID > 88.5 && blockID < 90.5) ||
        (blockID > 123.5 && blockID < 125.5) || (blockID > 165.5 && blockID < 170.5) ||
        (blockID > 197.5 && blockID < 200.5) || (blockID > 213.5 && blockID < 215.5) ||
        (blockID > 250.5 && blockID < 252.5)) materialID = 4.0;

    /* Sand / gravel */
    if ((blockID > 11.5 && blockID < 14.5) || (blockID > 23.5 && blockID < 24.5)) materialID = 9.0;

    /* Tall plants sway: use the top vertex of the quad */
    bool isTopVertex = texcoord.y < mc_midTexCoord.y;
    float sway = isTopVertex ? 1.0 : 0.15;
    if (materialID < 1.5 && !isPlant && !isLeaves) sway = 0.0;

    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    worldPos = (gbufferModelViewInverse * viewPosition).xyz + cameraPosition;
    worldNormal = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    if (isPlant || isLeaves){
        vec3 offs = windOffset(worldPos, sway);
        worldPos += offs;
        viewPosition.xyz += mat3(gbufferModelView) * offs;
        gl_Position = gl_ProjectionMatrix * viewPosition;
    }
}
