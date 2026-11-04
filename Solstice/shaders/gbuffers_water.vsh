#version 120

uniform mat4 gbufferModelViewInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 normalView;
varying vec4 shadowCoord;
varying vec3 viewPosition;
void main(){
 gl_Position=gl_ModelViewProjectionMatrix*gl_Vertex;
 texcoord=gl_MultiTexCoord0.xy; lmcoord=gl_MultiTexCoord1.xy/256.0; tint=gl_Color;
 normalView=normalize(gl_NormalMatrix*gl_Normal);
 vec4 vp=gl_ModelViewMatrix*gl_Vertex; viewPosition=vp.xyz;
 vec4 w=gbufferModelViewInverse*vp; shadowCoord=shadowProjection*shadowModelView*w;
 shadowCoord.xyz=shadowCoord.xyz/shadowCoord.w*0.5+0.5;
}
