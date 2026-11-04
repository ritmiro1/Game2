import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/patch-windows-exe.mjs <file.exe>');
const buffer = readFileSync(file);
if (buffer.toString('ascii', 0, 2) !== 'MZ') throw new Error('Not a Windows MZ executable');
const peOffset = buffer.readUInt32LE(0x3c);
if (buffer.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') throw new Error('PE header not found');
const optionalHeader = peOffset + 24;
const magic = buffer.readUInt16LE(optionalHeader);
if (magic !== 0x20b && magic !== 0x10b) throw new Error('Unknown optional PE header');
// IMAGE_OPTIONAL_HEADER::Subsystem: 2 = Windows GUI, 3 = Windows console.
buffer.writeUInt16LE(2, optionalHeader + 68);
writeFileSync(file, buffer);
console.log(`Patched ${file}: Windows GUI subsystem, no console window`);
