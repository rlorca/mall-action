import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all([cp('index.html', 'dist/index.html'), cp('src', 'dist/src', {
  recursive: true, filter: source => !source.endsWith('.md')
})]);
console.log('Static build written to dist/');
