#version 120
/*
    Aetheris Shaders - sky vertex stage (vanilla skybox geometry, drawn as a dome).
*/
uniform mat4 gbufferModelViewInverse;

varying vec3 viewDir;

void main(){
    gl_Position = ftransform();
    /* Sky geometry vertices are in model view space; recover a world direction */
    vec3 pos = gl_Vertex.xyz;
    viewDir = normalize(mat3(gbufferModelViewInverse) * pos);
}
