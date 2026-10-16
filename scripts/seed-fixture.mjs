// Regenerate the minimal messaging fixture when the marketplace demo seed changes.
import { stripTypeScriptTypes } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const asModule = (source) => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const format = asModule(await readFile('src/lib/format.ts', 'utf8'));
const source = (await readFile('src/data/seed.ts', 'utf8')).replace('"../lib/format"', JSON.stringify(format));
const { createSeed } = await import(asModule(source));
const seed = createSeed(Date.UTC(2026, 8, 21));
const users = [
  ...seed.customers.map((u) => ({ ...u, role: 'customer' })),
  ...seed.workers.map((u) => ({ id: u.id, role: 'worker', name: u.name, phone: u.phone, area: u.baseArea, services: u.services, verified: u.verification === 'verified', joinedAt: u.joinedAt })),
  ...seed.admins.map((u) => ({ ...u, role: 'admin', area: '', joinedAt: new Date(0).toISOString() })),
];
const memberships = [...new Map(seed.jobs.map((j) => [`${j.customerId}:${j.workerId}`, { customerId: j.customerId, workerId: j.workerId }])).values()];
await mkdir('server', { recursive: true });
await writeFile('server/seed.json', JSON.stringify({ users, memberships }, null, 2) + '\n');
