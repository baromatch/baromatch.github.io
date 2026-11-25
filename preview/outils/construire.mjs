// Écrit les aperçus des directions (preview/…/index.html) à partir des vrais matchs de la semaine, à l’instant figé de
// donnees.mjs. Usage : node preview/outils/construire.mjs
import { writeFileSync } from 'node:fs';
import { pageA } from './a.mjs';
import { pageB } from './b.mjs';
import { pageC } from './c.mjs';

const pages = { 'a-la-nuit': pageA, 'b-le-programme': pageB, 'c-la-salle': pageC };
for (const [dossier, page] of Object.entries(pages)) {
  const html = page();
  writeFileSync(new URL(`../${dossier}/index.html`, import.meta.url), html);
  console.log(`${dossier}/index.html`, html.length, 'octets');
}
