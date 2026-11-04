#version 120
/*
    Aetheris Shaders - basic geometry (leash, selection box, particles, text).
    Lit by the same deferred pipeline so nothing pops out of the image.
*/
uniform mat4 gbufferModelViewInverse;
uniform vec3 cameraPosition;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;

void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    tint     = gl_Color;

    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    worldPos = (gbufferModelViewInverse * viewPosition).xyz + cameraPosition;
    worldNormal = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
}
