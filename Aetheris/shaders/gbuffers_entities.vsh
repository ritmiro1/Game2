#version 120
/*
    Aetheris Shaders - entities, items, minecarts, armour stands.
*/
uniform mat4 gbufferModelViewInverse;
uniform vec3 cameraPosition;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 tint;
varying vec3 worldNormal;
varying vec3 worldPos;
varying float materialID;

void main(){
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    tint     = gl_Color;

    vec4 viewPosition = gl_ModelViewMatrix * gl_Vertex;
    worldPos = (gbufferModelViewInverse * viewPosition).xyz + cameraPosition;
    worldNormal = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
    materialID = 0.0;
}
