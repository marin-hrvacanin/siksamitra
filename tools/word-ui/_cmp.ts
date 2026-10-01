import { readFileSync } from 'node:fs';
import { lines, marks } from './lib.js';
const first = (JSON.parse(readFileSync('artifacts/word-ui/d1.json', 'utf8')).steps as { body?: string }[]).find((s) => s.body)!;
const reads = (JSON.parse(readFileSync('artifacts/word-ui/d4.json', 'utf8')).steps as { body?: string }[]).filter((s) => s.body);
const shape = (r: { body?: string }) => JSON.stringify(lines(r as never).map((l) => [l.tm.text, marks(l.tm)]));
for (const [i, r] of reads.entries()) {
  const ls = lines(r as never);
  console.log(`${['IAST', 'Telugu', 'Tamil', 'Devanāgarī again'][i]}: ${ls.map((l) => l.script).join(', ')} — ${shape(r) === shape(first) ? 'every letter and mark as marked' : 'DIFFERS'}`);
  console.log('   ' + ls[1]!.runs.filter((x) => x.hidden !== true).map((x) => x.text).join(''));
}
