#version 120
/*
    Aetheris Shaders - water / translucent vertex stage.
*/
#include "/lib/settings.glsl"

attribute vec4 mc_Entity;

uniform mat4 gbufferModelViewInverse;
uniform vec3 cameraPosition;
uniform float frameTimeCounter;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;

void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    tint     = gl_Color;

    float blockID = mc_Entity.x;
    materialID = 6.0;                       /* water by default */
    if (blockID > 94.5 && blockID < 97.5) materialID = 7.0;   /* glass */
    if (blockID > 8.5 && blockID < 12.5) materialID = 6.0;    /* water / flowing */

    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    worldPos = (gbufferModelViewInverse * viewPosition).xyz + cameraPosition;
    worldNormal = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
}
