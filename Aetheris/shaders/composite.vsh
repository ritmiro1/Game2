#version 120
/* Aetheris Shaders - full screen post vertex stage. */
varying vec2 texcoord;
void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
}
