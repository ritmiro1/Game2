import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
const dir = process.env.LIFEOS_SMOKE_DIR;
if (!dir) throw new Error('Set LIFEOS_SMOKE_DIR to an isolated test directory');
await mkdir(dir, { recursive: true });
const binary = process.env.LIFEOS_EXE || (await import('electron')).default;
const child = spawn(binary, process.env.LIFEOS_EXE ? ['--smoke-test'] : ['.', '--smoke-test'], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (b) => {
    log += b;
    process.stdout.write(b);
  });
const timeout = setTimeout(() => {
  console.error('Electron smoke timeout');
  child.kill();
}, 90000);
try {
  const [code] = await once(child, 'exit');
  await writeFile(join(dir, 'electron-log.txt'), log);
  if (code !== 0) throw new Error('Electron smoke failed: ' + code);
  const result = JSON.parse(await readFile(join(dir, 'smoke-result.json'), 'utf8'));
  if (!result.ok || !result.checks?.includes('real-webcontentsview-load-and-privilege-isolation'))
    throw new Error('Missing complete smoke checks');
  console.log(JSON.stringify(result, null, 2));
} finally {
  clearTimeout(timeout);
}
