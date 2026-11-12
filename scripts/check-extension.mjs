import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve("extension");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const requiredPermissions = ["tabs", "sessions", "storage", "alarms"];
const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version должен быть 3.");
for (const permission of requiredPermissions) {
  if (!manifest.permissions?.includes(permission)) errors.push(`Не хватает разрешения ${permission}.`);
}
if (manifest.host_permissions?.length) errors.push("Расширению не нужны host_permissions.");
if (!manifest.content_security_policy?.extension_pages?.includes("wasm-unsafe-eval")) {
  errors.push("Для локального Stockfish WASM нужен wasm-unsafe-eval в CSP расширения.");
}

const paths = [manifest.background?.service_worker, manifest.action?.default_popup, ...Object.values(manifest.icons || {})].filter(Boolean);
for (const asset of paths) {
  try {
    await stat(path.join(root, asset));
  } catch {
    errors.push(`Файл из manifest.json не найден: ${asset}`);
  }
}

async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(fullPath));
    else found.push(fullPath);
  }
  return found;
}

const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  const references = [
    ...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
    ...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi),
  ];
  for (const reference of references) {
    const resource = reference[1];
    if (/^https?:/i.test(resource)) {
      errors.push(`Внешний ресурс в ${path.relative(root, htmlFile)}: ${resource}`);
      continue;
    }
    try {
      await stat(path.resolve(path.dirname(htmlFile), resource));
    } catch {
      errors.push(`Не найден ${resource} из ${path.relative(root, htmlFile)}.`);
    }
  }
}

for (const file of files.filter((entry) => entry.endsWith(".js") && !entry.includes(`${path.sep}vendor${path.sep}`))) {
  const source = await readFile(file, "utf8");
  const moduleFile = file.includes(`${path.sep}chess${path.sep}`);
  const result = spawnSync(process.execPath, moduleFile ? ["--input-type=module", "--check"] : ["--check"], {
    input: source,
    encoding: "utf8",
  });
  if (result.status !== 0) errors.push(`Синтаксическая ошибка в ${path.relative(root, file)}: ${result.stderr || result.stdout}`);
}

for (const file of [
  "vendor/chess.js",
  "vendor/CHESS-LICENSE.txt",
  "vendor/stockfish-19-lite-single.js",
  "vendor/stockfish-19-lite-single.wasm",
  "vendor/STOCKFISH-LICENSE.txt",
  "vendor/espeak/espeak-ng.js",
  "vendor/espeak/espeak-ng.wasm",
  "vendor/espeak/ESPEAK-LICENSE.txt",
  "vendor/espeak/UPSTREAM.txt",
]) {
  try {
    await stat(path.join(root, file));
  } catch {
    errors.push(`Отсутствует встроенный ресурс: ${file}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `✗ ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`✓ Manifest, ${htmlFiles.length} HTML-страницы, локальные ресурсы и JavaScript проверены.`);
  console.log("✓ Host permissions не запрашиваются; Stockfish, Chess.js и eSpeak-NG включены в пакет.");
}
