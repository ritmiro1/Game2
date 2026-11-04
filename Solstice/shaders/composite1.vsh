#version 120
varying vec2 texcoord;
void main() {
    // Use the engine-provided fullscreen transform for Iris/OptiFine.
    gl_Position = ftransform();
    texcoord = gl_MultiTexCoord0.xy;
}
