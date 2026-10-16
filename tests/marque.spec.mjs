// Une seule identité, partout : ce que les pages disent de Baromatch vient de marque.json. Les profils « sameAs » de
// chaque page sont exactement les profils remplis de marque.json ; l’Organization de l’accueil reprend son nom, son
// slogan, sa description et son contact, avec un vrai logo carré. Et l’accueil garde, dans son <head>, l’emplacement
// de la vérification Bing (ou la balise elle-même, une fois collée).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { MARQUE, PROFILS } from './outils/marque.mjs';
import { fichierDe } from './outils/pages.mjs';

const ORIGINE = 'https://baromatch.fr';
const duDepot = (...morceaux) => path.join(racine, ...morceaux);

// Chaque page HTML publiée (suivie par git, ou nouvelle et pas ignorée), hors outils de test : les pages écrites à la
// main comme celles que le générateur écrit.
const PAGES_HTML = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.html'], { cwd: racine, encoding: 'utf8' })
  .split('\0').filter((fichier) => fichier && !fichier.startsWith('tests/') && existsSync(duDepot(fichier))).sort();

// Chaque nœud des données structurées d’un fichier HTML, @graph compris.
const noeuds = (valeur) => {
  if (Array.isArray(valeur)) return valeur.flatMap(noeuds);
  if (!valeur || typeof valeur !== 'object') return [];
  return [valeur, ...Object.values(valeur).flatMap(noeuds)];
};
const donneesDe = (fichier) => [...readFileSync(duDepot(fichier), 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap(([, json]) => noeuds(JSON.parse(json)));
const typesDe = (noeud) => [].concat(noeud['@type'] ?? []);

test('les profils (sameAs) de chaque page sont exactement les profils remplis de marque.json', () => {
  expect(PAGES_HTML).toContain('index.html');
  expect(PROFILS.length, 'marque.json n’a aucun profil rempli').toBeGreaterThan(0);
  const ecarts = [];
  for (const fichier of PAGES_HTML) {
    for (const noeud of donneesDe(fichier).filter((n) => 'sameAs' in n)) {
      const dit = [].concat(noeud.sameAs);
      if (JSON.stringify(dit) !== JSON.stringify(PROFILS)) ecarts.push(`${fichier} (${typesDe(noeud).join(', ')}) dit ${JSON.stringify(dit)}`);
    }
  }
  expect(ecarts, `Les profils de marque.json sont ${JSON.stringify(PROFILS)}. Recopie exactement cette liste, dans le même `
    + 'ordre, dans le « sameAs » des données structurées de chaque fichier nommé ici (entre <script type="application/ld+json"> '
    + 'et </script>).').toEqual([]);
  // L’accueil, lui, doit les dire : c’est là que Google et Bing relient Baromatch à ses profils.
  const [organisation] = donneesDe('index.html').filter((n) => typesDe(n).includes('Organization'));
  expect(organisation?.sameAs, `index.html : l’Organization doit avoir « sameAs »: ${JSON.stringify(PROFILS)}`).toEqual(PROFILS);
});

test('l’Organization de l’accueil dit ce que dit marque.json, avec un vrai logo carré en PNG', () => {
  const tous = donneesDe('index.html');
  const [organisation] = tous.filter((n) => typesDe(n).includes('Organization'));
  expect(organisation.name).toBe(MARQUE.nom);
  expect(organisation.url).toBe(MARQUE.site);
  expect(organisation.slogan).toBe(MARQUE.slogan);
  expect(organisation.description).toBe(MARQUE.description);
  expect(organisation.email).toBe(MARQUE.contact);
  expect(organisation.contactPoint.email).toBe(MARQUE.contact);
  const [appli] = tous.filter((n) => typesDe(n).includes('MobileApplication'));
  expect(appli.description).toBe(MARQUE.uneLigne);

  // Le logo : un PNG du site, carré, d’au moins 112 px (le minimum de Google pour un logo).
  expect(organisation.logo.startsWith(`${ORIGINE}/`)).toBe(true);
  const fichier = fichierDe(new URL(organisation.logo).pathname);
  const octets = readFileSync(fichier);
  expect(octets.readUInt32BE(0), `${organisation.logo} : pas un PNG`).toBe(0x89504e47);
  const [largeur, hauteur] = [octets.readUInt32BE(16), octets.readUInt32BE(20)];
  expect(largeur, 'logo carré').toBe(hauteur);
  expect(largeur).toBeGreaterThanOrEqual(112);
});

test('l’accueil garde l’emplacement de la vérification Bing, une seule fois, dans son <head>, juste après Google', () => {
  const source = readFileSync(fichierDe('/'), 'utf8').replace(/\r\n/g, '\n');
  const tete = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
  const corps = source.slice(source.indexOf('</head>'));
  const EMPLACEMENT = '<!-- BING_SITE_VERIFICATION -->';
  // Une fois la balise de Bing collée à sa place, elle compte comme l’emplacement.
  const BALISE = /<meta name="msvalidate\.01" content="[^"]+"\s*\/?>/g;
  const trouves = tete.split(EMPLACEMENT).length - 1 + (tete.match(BALISE) ?? []).length;
  expect(trouves, `index.html : il faut, dans le <head>, ${EMPLACEMENT} (ou la balise de Bing), une seule fois`).toBe(1);
  expect(corps).not.toContain(EMPLACEMENT);
  expect(corps).not.toMatch(BALISE);

  // Juste après la balise Google, avec sur la ligne d’avant un commentaire qui dit quoi y coller.
  const lignes = tete.split('\n');
  const ligne = lignes.findIndex((l) => l.trim() === EMPLACEMENT || /^<meta name="msvalidate\.01" content=/.test(l.trim()));
  expect(lignes[ligne - 2]).toContain('<meta name="google-site-verification"');
  expect(lignes[ligne - 1]).toMatch(/^<!-- Bing Webmaster Tools : remplace la ligne suivante par la balise de vérification que Bing donne/);
});
