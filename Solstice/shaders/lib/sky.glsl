// Stylized atmospheric scattering palette.
vec3 solsticeSky(float h,float day){vec3 zenith=mix(vec3(0.012,0.018,0.055),vec3(0.16,0.39,0.72),day);vec3 horizon=mix(vec3(0.14,0.10,0.22),vec3(0.82,0.57,0.36),day);return mix(horizon,zenith,smoothstep(-0.08,0.72,h));}
