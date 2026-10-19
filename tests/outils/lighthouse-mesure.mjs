// Lighthouse avec la mesure d’audience active, mobile et ordinateur, sur l’accueil et une page de match : le site
// d’exemple (site-genere.mjs) construit avec un code de mesure d’essai, servi en HTTPS à l’adresse du vrai site
// (https://baromatch.fr, le seul endroit où /mesure.js compte) par un petit serveur local, que Chromium joint à sa place
// (--host-resolver-rules, sans passer par l’intermédiaire réseau de la machine). Le même serveur répond pour
// le compte GoatCounter d’essai, comme lui (un GIF) : rien ne part vers le vrai service. Son certificat est fait pour
// l’occasion (openssl), et Chromium l’accepte (--ignore-certificate-errors) ; comme GitHub Pages, il sert chaque
// fichier avec max-age=600.
// Usage : npm run lighthouse:mesure [-- <port>] [--sans-mesure]   (4276 par défaut)
// --sans-mesure : la même mesure, le code vide, pour comparer (aucune visite ne doit alors être comptée).
// Écrit un JSON par mesure et resume.md dans lighthouse/mesure/ (ou lighthouse/sans-mesure/), que git ignore. La
// commande échoue (code 1) si une note est sous 95, ou si une page n’a pas été comptée (ou l’a été sans mesure).
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';
import { CHROMIUM, racine } from './environnement.mjs';
import { construireLeSiteDExemple } from './site-genere.mjs';

const executer = promisify(execFile);
const site = path.join(racine, 'lighthouse', 'mesure-site');
const sansMesure = process.argv.includes('--sans-mesure');
const sortie = path.join(racine, 'lighthouse', sansMesure ? 'sans-mesure' : 'mesure');
const cles = path.join(racine, 'lighthouse', 'mesure-certificat');
const port = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 4276);
const CODE = 'essai';
const COMPTE = `${CODE}.goatcounter.com`;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const SEUIL = 95;
const APPAREILS = [{ nom: 'mobile', options: [] }, { nom: 'ordinateur', options: ['--preset=desktop'] }];
const PAGES = [
  { chemin: '/', nom: 'accueil' },
  { chemin: '/matchs/psg-ol-2026-10-25/', nom: 'match-psg-ol' },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4',
};
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const binaire = path.join(racine, 'node_modules', 'lighthouse', 'cli', 'index.js');
const jsonDe = (page, appareil) => path.join(sortie, `${page.nom}.${appareil.nom}.json`);

// Un certificat pour baromatch.fr et le compte d’essai, valable un jour.
const certificat = () => {
  mkdirSync(cles, { recursive: true });
  const cle = path.join(cles, 'cle.pem');
  const cert = path.join(cles, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=baromatch.fr',
    '-addext', `subjectAltName=DNS:baromatch.fr,DNS:${COMPTE}`, '-keyout', cle, '-out', cert], { stdio: 'ignore' });
  return { key: readFileSync(cle), cert: readFileSync(cert) };
};

const demarrer = (comptees) => new Promise((resoudre) => {
  const serveur = createServer(certificat(), (requete, reponse) => {
    const url = new URL(requete.url, `https://${requete.headers.host}`);
    if (url.hostname === COMPTE) {
      comptees.push(url.searchParams.get('p'));
      reponse.writeHead(200, { 'content-type': 'image/gif', 'access-control-allow-origin': '*' });
      reponse.end(GIF);
      return;
    }
    const relatif = decodeURIComponent(url.pathname).replace(/^\//, '');
    const fichier = [relatif === '' || relatif.endsWith('/') ? `${relatif}index.html` : relatif, `${relatif}.html`]
      .find((f) => !f.endsWith('/') && existsSync(path.join(site, f)));
    const servi = fichier ?? '404.html';
    reponse.writeHead(fichier ? 200 : 404, { 'content-type': TYPES[path.extname(servi)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' });
    reponse.end(readFileSync(path.join(site, servi)));
  });
  serveur.listen(port, '127.0.0.1', () => resoudre(serveur));
});

const principal = async () => {
  mkdirSync(sortie, { recursive: true });
  const marque = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
  await construireLeSiteDExemple(site, { marque: { ...marque, mesure: { ...marque.mesure, outil: 'goatcounter', code: sansMesure ? '' : CODE } } });
  const comptees = [];
  const serveur = await demarrer(comptees);
  const regles = `MAP baromatch.fr 127.0.0.1:${port},MAP ${COMPTE} 127.0.0.1:${port}`;
  const resultats = [];
  try {
    for (const page of PAGES) {
      for (const appareil of APPAREILS) {
        const avant = comptees.length;
        await executer(process.execPath, [
          binaire, `https://baromatch.fr${page.chemin}`, '--quiet', '--output=json', `--output-path=${jsonDe(page, appareil)}`,
          `--only-categories=${CATEGORIES.join(',')}`,
          `--chrome-flags=--headless=new --no-sandbox --disable-gpu --host-resolver-rules="${regles}" --no-proxy-server --ignore-certificate-errors`,
          ...appareil.options,
        ], { env: { ...process.env, CHROME_PATH: CHROMIUM }, maxBuffer: 64 * 1024 * 1024 });
        const rapport = JSON.parse(readFileSync(jsonDe(page, appareil), 'utf8'));
        resultats.push({
          page: page.nom,
          appareil: appareil.nom,
          notes: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((rapport.categories[c]?.score ?? 0) * 100)])),
          comptees: comptees.slice(avant).filter((p) => p === page.chemin).length,
        });
      }
    }
  } finally {
    serveur.close();
  }
  const lignes = ['| Page | Appareil | Performance | Accessibilité | Bonnes pratiques | SEO | Visites comptées |', '|---|---|---|---|---|---|---|',
    ...resultats.map((r) => `| ${r.page} | ${r.appareil} | ${CATEGORIES.map((c) => r.notes[c]).join(' | ')} | ${r.comptees} |`)];
  writeFileSync(path.join(sortie, 'resume.md'), `${lignes.join('\n')}\n`);
  for (const r of resultats) console.log(`${r.page} · ${r.appareil} · P ${r.notes.performance} · A ${r.notes.accessibility} · BP ${r.notes['best-practices']} · SEO ${r.notes.seo} · ${r.comptees} visites comptées`);
  const echecs = [
    ...resultats.flatMap((r) => CATEGORIES.filter((c) => r.notes[c] < SEUIL).map((c) => `${r.page} · ${r.appareil} · ${c} ${r.notes[c]}`)),
    ...resultats.filter((r) => (r.comptees === 0) !== sansMesure).map((r) => `${r.page} · ${r.appareil} : ${r.comptees} visites comptées`),
  ];
  if (echecs.length) {
    console.error(`Échecs :\n${echecs.join('\n')}`);
    process.exitCode = 1;
  }
};

await principal();
