import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of ['index.html', 'src', 'public']) {
  await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
}
console.log('Built static site to dist/');
