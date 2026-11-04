#version 120
#define VOLUMETRIC 1.0 // [0.0 1.0]
uniform sampler2D colortex0;
uniform sampler2D depthtex0;
uniform float viewWidth;
uniform float viewHeight;
uniform float frameTimeCounter;
varying vec2 texcoord;
void main() {
    vec3 color = texture2D(colortex0, texcoord).rgb;
    float depth = texture2D(depthtex0, texcoord).r;
    float haze = (1.0 - depth) * 0.035 * VOLUMETRIC;
    color += vec3(0.34, 0.42, 0.58) * haze;
    gl_FragData[0] = vec4(color, 1.0);
}
