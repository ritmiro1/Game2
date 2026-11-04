#version 120
#define BLOOM 1.0 // [0.0 1.0]
uniform sampler2D colortex0;
uniform float viewWidth;
uniform float viewHeight;
varying vec2 texcoord;
void main() {
    vec2 pixel = vec2(1.0 / viewWidth, 1.0 / viewHeight) * 2.0;
    vec3 sum = texture2D(colortex0, texcoord + vec2(pixel.x, 0.0)).rgb;
    sum += texture2D(colortex0, texcoord - vec2(pixel.x, 0.0)).rgb;
    sum += texture2D(colortex0, texcoord + vec2(0.0, pixel.y)).rgb;
    sum += texture2D(colortex0, texcoord - vec2(0.0, pixel.y)).rgb;
    sum *= 0.25;
    vec3 base = texture2D(colortex0, texcoord).rgb;
    vec3 glow = max(sum - vec3(0.72), vec3(0.0)) * 0.22 * BLOOM;
    gl_FragData[0] = vec4(base + glow, 1.0);
}
