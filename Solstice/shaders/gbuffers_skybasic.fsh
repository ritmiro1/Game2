#version 120
#define CLOUD_STYLE 1 // [0 1 2]
uniform sampler2D texture; uniform float rainStrength; uniform int worldTime; varying vec2 texcoord; varying vec4 tint;
void main(){vec4 c=texture2D(texture,texcoord)*tint;float wt=float(worldTime);float dusk=1.0-smoothstep(0.0,12000.0,abs(wt-12000.0));vec3 warm=mix(vec3(1.0),vec3(1.08,0.78,0.60),dusk*0.35);c.rgb*=warm*(1.0+0.025*CLOUD_STYLE);c.rgb*=1.0-rainStrength*0.18;gl_FragData[0]=c;}
