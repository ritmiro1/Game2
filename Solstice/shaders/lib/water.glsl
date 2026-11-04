// Animated two-frequency water normals and Schlick Fresnel.
float solsticeWave(vec2 p,float t){return sin(p.x*5.0+t)*0.55+sin(p.y*7.0-t*1.3)*0.3+sin((p.x+p.y)*3.0+t*0.7)*0.15;}
float solsticeWaterFresnel(float ndv){return 0.02+0.98*pow(1.0-clamp(ndv,0.0,1.0),5.0);}
