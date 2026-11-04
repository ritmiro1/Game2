#version 120
/*
    Aetheris Shaders - deferred lighting vertex stage (full screen quad).
*/
varying vec2 texcoord;
void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
}
