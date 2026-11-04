#version 120
varying vec2 texcoord; varying vec4 tint; void main(){gl_Position=gl_ModelViewProjectionMatrix*gl_Vertex;texcoord=gl_MultiTexCoord0.xy;tint=gl_Color;}
