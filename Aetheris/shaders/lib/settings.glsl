/*
    Aetheris Shaders - User Settings
    Every option below is exposed in the shader GUI (see shaders.properties).
*/
#ifndef SETTINGS_GLSL
#define SETTINGS_GLSL

/* ============ SHADOWS ============ */
#define SHADOW_RESOLUTION 2048        // [1024 2048 3072 4096]
#define SHADOW_SAMPLES 8              // [1 2 4 6 8 12 16]
#define SHADOW_SOFTNESS 1.0           // [0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define SHADOW_DISTANCE 192.0         // [96.0 128.0 192.0 256.0 320.0]
#define SHADOW_FADE 0.12              // [0.0 0.05 0.1 0.15 0.25]

/* ============ AMBIENT OCCLUSION ============ */
#define SSAO_SAMPLES 12               // [0 4 8 12 16 24]
#define SSAO_RADIUS 1.15              // [0.5 0.75 1.0 1.15 1.5 2.0]
#define SSAO_STRENGTH 1.0             // [0.0 0.25 0.5 0.75 1.0 1.5 2.0]
#define SSAO_BIAS 0.035               // [0.01 0.02 0.035 0.05 0.08]

/* ============ VOLUMETRIC LIGHT ============ */
#define VOLUMETRIC_LIGHT 1            // [0 1]
#define VOLUMETRIC_STEPS 16           // [4 8 12 16 24 32]
#define VOLUMETRIC_STRENGTH 1.0       // [0.0 0.25 0.5 0.75 1.0 1.5 2.0 3.0]

/* ============ BLOOM ============ */
#define BLOOM 1                       // [0 1]
#define BLOOM_STRENGTH 0.42           // [0.0 0.1 0.2 0.3 0.42 0.6 0.8 1.2]
#define BLOOM_THRESHOLD 1.05          // [0.4 0.7 1.0 1.05 1.5 2.0 3.0]

/* ============ WATER ============ */
#define WATER_WAVES 1                 // [0 1]
#define WATER_WAVE_HEIGHT 1.0         // [0.0 0.5 1.0 1.5 2.0]
#define WATER_REFLECTION 1.0          // [0.0 0.5 0.75 1.0 1.25 1.5]
#define WATER_CLARITY 1.0             // [0.5 0.75 1.0 1.5 2.0]
#define WATER_CAUSTICS 1              // [0 1]

/* ============ SKY / CLOUDS ============ */
#define CLOUDS_ENABLED 1              // [0 1]
#define CLOUD_QUALITY 4               // [2 3 4 5 6]
#define CLOUD_COVERAGE 1.0            // [0.5 0.75 1.0 1.25 1.5]
#define CLOUD_HEIGHT 220.0            // [140.0 180.0 220.0 300.0]
#define STARS 1                       // [0 1]
#define MILKY_WAY 1                   // [0 1]
#define CLOUD_SHADOWS 1               // [0 1]

/* ============ COLORS / EXPOSURE ============ */
#define EXPOSURE 1.0                  // [0.4 0.6 0.8 1.0 1.2 1.5 2.0]
#define SATURATION 1.08               // [0.4 0.6 0.8 0.9 1.0 1.08 1.2 1.4]
#define CONTRAST 1.06                 // [0.8 0.9 0.95 1.0 1.06 1.15 1.3]
#define WHITE_BALANCE 0.0             // [-0.3 -0.15 0.0 0.15 0.3]
#define TONEMAP_CURVE 1               // [0 1 2 3]
#define VIGNETTE 0.32                 // [0.0 0.15 0.25 0.32 0.5 0.8]
#define EMISSIVE_STRENGTH 1.0         // [0.0 0.5 1.0 1.5 2.0 3.0]

/* ============ REFLECTIONS ============ */
#define SSR_STEPS 20                  // [0 8 12 20 32 48]
#define SSR_STRENGTH 0.85             // [0.0 0.4 0.6 0.85 1.0]

/* ============ CAMERA FX ============ */
#define DOF 0                         // [0 1]
#define DOF_STRENGTH 1.0              // [0.5 1.0 1.5 2.0 3.0]
#define FXAA 1                        // [0 1]
#define SHARPEN 0.12                  // [0.0 0.06 0.12 0.2 0.3]
#define DITHER 1                      // [0 1]

/* ============ SKY ART ============ */
#define SUN_SIZE 1.0                  // [0.5 0.75 1.0 1.5 2.0]
#define SUN_GLOW 1.0                  // [0.0 0.5 1.0 1.5 2.0]

#endif
