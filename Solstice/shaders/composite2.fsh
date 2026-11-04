#version 120
#define SATURATION 1.05 // [0.8 0.9 1.0 1.05 1.15]
#define VIGNETTE 1.0 // [0.0 1.0]
uniform sampler2D colortex0;
uniform float viewWidth;
uniform float viewHeight;
uniform float rainStrength;
varying vec2 texcoord;
void main() {
    vec3 color = texture2D(colortex0, texcoord).rgb;
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, SATURATION);
    color *= mix(vec3(1.035, 1.0, 0.96), vec3(0.94, 0.98, 1.05), rainStrength * 0.35);
    float vignette = 1.0 - 0.18 * VIGNETTE * dot(texcoord - 0.5, texcoord - 0.5);
    color *= vignette;
    gl_FragData[0] = vec4(color, 1.0);
}
