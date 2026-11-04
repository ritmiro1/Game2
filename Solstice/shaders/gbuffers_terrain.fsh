#version 120
#define SHADOW_QUALITY 1 // [0 1 2 3]
#define EMISSIVE_BRIGHTNESS 1.25 // [0.5 1.0 1.25 1.5 2.0]
uniform sampler2D texture;
uniform sampler2D lightmap;
uniform sampler2D shadowtex0;
uniform vec3 sunPosition;
uniform float rainStrength;
uniform float frameTimeCounter;
uniform float viewWidth;
uniform float viewHeight;
varying vec2 texcoord; varying vec2 lmcoord; varying vec4 tint; varying vec3 normalView; varying vec4 shadowCoord; varying vec3 viewPosition;
void main(){
 vec4 tex=texture2D(texture,texcoord)*tint; if(tex.a<0.08) discard;
 vec3 lm=texture2D(lightmap,lmcoord).rgb; float day=clamp(lm.y*1.4,0.0,1.0);
 vec3 n=normalize(normalView); vec3 l=normalize(sunPosition); float ndl=max(dot(n,l),0.0);
 vec3 shadowPos=shadowCoord.xyz; float sh=1.0;
 if(shadowPos.x>0.002&&shadowPos.x<0.998&&shadowPos.y>0.002&&shadowPos.y<0.998&&shadowPos.z>0.0&&shadowPos.z<1.0){vec2 px=vec2((1.0+0.35*SHADOW_QUALITY)/2048.0);sh=0.25*(step(shadowPos.z-0.001,texture2D(shadowtex0,shadowPos.xy+px*vec2(-0.5,-0.5)).r)+step(shadowPos.z-0.001,texture2D(shadowtex0,shadowPos.xy+px*vec2(0.5,-0.5)).r)+step(shadowPos.z-0.001,texture2D(shadowtex0,shadowPos.xy+px*vec2(-0.5,0.5)).r)+step(shadowPos.z-0.001,texture2D(shadowtex0,shadowPos.xy+px*vec2(0.5,0.5)).r));}
 float direct=ndl*sh*(0.45+0.55*day); float ambient=0.28+0.42*lm.y+0.28*lm.x; vec3 sun=mix(vec3(1.0,0.72,0.48),vec3(1.0,0.96,0.86),clamp(l.y+0.35,0.0,1.0));
 vec3 color=tex.rgb*(ambient+sun*direct*0.72)+tex.rgb*pow(clamp(lm.x,0.0,1.0),3.0)*0.12*EMISSIVE_BRIGHTNESS; color=mix(color,color*0.88,rainStrength); gl_FragData[0]=vec4(color,tex.a);
}
