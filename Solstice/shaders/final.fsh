#version 120
#define EXPOSURE 1.0 // [0.7 0.85 1.0 1.15 1.3]
uniform sampler2D colortex0;
varying vec2 texcoord;
vec3 aces(vec3 value) {
    return clamp((value * (2.51 * value + 0.03)) / (value * (2.43 * value + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
    vec3 color = texture2D(colortex0, texcoord).rgb * EXPOSURE;
    color = aces(color);
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    gl_FragColor = vec4(color, 1.0);
}
