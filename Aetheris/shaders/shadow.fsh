#version 120
/*
    Aetheris Shaders - shadow map fragment stage.
    Alpha-tested foliage + coloured translucent shadows via shadowcolor0.
*/
#include "/lib/settings.glsl"

/* DRAWBUFFERS:0 */

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 tint;
varying float blockID;

void main(){
    vec4 albedo = texture2D(gtexture, texcoord) * tint;

    bool isFoliage = (blockID > 17.5 && blockID < 18.5) || (blockID > 161.5 && blockID < 162.5);
    /* Vegetation uses harder alpha cut-off so canopy shadows stay readable */
    float threshold = isFoliage ? 0.35 : 0.06;
    if (albedo.a < threshold) discard;

    /* Shadow map depth comes from the depth attachment; this colour output is
       unused but required for OptiFine/Iris to run the program. */
    gl_FragData[0] = albedo;
}
