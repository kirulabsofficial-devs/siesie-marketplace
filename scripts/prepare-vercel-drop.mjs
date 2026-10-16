import { writeFile } from 'node:fs/promises';

// The built folder can be dropped directly into Vercel without another build.
const directory = process.argv[2] || 'vercel-dist';
if (!['vercel-dist','live-dist'].includes(directory)) throw new Error('Unknown build directory.');
await writeFile(new URL(`../${directory}/vercel.json`, import.meta.url), JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  buildCommand: '',
  outputDirectory: '.',
  rewrites: [{ source: '/(.*)', destination: '/index.html' }],
}, null, 2) + '\n');
console.log(`Vercel build ready: upload the ${directory} folder.`);
