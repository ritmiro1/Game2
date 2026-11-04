#version 120
/*
    Aetheris Shaders - vanilla cloud layer vertex stage.
*/
uniform mat4 gbufferModelViewInverse;
uniform vec3 cameraPosition;

varying vec2 texcoord;
varying vec4 tint;
varying vec3 worldPos;

void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    tint = gl_Color;
    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    worldPos = (gbufferModelViewInverse * viewPosition).xyz + cameraPosition;
}
