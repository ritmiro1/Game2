#version 120
#define WATER_QUALITY 2 // [0 1 2 3]
#define REFLECTIONS 1.0 // [0.0 1.0]
uniform sampler2D texture; uniform sampler2D lightmap; uniform float frameTimeCounter; uniform float rainStrength; uniform vec3 sunPosition;
varying vec2 texcoord; varying vec2 lmcoord; varying vec4 tint; varying vec3 normalView; varying vec4 shadowCoord; varying vec3 viewPosition;
float wave(vec2 p,float t){return 0.55*sin(p.x*5.0+t)+0.3*sin(p.y*7.0-t*1.3)+0.15*sin((p.x+p.y)*3.0+t*0.7);}
void main(){vec4 tex=texture2D(texture,texcoord)*tint;if(tex.a<0.02)discard;vec3 n=normalize(normalView);float fres=0.02+0.98*pow(1.0-max(abs(n.z),0.0),5.0);float w=wave(texcoord*8.0,frameTimeCounter*0.7);vec3 deep=vec3(0.018,0.12,0.19);vec3 sky=vec3(0.28,0.48,0.63);vec3 reflected=mix(sky,vec3(0.95,0.72,0.48),pow(max(dot(n,normalize(sunPosition)),0.0),48.0));vec3 c=mix(mix(deep,tex.rgb,0.24),reflected,clamp(fres*(0.55+0.25*REFLECTIONS)+0.1,0.0,0.85));float sparkle=pow(max(dot(n,normalize(sunPosition)),0.0),80.0);c+=vec3(1.0,0.84,0.62)*sparkle*0.35;c+=w*0.004*(1.0+0.35*WATER_QUALITY);gl_FragData[0]=vec4(c,tex.a);}
