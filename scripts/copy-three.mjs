import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'three', 'build');
const target = path.join(root, 'public', 'vendor');

await mkdir(target, { recursive: true });
for (const file of ['three.module.js', 'three.core.js']) {
  await copyFile(path.join(source, file), path.join(target, file));
  console.log(`[vendor] ${file}`);
}
