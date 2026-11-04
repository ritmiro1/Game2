#version 120
#define SATURATION 1.05 // [0.8 0.9 1.0 1.05 1.15]
#define VIGNETTE 1.0 // [0.0 1.0]
uniform sampler2D colortex0; uniform float viewWidth; uniform float viewHeight; uniform float rainStrength; #define SATURATION 1.05 // [0.8 0.9 1.0 1.05 1.15]
#define VIGNETTE 1.0 // [0.0 1.0] varying vec2 texcoord;
void main(){vec3 c=texture2D(colortex0,texcoord).rgb;float y=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(y),c,SATURATION);c*=mix(vec3(1.035,1.0,0.96),vec3(0.94,0.98,1.05),rainStrength*0.35);float vig=1.0-0.18*VIGNETTE*dot(texcoord-0.5,texcoord-0.5);c*=vig;gl_FragData[0]=vec4(c,1.0);}
