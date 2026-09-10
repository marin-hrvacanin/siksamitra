/**
 * WRITE THE JOB FILE THE POWERSHELL SIDE READS, and print what it contains.
 *
 * Two processes, one job: node knows the add-in's code and PowerShell knows
 * COM, and neither can be taught the other's half. The job is a JSON file
 * naming the payload files and what to look for — so a failure is readable
 * afterwards without re-running Word.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writePayloads } from './emit.mjs';

const p = writePayloads();
const slash = (s: string): string => s.split('\\').join('/');

const job = {
  specimen: slash(p.specimen),
  marked: slash(p.marked),
  wanted: p.styles,
  text: p.text,
};
const file = join(p.dir, 'job.json');
writeFileSync(file, `${JSON.stringify(job, null, 1)}\n`, 'utf8');
console.log(file);
console.log(`  ${p.styles.length} styles: ${p.styles.join(' ')}`);
console.log(`  line: ${p.text}`);
