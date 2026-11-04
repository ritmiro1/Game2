#version 120
#define AO_STRENGTH 0.70 // [0.0 0.25 0.5 0.7 0.85 1.0]
uniform sampler2D gcolor;
uniform sampler2D depthtex0;
uniform float viewWidth;
uniform float viewHeight;
varying vec2 texcoord;
void main() {
    vec4 color = texture2D(gcolor, texcoord);
    float depth = texture2D(depthtex0, texcoord).r;
    vec2 pixel = vec2(1.0 / viewWidth, 1.0 / viewHeight);
    float occlusion = 0.0;
    occlusion += step(depth + 0.001, texture2D(depthtex0, texcoord + pixel * vec2(2.0, 0.0)).r);
    occlusion += step(depth + 0.001, texture2D(depthtex0, texcoord + pixel * vec2(-2.0, 0.0)).r);
    occlusion += step(depth + 0.001, texture2D(depthtex0, texcoord + pixel * vec2(0.0, 2.0)).r);
    occlusion += step(depth + 0.001, texture2D(depthtex0, texcoord + pixel * vec2(0.0, -2.0)).r);
    color.rgb *= 1.0 - clamp(occlusion * 0.055 * AO_STRENGTH, 0.0, 0.28);
    gl_FragData[0] = color;
}
