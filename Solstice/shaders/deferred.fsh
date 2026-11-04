#version 120
#define AO_STRENGTH 0.70 // [0.0 0.25 0.5 0.7 0.85 1.0]
uniform sampler2D gcolor; uniform sampler2D depthtex0; uniform float viewWidth; uniform float viewHeight; #define AO_STRENGTH 0.70 // [0.0 0.25 0.5 0.7 0.85 1.0] varying vec2 texcoord;
void main(){vec4 c=texture2D(gcolor,texcoord);float d=texture2D(depthtex0,texcoord).r;vec2 px=vec2(1.0/viewWidth,1.0/viewHeight);float occ=0.0;occ+=step(d+0.001,texture2D(depthtex0,texcoord+px*vec2(2.0,0.0)).r);occ+=step(d+0.001,texture2D(depthtex0,texcoord+px*vec2(-2.0,0.0)).r);occ+=step(d+0.001,texture2D(depthtex0,texcoord+px*vec2(0.0,2.0)).r);occ+=step(d+0.001,texture2D(depthtex0,texcoord+px*vec2(0.0,-2.0)).r);float ao=1.0-clamp(occ*0.055*AO_STRENGTH,0.0,0.28);c.rgb*=ao;gl_FragData[0]=c;}
