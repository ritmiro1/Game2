#version 120
#define EXPOSURE 1.0 // [0.7 0.85 1.0 1.15 1.3]
uniform sampler2D colortex0; #define EXPOSURE 1.0 // [0.7 0.85 1.0 1.15 1.3] varying vec2 texcoord;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){vec3 c=texture2D(colortex0,texcoord).rgb*EXPOSURE;c=aces(c);c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));gl_FragColor=vec4(c,1.0);}
