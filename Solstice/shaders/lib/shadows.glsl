// Four-tap PCF helper for normalized shadow coordinates.
float solsticePCF(sampler2D map,vec3 p,vec2 texel){float s=0.0;s+=step(p.z-0.001,texture2D(map,p.xy+texel*vec2(-0.5,-0.5)).r);s+=step(p.z-0.001,texture2D(map,p.xy+texel*vec2(0.5,-0.5)).r);s+=step(p.z-0.001,texture2D(map,p.xy+texel*vec2(-0.5,0.5)).r);s+=step(p.z-0.001,texture2D(map,p.xy+texel*vec2(0.5,0.5)).r);return s*0.25;}
