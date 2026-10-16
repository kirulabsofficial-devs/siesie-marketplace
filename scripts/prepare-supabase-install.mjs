import { readFile, readdir, writeFile } from 'node:fs/promises';
const directory=new URL('../supabase/migrations/',import.meta.url);
const files=(await readdir(directory)).filter(file=>file.endsWith('.sql')).sort();
const sql=await Promise.all(files.map(async file=>`-- ${file}\n${await readFile(new URL(file,directory),'utf8')}`));
await writeFile(new URL('../supabase/install.sql',import.meta.url),`-- Run once in your Supabase SQL editor. Review first.\n-- Atomic setup: a failure rolls back all changes. No demo users or payments are seeded.\nbegin;\n\n${sql.join('\n\n')}\n\ncommit;\n`);
console.log(`Prepared supabase/install.sql from ${files.length} migrations.`);
