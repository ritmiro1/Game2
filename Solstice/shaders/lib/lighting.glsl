// Compact physically-inspired diffuse/specular response.
float solsticeNdotL(vec3 n, vec3 l){return max(dot(normalize(n),normalize(l)),0.0);}
vec3 solsticeFresnel(vec3 f0,float c){return f0+(1.0-f0)*pow(1.0-clamp(c,0.0,1.0),5.0);}
