// Valida content/temas/tema-NN.json y publica dist/temas/N.json + index.json.
// Uso: node scripts/build-temas.mjs            (publica todos)
//      node scripts/build-temas.mjs --check content/temas/tema-03.json   (solo valida ese archivo)
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateTema } from '../dist/core.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bank = JSON.parse(await readFile(path.join(root, 'dist/bank.json'), 'utf8'));
async function load(file) {
  const tema = JSON.parse(await readFile(file, 'utf8'));
  const topic = validateTema(tema, bank);
  if (path.basename(file) !== `tema-${String(topic.id).padStart(2, '0')}.json`) throw Error(`${file}: el nombre no coincide con el tema ${topic.id}`);
  return tema;
}
const report = tema => { const per = {}; for (const s of Object.values(tema.questions)) per[s] = (per[s] ?? 0) + 1; return `tema ${tema.topic}: ${tema.sections.length} apartados, ${Object.keys(tema.questions).length} preguntas repartidas (${tema.sections.map(s => `${s.id}=${per[s.id] ?? 0}`).join(', ')})`; };
if (process.argv[2] === '--check') { console.log('Válido ·', report(await load(path.resolve(process.argv[3])))); process.exit(0); }
const dir = path.join(root, 'content/temas'), out = path.join(root, 'dist/temas');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const index = [];
for (const file of (await readdir(dir)).filter(f => /^tema-\d{2}\.json$/.test(f)).sort()) {
  const tema = await load(path.join(dir, file));
  await writeFile(path.join(out, `${tema.topic}.json`), JSON.stringify(tema) + '\n');
  index.push({ topic: tema.topic, sections: tema.sections.length, minutes: tema.minutes ?? null });
  console.log(report(tema));
}
await writeFile(path.join(out, 'index.json'), JSON.stringify({ version: bank.version, temas: index }, null, 1) + '\n');
console.log(`${index.length} temas publicados`);
