// Le partage des pages de match, de ville et de bar : leur image d’aperçu (generateur/partage.mjs, rendue par
// generateur/images) et le bloc « Partager » (partage.js). L’image : 1200 × 630, moins de 150 Ko, à côté de sa page,
// annoncée en og:image et twitter:image à son adresse absolue, avec le vrai nombre de bars (jamais « 0 bar »), refaite
// seulement quand son dessin change, partie avec sa page ; sans le rendu, l’image générale du site.
// Le rendu est installé ici comme dans l’Action : cd generateur/images && npm ci.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { construireLeSiteDExemple, contenuDuScenario, PUBLIES_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { lireLeCadre } from '../generateur/gabarits.mjs';
import { svgDeLaCarte } from '../generateur/partage.mjs';

const ORIGINE = 'https://baromatch.fr';
const IMAGE_DU_SITE = `${ORIGINE}/img/og-image.jpg`;
const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
const ENREGISTREMENT = Date.parse('2026-10-15T19:44:29Z');
const contenu = contenuDuScenario();

// Lu dans l’en-tête du fichier lui-même : la signature PNG, puis la largeur et la hauteur (IHDR).
const lirePng = (fichier) => {
  const octets = readFileSync(fichier);
  return {
    png: octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && octets.toString('ascii', 12, 16) === 'IHDR',
    largeur: octets.readUInt32BE(16),
    hauteur: octets.readUInt32BE(20),
    poids: octets.length,
  };
};
// Le contenu d’une balise meta, tel que le lit un robot : entités décodées, espaces insécables en espaces.
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"' };
const meta = (html, nom) => [...html.matchAll(new RegExp(`<meta (?:property|name)="${nom.replace(/[:.]/g, '\\$&')}" content="([^"]*)">`, 'g'))]
  .map((m) => m[1].replace(/&(amp|lt|gt|quot);/g, (_, n) => ENTITES[n]).replace(/ /g, ' '));
const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'partage-'));
  dossiers.push(dossier);
  return dossier;
};
test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

test.describe('les images de partage', () => {
  let sortie;
  let resultat;
  test.beforeAll(async () => {
    sortie = dossierVide();
    resultat = await construireLeSiteDExemple(sortie);
  });
  const lire = (relatif) => readFileSync(path.join(sortie, relatif), 'utf8');

  test('une image PNG de 1200 × 630, de moins de 150 Ko, à côté de chaque page de match, de ville et de bar', () => {
    const images = resultat.fichiers.filter((f) => f.type === 'partage');
    const types = images.map((f) => resultat.fichiers.find((p) => `${p.chemin}partage.png` === f.chemin).type);
    expect(new Set(types)).toEqual(new Set(['match', 'ville', 'bar']));
    for (const image of images) {
      expect(image.chemin).toMatch(/^\/(?:matchs|regarder-le-match|bar)\/[a-z0-9-]+\/partage\.png$/);
      expect(lirePng(path.join(sortie, image.chemin))).toEqual({ png: true, largeur: 1200, hauteur: 630, poids: expect.any(Number) });
      expect(lirePng(path.join(sortie, image.chemin)).poids, image.chemin).toBeLessThan(150 * 1024);
    }
    // Ni la semaine, ni l’index des villes, ni une page de match passé n’en ont : l’image générale du site.
    for (const chemin of ['matchs/index.html', 'regarder-le-match/index.html', 'matchs/om-lens-2026-10-22/index.html']) {
      if (!existsSync(path.join(sortie, chemin))) continue;
      expect(meta(lire(chemin), 'og:image'), chemin).toEqual([IMAGE_DU_SITE]);
    }
    expect(existsSync(path.join(sortie, 'matchs/partage.png'))).toBe(false);
    expect(existsSync(path.join(sortie, 'regarder-le-match/partage.png'))).toBe(false);
  });

  test('og:image et twitter:image : l’adresse absolue de son image, ses dimensions, ce qu’elle montre', () => {
    const pages = resultat.fichiers.filter((f) => ['match', 'ville', 'bar'].includes(f.type) && f.carte);
    expect(pages.length).toBeGreaterThan(10);
    for (const p of pages) {
      const html = p.contenu;
      const adresse = `${ORIGINE}${p.chemin}partage.png`;
      expect(meta(html, 'og:image'), p.chemin).toEqual([adresse]);
      expect(meta(html, 'twitter:image'), p.chemin).toEqual([adresse]);
      expect(meta(html, 'og:image:width')).toEqual(['1200']);
      expect(meta(html, 'og:image:height')).toEqual(['630']);
      expect(meta(html, 'og:image:alt')).toEqual([p.carte.alt]);
      expect(existsSync(path.join(sortie, p.chemin, 'partage.png'))).toBe(true);
    }
  });

  test('le vrai nombre de vrais bars : « 1 bar le diffuse », « 2 bars le diffusent », et sans bar, jamais « 0 bar »', () => {
    const carteDe = (chemin) => resultat.fichiers.find((f) => f.chemin === chemin).carte;
    expect(carteDe('/matchs/lille-lens-2026-10-26/')).toMatchObject({ titre: 'Lille – Lens', ambre: 'Où le regarder à Paris' });
    expect(carteDe('/matchs/brest-nice-2026-10-23/')).toMatchObject({ titre: 'Brest – Nice', ambre: '1 bar le diffuse à Lyon' });
    expect(carteDe('/matchs/psg-ol-2026-10-25/')).toMatchObject({ titre: 'PSG – OL', ligne: 'Dimanche 25 octobre · 20:45', ambre: '2 bars le diffusent à Lyon et Paris' });
    expect(carteDe('/regarder-le-match/paris/')).toMatchObject({ titre: 'Paris', ligne: '2 bars sur Baromatch' });
    expect(carteDe('/regarder-le-match/marseille/')).toMatchObject({ titre: 'Marseille', ligne: 'Le guide des soirs de match', ambre: '' });
    expect(carteDe('/bar/au-bon-coin-lyon-2/')).toMatchObject({ titre: 'Au Bon Coin', ligne: 'On diffuse le match', ambre: '' });
    // Sur chaque page de match, le nombre de l’image est celui des cartes de bars de la page.
    for (const p of resultat.fichiers.filter((f) => f.type === 'match' && f.carte)) {
      const cartes = (p.contenu.match(/<li class="regarder-carte">/g) ?? []).length;
      if (cartes === 0) expect(p.carte.ambre, p.chemin).toBe('Où le regarder à Paris');
      else expect(p.carte.ambre, p.chemin).toMatch(new RegExp(`^${cartes} bars? le diffusen?t? à `));
    }
    // Le texte de chaque image, tel qu’il est dessiné : jamais « 0 bar », ni score, ni « ! ».
    const { verre } = lireLeCadre(racine);
    for (const p of resultat.fichiers.filter((f) => f.carte)) {
      const svg = svgDeLaCarte(p.carte, { verre });
      const dessine = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' · ');
      expect(dessine, p.chemin).not.toMatch(/\b0 bars?\b|\d\s*[-–]\s*\d|!/);
      expect(dessine).toContain(p.carte.titre.replace(/&/g, '&amp;'));
      expect(svg).not.toMatch(/<image|href=|https?:\/\/(?!www\.w3\.org)/);
    }
  });

  test('la copie enregistrée de ce soir (aucun vrai bar) : aucun nombre de bars, nulle part', async () => {
    const site = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: ENREGISTREMENT, racine, contenu: chargerLeContenu(racine), images: true });
    const cartes = site.pages.filter((p) => p.carte);
    expect(cartes.filter((p) => p.type === 'match').length).toBeGreaterThan(5);
    expect(site.pages.filter((p) => p.type === 'bar')).toEqual([]);
    for (const p of cartes) {
      expect(`${p.carte.ligne} ${p.carte.ambre} ${p.carte.alt}`, p.chemin).not.toMatch(/\d+ bars?\b/);
      if (p.type === 'match') expect(p.carte.ambre).toBe('Où le regarder à Paris');
      if (p.type === 'ville') expect([p.carte.ligne, p.carte.ambre]).toEqual(['Le guide des soirs de match', '']);
    }
  });

  test('la liste blanche : partage.png à côté d’une page, rien d’autre', () => {
    for (const permis of ['matchs/psg-ol-2026-10-25/partage.png', 'regarder-le-match/paris/partage.png', 'bar/le-zinc-des-amis-paris-11/partage.png']) expect(estPermis(permis), permis).toBe(true);
    for (const refuse of ['partage.png', 'img/partage.png', 'matchs/x/partage.jpg', 'matchs/x/autre.png', 'tests/x/partage.png', 'matchs/../partage.png']) expect(estPermis(refuse), refuse).toBe(false);
  });
});

test.describe('d’un passage à l’autre', () => {
  const passer = (sortie, maintenant, options = {}) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu, ...options });
  const images = (dossier) => ['matchs', 'regarder-le-match', 'bar'].flatMap((d) => readdirSync(path.join(dossier, d), { recursive: true }).filter((f) => f.endsWith('partage.png')).map((f) => `/${d}/${f}`)).sort();
  const etatDe = (dossier) => JSON.parse(readFileSync(path.join(dossier, 'regarder-le-match/etat.json'), 'utf8'));

  test('une image n’est refaite que si son dessin change, et part avec sa page', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    const avant = images(sortie);
    expect(avant).toContain('/matchs/psg-ol-2026-10-25/partage.png');
    expect(avant).toContain('/bar/le-zinc-des-amis-paris-11/partage.png');
    expect(avant).toContain('/matchs/om-lens-2026-10-22/partage.png');
    const rennes = path.join(sortie, 'regarder-le-match/rennes/partage.png');
    const dateDeRennes = statSync(rennes).mtimeMs;
    // Chaque image a son entrée dans l’état : pas indexable, l’empreinte de son dessin.
    expect(etatDe(sortie).pages['/regarder-le-match/rennes/partage.png']).toMatchObject({ type: 'partage', cle: 'rennes', indexable: false, empreinte: expect.stringMatching(/^[\w-]{22}$/) });

    // Le même passage refait : aucune image refaite ni réécrite.
    expect((await passer(sortie, '2026-10-21T08:00:00Z')).ecrits).toEqual([]);
    expect(statSync(rennes).mtimeMs).toBe(dateDeRennes);

    // Le Zinc retiré de la liste des bars publiés : l’image de Paris et celle de PSG – OL changent (un bar de moins),
    // celle du Zinc part (sa page reste 30 jours, sans son nom, avec l’image générale), Rennes ne bouge pas.
    const resultat = await passer(sortie, '2026-10-22T08:00:00Z', { contenu: { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') } });
    expect(resultat.ecrits).toEqual(expect.arrayContaining(['/regarder-le-match/paris/partage.png', '/matchs/psg-ol-2026-10-25/partage.png']));
    expect(resultat.ecrits).not.toContain('/regarder-le-match/rennes/partage.png');
    expect(statSync(rennes).mtimeMs).toBe(dateDeRennes);
    expect(resultat.supprimees).toContain('/bar/le-zinc-des-amis-paris-11/partage.png');
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11/partage.png'))).toBe(false);
    const parti = readFileSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11/index.html'), 'utf8');
    expect(meta(parti, 'og:image')).toEqual([IMAGE_DU_SITE]);

    // Le match joué : sa page reste 30 jours (« Ce match est passé »), sans image ni bloc « Partager ».
    await passer(sortie, '2026-10-23T08:00:00Z', { contenu: { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') } });
    expect(existsSync(path.join(sortie, 'matchs/om-lens-2026-10-22/index.html'))).toBe(true);
    expect(existsSync(path.join(sortie, 'matchs/om-lens-2026-10-22/partage.png'))).toBe(false);
    // 30 jours plus tard, les pages disparues partent avec tout leur dossier, et l’état les oublie.
    await passer(sortie, '2026-11-23T08:00:00Z', { contenu: { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') } });
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11'))).toBe(false);
    expect(existsSync(path.join(sortie, 'matchs/om-lens-2026-10-22'))).toBe(false);
    expect(Object.keys(etatDe(sortie).pages).filter((c) => c.includes('om-lens-2026-10-22') || c.includes('le-zinc'))).toEqual([]);
    for (const image of images(sortie)) expect(existsSync(path.join(sortie, image.replace(/partage\.png$/, 'index.html'))), image).toBe(true);
  });

  test('sans le rendu des images : l’image générale du site et un avertissement ; exigé (l’Action), rien n’est écrit', async () => {
    const sortie = dossierVide();
    const journal = [];
    await passer(sortie, '2026-10-21T08:00:00Z');
    expect(images(sortie).length).toBeGreaterThan(10);
    // Sans le rendu, les images partent et chaque page reprend l’image générale du site.
    await passer(sortie, '2026-10-21T08:00:00Z', { rendu: null, journal: (ligne) => journal.push(ligne) });
    expect(journal.filter((l) => /images de partage/.test(l))).toEqual([expect.stringMatching(/^avertissement : images de partage : .* chaque page garde l’image générale du site\.$/)]);
    expect(images(sortie)).toEqual([]);
    const html = readFileSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/index.html'), 'utf8');
    expect(meta(html, 'og:image')).toEqual([IMAGE_DU_SITE]);
    expect(meta(html, 'twitter:image')).toEqual([IMAGE_DU_SITE]);

    const vide = dossierVide();
    await expect(passer(vide, '2026-10-21T08:00:00Z', { rendu: null, images: 'exiger' })).rejects.toThrow(/Images de partage exigées, rien n’est écrit/);
    expect(readdirSync(vide)).toEqual([]);
  });

  test('la bibliothèque du rendu : une version exacte, dans son dossier, que seule l’Action installe', () => {
    const paquet = JSON.parse(readFileSync(path.join(racine, 'generateur/images/package.json'), 'utf8'));
    const verrou = JSON.parse(readFileSync(path.join(racine, 'generateur/images/package-lock.json'), 'utf8'));
    expect(Object.keys(paquet.dependencies)).toEqual(['@resvg/resvg-js']);
    expect(paquet.dependencies['@resvg/resvg-js']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(verrou.packages['node_modules/@resvg/resvg-js'].version).toBe(paquet.dependencies['@resvg/resvg-js']);
    expect(verrou.packages['node_modules/@resvg/resvg-js'].integrity).toMatch(/^sha512-/);
    const racineDuSite = JSON.parse(readFileSync(path.join(racine, 'package.json'), 'utf8'));
    expect(JSON.stringify(racineDuSite)).not.toContain('resvg');
    // Les polices du rendu, avec leur licence (OFL, celle de la police du site).
    expect(readdirSync(path.join(racine, 'generateur/images/polices')).sort()).toEqual(['LICENSE-OFL.txt', 'bricolage-grotesque-texte.ttf', 'bricolage-grotesque-titre.ttf']);
    expect(readFileSync(path.join(racine, 'generateur/images/polices/LICENSE-OFL.txt'), 'utf8')).toBe(readFileSync(path.join(racine, 'fonts/LICENSE-OFL.txt'), 'utf8'));
  });
});
