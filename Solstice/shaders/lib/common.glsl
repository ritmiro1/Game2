// Shared color and tone utilities (GLSL 1.20 compatible).
vec3 solsticeACES(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float solsticeLuma(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
