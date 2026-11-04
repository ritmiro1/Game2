#version 120
/*
    Aetheris Shaders - shadow map vertex stage.
    Applies the same wind animation as the terrain pass so foliage shadows match.
*/
#include "/lib/settings.glsl"

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

uniform mat4 shadowModelView;
uniform mat4 shadowModelViewInverse;
uniform mat4 shadowProjection;
uniform vec3 cameraPosition;
uniform float frameTimeCounter;
uniform float rainStrength;

varying vec2 texcoord;
varying vec4 tint;
varying float blockID;

vec3 windOffset(vec3 worldPosition, float sway){
    if (sway <= 0.001) return vec3(0.0);
    float t = frameTimeCounter;
    vec3 p = worldPosition;
    float gust = 0.6 + 0.4 * sin(t * 0.31 + p.x * 0.012 + p.z * 0.017);
    vec2 swayDir = vec2(sin(t * 1.7 + p.x * 0.35 + p.z * 0.21),
                        cos(t * 1.3 + p.z * 0.31 + p.x * 0.11));
    vec3 offs = vec3(swayDir.x, 0.12 * sin(t * 2.3 + p.x * 0.5), swayDir.y);
    return offs * sway * (0.055 + rainStrength * 0.03) * gust;
}

void main(){
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    tint = gl_Color;
    blockID = mc_Entity.x;

    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    vec3 worldPos = (shadowModelViewInverse * viewPosition).xyz + cameraPosition;

    bool isLeaves = (blockID > 17.5 && blockID < 18.5) || (blockID > 161.5 && blockID < 162.5);
    bool isPlant  = (blockID > 30.5 && blockID < 32.5) || (blockID > 58.5 && blockID < 60.5) ||
                    (blockID > 103.5 && blockID < 106.5) || (blockID > 110.5 && blockID < 116.5);
    if (isLeaves || isPlant){
        float sway = (texcoord.y < mc_midTexCoord.y) ? 1.0 : 0.15;
        vec3 offs = windOffset(worldPos, sway);
        viewPosition.xyz += mat3(shadowModelView) * offs;
    }

    gl_Position = shadowProjection * viewPosition;
}
