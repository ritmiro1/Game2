#version 120
uniform sampler2D texture; varying vec2 texcoord; varying vec4 tint; void main(){if(texture2D(texture,texcoord).a*tint.a<0.1)discard;gl_FragData[0]=vec4(1.0);}
