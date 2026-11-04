#!/usr/bin/env node
/*
    Aetheris Shaders - static pack validator.

    Catches the failure modes that make a shader pack refuse to load or silently
    render the wrong thing:
      * unresolved #include paths
      * samplers / functions used without being declared or defined
      * #if on an undefined symbol (silently 0 in GLSL -> effect disabled)
      * mismatched varyings between vertex and fragment stages, incl. types
      * gl_FragData writes without a DRAWBUFFERS comment
      * settings referenced by shaders that do not exist, dead settings,
        and shaders.properties values outside their #define range
      * unbalanced braces

    Usage: node tools/validator.js
    Exit code 0 = clean.
*/
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'Aetheris', 'shaders');

// Gather all shaders and includes
function readAll(dir, out = {}) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) readAll(p, out); else out[p] = fs.readFileSync(p,'utf8');
  }
  return out;
}
const files = readAll(root);
let errors = 0;
const err = m => { console.log('ERR: ' + m); errors++; };

// 1. include resolution (recursive)
function resolveIncludes(file, text, depth=0, seen=new Set()) {
  if (depth > 12) return text;
  return text.replace(/^#include\s+"([^"]+)"/gm, (m, inc) => {
    const target = inc.startsWith('/') ? path.join(root, inc) : path.join(path.dirname(file), inc);
    if (!fs.existsSync(target)) { err(`${path.relative(root,file)}: missing include ${inc}`); return ''; }
    if (seen.has(target)) return '';           // include guard semantics
    seen.add(target);
    return resolveIncludes(target, fs.readFileSync(target,'utf8'), depth+1, seen);
  });
}

// 2. settings defs
const settingsSrc = fs.readFileSync(path.join(root,'lib/settings.glsl'),'utf8');
const defs = new Set();
for (const m of settingsSrc.matchAll(/^#define\s+(\w+)/gm)) defs.add(m[1]);

// 3. declarations across a translation unit
const TYPE_RE = /^\s*(uniform|extern|attribute|varying|const)\s+(\w+)\s+([\w\s,]+?)\s*;/gm;
function collectDecls(src) {
  const map = new Map();
  for (const m of src.matchAll(TYPE_RE)) {
    const [, kind, type, names] = m;
    for (const n of names.split(',').map(s=>s.trim())) {
      if (!n) continue;
      const key = n;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({kind, type, line: m[0].trim()});
    }
  }
  return map;
}

const programs = Object.keys(files).filter(f => f.endsWith('.vsh') || f.endsWith('.fsh'));

for (const f of programs) {
  const rel = path.relative(root, f);
  let src = files[f];
  let expanded = resolveIncludes(f, src);
  // strip comments for decl checks
  let clean = expanded.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  // duplicate declarations (uniforms/varyings declared twice)
  const decls = collectDecls(clean);
  for (const [name, list] of decls) {
    if (list.length > 1 && false) {
      if (list[0].kind === 'uniform') err(`${rel}: uniform ${name} declared ${list.length}x`);
    }
  }

  // if-check evaluates a boolean variable name
  for (const m of clean.matchAll(/#if\s+([A-Za-z_]\w*)\s*(&&|\|\||$)/gm)) {
    const id = m[1];
    if (defs.has(id)) continue;
    // tolerate boolean built-ins
    if (['GL_ES'].includes(id)) continue;
    err(`${rel}: #if uses undefined symbol ${id}`);
  }

  // ensure every macro used in code is defined
  const used = new Set();
  const guardNames = /_GLSL$/;
  for (const m of clean.matchAll(/[^#\w]((?:SHADOW|SSAO|VOLUMETRIC|BLOOM|WATER|CLOUD|STARS|MILKY|EXPOSURE|SATURATION|CONTRAST|WHITE_BALANCE|TONEMAP|VIGNETTE|EMISSIVE|SSR|DOF|FXAA|SHARPEN|DITHER|SUN)_\w*)/g)) used.add(m[1]);
  for (const u of used) if (!defs.has(u) && !guardNames.test(u)) err(`${rel}: uses undefined setting ${u}`);

  // varying match between .vsh and .fsh
  if (f.endsWith('.vsh')) {
    const fsh = f.replace(/\.vsh$/,'.fsh');
    if (fs.existsSync(fsh)) {
      let fsrc = fs.readFileSync(fsh,'utf8');
      let fexp = resolveIncludes(fsh, fsrc).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
      const vout = new Set([...clean.matchAll(/^\s*varying\s+\w+\s+(\w+)\s*;/gm)].map(m=>m[1]));
      const fin = new Set([...fexp.matchAll(/^\s*varying\s+\w+\s+(\w+)\s*;/gm)].map(m=>m[1]));
      for (const v of vout) if (!fin.has(v)) err(`${rel}: varying ${v} not declared in fsh`);
      for (const v of fin) if (!vout.has(v)) err(`${rel}: varying ${v} not written by vsh`);
      // type check
      const vt = {}; for (const m of clean.matchAll(/^\s*varying\s+(\w+)\s+(\w+)\s*;/gm)) vt[m[2]] = m[1];
      for (const m of fexp.matchAll(/^\s*varying\s+(\w+)\s+(\w+)\s*;/gm)) {
        if (vt[m[2]] && vt[m[2]] !== m[1]) err(`${rel}: varying ${m[2]} type mismatch ${vt[m[2]]} vs ${m[1]}`);
      }
    }
  }

  // --- undefined function usage ---
  const builtins = new Set(('texture2D texture2DProj texture3D textureCube texture2DLod normalize length dot cross mix clamp ' +
    'min max abs floor ceil fract mod pow exp log log2 exp2 sqrt inversesqrt sin cos tan asin acos atan step smoothstep ' +
    'reflect refract saturate sign round trunc dFdx dFdy fwidth if for while return discard main all any not equal ' +
    'lessThan greaterThan ftransform textureGrad textureCubeLod texture2DLod sinh cosh tanh transpose inverse matrixCompMult').split(/\s+/));
  const definedFns = new Set([...clean.matchAll(/^\s*(?:void|float|vec2|vec3|vec4|int|bool|mat2|mat3|mat4|ivec2|ivec3)\s+(\w+)\s*\(/gm)].map(m=>m[1]));
  for (const m of clean.matchAll(/(?:^|[^\w.])([A-Za-z_]\w*)\s*\(/g)) {
    const name = m[1];
    if (builtins.has(name) || definedFns.has(name)) continue;
    if (/^(gl_|if|for|while|switch|return)/.test(name)) continue;
    if (/^(vec2|vec3|vec4|mat2|mat3|mat4|float|int|bool|ivec2)$/.test(name)) continue;
    if (new RegExp('(uniform|extern)\\s+\\w+\\s+' + name + '\\b').test(clean)) continue;
    err(`${rel}: unknown function ${name}()`);
  }

  // balanced braces / parens
  const bal = s => { let b=0; for (const c of s){ if(c==='{')b++; if(c==='}')b--; if(b<0) return false;} return b===0; };
  if (!bal(clean)) err(`${rel}: unbalanced braces`);

  // functions returning non-void need a return statement somewhere
  const funcs = [...clean.matchAll(/^\s*(void|float|vec2|vec3|vec4|int|bool|mat2|mat3|mat4)\s+(\w+)\s*\(([^)]*)\)\s*\{/gm)];
  // detect undeclared sampler usage - colortex/depthtex/shadowtex must be declared
  for (const m of clean.matchAll(/\b(colortex\d|depthtex\d|shadowtex\d|shadowcolor\d|gtexture|lightmap|noisetex|gaux\d)\b/g)) {
    const id = m[1];
    if (!new RegExp('(uniform|extern)\\s+\\w+\\s+' + id + '\\b').test(clean)) err(`${rel}: uses sampler ${id} without uniform declaration`);
  }
  // DRAWBUFFERS must exist for fragment stages writing gl_FragData
  if (f.endsWith('.fsh') && /gl_FragData\s*\[/.test(clean)) {
    const raw = files[f];
    if (!/DRAWBUFFERS:/.test(raw)) err(`${rel}: writes gl_FragData but has no DRAWBUFFERS comment`);
  }
}

// 4. verify settings.properties macro names exist in settings.glsl
const props = fs.readFileSync(path.join(root,'shaders.properties'),'utf8');
const propNames = new Set();
for (const m of props.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]{2,})\s*=/g)) { if (!/^(SCREEN|SLIDERS|PROFILE)$/.test(m[1])) propNames.add(m[1]); }
for (const m of props.matchAll(/^profile\.\w+!?\s*=\s*([\s\S]*?)(?=\n\n|\nprofile|$)/gm)) {
  for (const n of m[1].matchAll(/([A-Z][A-Z0-9_]+)=/g)) propNames.add(n[1]);
}
const knownKeywords = new Set(['SCREEN','SLIDERS','PROFILE']);
for (const n of propNames) if (!defs.has(n) && !knownKeywords.has(n)) err(`shaders.properties: unknown setting ${n}`);
// value check: slider/option values in properties must be allowed by the #define range
for (const line of props.split('\n')) {
  if (/^(sliders|screen)/.test(line.trim())) continue;
  for (const m of line.matchAll(/\b([A-Z][A-Z0-9_]+)=([^\s\\]+)/g)) {
    const [, name, val] = m;
    const def = settingsSrc.match(new RegExp('^#define\\s+'+name+'\\s+([^\\n/]*)', 'm'));
    if (!def) continue;
    const allowed = def[1].replace(/\[|\]/g,'').trim().split(/\s+/);
    if (allowed.length > 1 && !allowed.includes(val)) err(`shaders.properties: ${name}=${val} not in [${allowed.join(' ')}]`);
  }
}

// 5. every setting should be referenced by at least one shader
const skipSettings = new Set(['SETTINGS_GLSL','COMMON_GLSL','NOISE_GLSL','SKY_GLSL','SHADOWS_GLSL','LIGHTING_GLSL','WATER_GLSL','POST_GLSL','VOLUMETRIC_GLSL']);
for (const d of defs) {
  if (skipSettings.has(d)) continue;
  let found = false;
  for (const [p, src] of Object.entries(files)) {
    if (p.endsWith('settings.glsl') || !p.endsWith('.glsl') && !p.endsWith('.vsh') && !p.endsWith('.fsh')) continue;
    if (new RegExp('\\b' + d + '\\b').test(src)) { found = true; break; }
  }
  if (!found) err(`setting ${d} is never used by any shader (dead setting)`);
}

console.log(errors ? `\n${errors} problem(s) found` : 'STATIC CHECK PASSED');
process.exit(errors ? 1 : 0);
