// Small hash/noise utility for procedural sky detail.
float solsticeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
