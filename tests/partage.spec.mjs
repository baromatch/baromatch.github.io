// Le partage des pages de match, de ville et de bar : leur image d’aperçu (generateur/partage.mjs, rendue par
// generateur/images) et le bloc « Partager » (partage.js). L’image : 1200 × 630, moins de 150 Ko, à côté de sa page,
// annoncée en og:image et twitter:image à son adresse absolue, avec le vrai nombre de bars (jamais « 0 bar »), refaite
// seulement quand son dessin change, partie avec sa page ; sans le rendu, l’image générale du site. Le bloc : sans
// JavaScript, WhatsApp et l’adresse ; avec, le bouton du téléphone s’il existe, sinon WhatsApp et « Copier le lien » ;
// toujours l’adresse canonique, sans paramètre.
// Le rendu est installé ici comme dans l’Action : cd generateur/images && npm ci.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, PUBLIES_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { lireLeCadre } from '../generateur/gabarits.mjs';
import { controlerLaPage } from '../generateur/controle.mjs';
import { SCRIPT_DU_PARTAGE, svgDeLaCarte } from '../generateur/partage.mjs';

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
    expect(parti).not.toContain('class="partage"');

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

  test('une page refusée : gardée, elle garde son image ; remplacée par la page neutre, son image part avec elle', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    const octets = (relatif) => readFileSync(path.join(sortie, relatif));
    const brest = { image: octets('matchs/brest-nice-2026-10-23/partage.png'), etat: etatDe(sortie).pages['/matchs/brest-nice-2026-10-23/partage.png'] };
    expect(existsSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/partage.png'))).toBe(true);
    // Le Zinc retire son accord, au passage même où un texte faux fait refuser chaque page de match à venir.
    const faux = structuredClone(contenu);
    faux.publies = PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc');
    faux.textes.match.titreBars = 'Les bars qui le diffusent !';
    const resultat = await passer(sortie, '2026-10-21T09:00:00Z', { contenu: faux });
    // Brest – Nice ne nomme que des bars encore publiés : sa version précédente reste, avec son image, octet pour octet.
    expect(resultat.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, sa version précédente reste en ligne : \/matchs\/brest-nice-2026-10-23\//));
    expect(octets('matchs/brest-nice-2026-10-23/partage.png').equals(brest.image)).toBe(true);
    expect(etatDe(sortie).pages['/matchs/brest-nice-2026-10-23/partage.png']).toEqual(brest.etat);
    expect(meta(readFileSync(path.join(sortie, 'matchs/brest-nice-2026-10-23/index.html'), 'utf8'), 'og:image')).toEqual([`${ORIGINE}/matchs/brest-nice-2026-10-23/partage.png`]);
    // PSG – OL nommait le Zinc : la page neutre, avec l’image générale du site, sans bloc « Partager » ; son image part.
    const neutre = readFileSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/index.html'), 'utf8');
    expect(neutre).toContain('<h1 class="regarder-titre">Cette page se met à jour</h1>');
    expect(meta(neutre, 'og:image')).toEqual([IMAGE_DU_SITE]);
    expect(meta(neutre, 'twitter:image')).toEqual([IMAGE_DU_SITE]);
    expect(neutre).not.toContain('class="partage"');
    expect(neutre).not.toContain(SCRIPT_DU_PARTAGE);
    expect(resultat.supprimees).toContain('/matchs/psg-ol-2026-10-25/partage.png');
    expect(existsSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/partage.png'))).toBe(false);
    expect(etatDe(sortie).pages['/matchs/psg-ol-2026-10-25/partage.png']).toBeUndefined();
    // Le bar retiré n’a plus d’image nulle part.
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11/partage.png'))).toBe(false);
    for (const image of images(sortie)) expect(existsSync(path.join(sortie, image.replace(/partage\.png$/, 'index.html'))), image).toBe(true);

    // Une version précédente qui annonce son image alors que l’image n’est plus là ne reste pas : la page neutre.
    rmSync(path.join(sortie, 'matchs/brest-nice-2026-10-23/partage.png'));
    const encore = await passer(sortie, '2026-10-21T10:00:00Z', { contenu: faux });
    expect(encore.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, remplacée par une page neutre : \/matchs\/brest-nice-2026-10-23\/ .* sa version précédente ne reste pas : son image de partage n’est plus là$/));
    expect(meta(readFileSync(path.join(sortie, 'matchs/brest-nice-2026-10-23/index.html'), 'utf8'), 'og:image')).toEqual([IMAGE_DU_SITE]);
    expect(etatDe(sortie).pages['/matchs/brest-nice-2026-10-23/partage.png']).toBeUndefined();

    // Le texte réparé : la vraie page revient, avec une image neuve.
    await passer(sortie, '2026-10-21T11:00:00Z', { contenu: { ...contenu, publies: faux.publies } });
    expect(existsSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/partage.png'))).toBe(true);
    expect(meta(readFileSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/index.html'), 'utf8'), 'og:image')).toEqual([`${ORIGINE}/matchs/psg-ol-2026-10-25/partage.png`]);
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
    // Le bloc « Partager » reste : il ne dépend pas de l’image.
    expect(html).toContain('class="partage"');

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

// ---------- Le bloc « Partager », dans le navigateur ----------

test('le contrôle des pages : partage.js, et lui seul, tel quel', async () => {
  const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: Date.parse('2026-10-23T08:00:00Z'), racine, contenu });
  const p = site.pages.find((x) => x.chemin === '/matchs/psg-ol-2026-10-25/');
  expect(p.contenu.split(SCRIPT_DU_PARTAGE)).toHaveLength(2);
  expect(controlerLaPage(p)).toEqual([]);
  for (const autre of ['<script src="/partage.js"></script>', '<script src="/autre.js" defer></script>', '<script src="https://exemple.fr/partage.js" defer></script>', '<script>alert(1)</script>']) {
    expect(controlerLaPage({ ...p, contenu: p.contenu.replace(SCRIPT_DU_PARTAGE, autre) }).join(), autre).toMatch(/un script autre que les données structurées et le partage/);
  }
  // La semaine n’a pas de bloc « Partager », donc pas de script.
  expect(site.pages.find((x) => x.chemin === '/matchs/').contenu).not.toContain('<script src=');
});

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

test.describe('le bloc « Partager »', () => {
  let serveur;
  test.beforeAll(async () => {
    const dossier = dossierVide();
    await construireLeSiteDExemple(dossier);
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(() => serveur?.arreter());

  const MATCH = '/matchs/psg-ol-2026-10-25/';
  const canonique = (chemin) => `${ORIGINE}${chemin}`;
  const ouvrir = async (onglet, chemin = MATCH) => {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    return {
      natif: onglet.locator('.partage__natif'),
      whatsapp: onglet.locator('.partage__whatsapp'),
      copier: onglet.locator('.partage__copier'),
      lien: onglet.locator('.partage__lien'),
      statut: onglet.locator('.partage__statut'),
    };
  };
  // Le bouton du téléphone, simulé : chaque partage est noté ; « refus » le fait échouer avec cette erreur.
  const avecLeBoutonDuTelephone = (onglet, refus = null) => onglet.addInitScript((nom) => {
    window.__partages = [];
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (donnees) => {
        window.__partages.push(donnees);
        if (nom) throw new DOMException('refus', nom);
      },
    });
  }, refus);
  const sansLeBoutonDuTelephone = (onglet, { copieRefusee = false } = {}) => onglet.addInitScript((refusee) => {
    delete Navigator.prototype.share;
    window.__copies = [];
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: async (texte) => { if (refusee) throw new DOMException('refus', 'NotAllowedError'); window.__copies.push(texte); } }),
    });
  }, copieRefusee);

  for (const chemin of [MATCH, '/regarder-le-match/paris/', '/bar/le-zinc-des-amis-paris-11/']) {
    test(`${chemin} : sans JavaScript, WhatsApp (le titre et l’adresse canonique) et l’adresse en lien`, async ({ browser }) => {
      const contexte = await browser.newContext({ javaScriptEnabled: false });
      const onglet = await contexte.newPage();
      const { natif, whatsapp, copier, lien } = await ouvrir(onglet, chemin);
      const titre = (await onglet.title()).replace(/ /g, ' ');
      expect(await onglet.locator('link[rel="canonical"]').getAttribute('href')).toBe(canonique(chemin));
      await expect(whatsapp).toBeVisible();
      await expect(whatsapp).toHaveText('Envoyer sur WhatsApp');
      expect(await whatsapp.getAttribute('href')).toBe(`https://wa.me/?text=${encodeURIComponent(`${titre} ${canonique(chemin)}`)}`);
      await expect(lien).toBeVisible();
      expect(await lien.getAttribute('href')).toBe(canonique(chemin));
      await expect(natif).toBeHidden();
      await expect(copier).toBeHidden();
      // Aucun paramètre de suivi, nulle part dans le bloc.
      const bloc = await onglet.locator('.partage').evaluate((e) => e.outerHTML);
      expect(bloc).not.toMatch(/utm_|[?&](?:ref|source|fbclid|gclid)=|%3F/i);
      await contexte.close();
    });
  }

  test('avec le bouton du téléphone : « Partager » seul, au clavier, avec le titre et l’adresse canonique', async ({ page: onglet }) => {
    await avecLeBoutonDuTelephone(onglet);
    const { natif, whatsapp, copier, lien } = await ouvrir(onglet);
    await expect(natif).toBeVisible();
    await expect(natif).toHaveText('Partager');
    await expect(whatsapp).toBeHidden();
    await expect(copier).toBeHidden();
    await expect(lien).toBeHidden();
    await natif.focus();
    await onglet.keyboard.press('Enter');
    await expect.poll(() => onglet.evaluate(() => window.__partages)).toEqual([{ title: (await onglet.title()), url: canonique(MATCH) }]);
  });

  test('fermé sans partager : rien ne change ; refusé par le navigateur : WhatsApp et « Copier le lien »', async ({ browser }) => {
    for (const [refus, attendu] of [['AbortError', 'natif'], ['NotAllowedError', 'autres']]) {
      const contexte = await browser.newContext();
      const onglet = await contexte.newPage();
      await avecLeBoutonDuTelephone(onglet, refus);
      const { natif, whatsapp, copier } = await ouvrir(onglet);
      await natif.click();
      await expect.poll(() => onglet.evaluate(() => window.__partages.length)).toBe(1);
      if (attendu === 'natif') {
        await expect(natif).toBeVisible();
        await expect(whatsapp).toBeHidden();
      } else {
        await expect(natif).toBeHidden();
        await expect(whatsapp).toBeVisible();
        await expect(copier).toBeVisible();
      }
      await contexte.close();
    }
  });

  test('sans le bouton du téléphone : WhatsApp et « Copier le lien », qui copie l’adresse canonique et le dit', async ({ page: onglet }) => {
    await sansLeBoutonDuTelephone(onglet);
    const { natif, whatsapp, copier, lien, statut } = await ouvrir(onglet);
    await expect(natif).toBeHidden();
    await expect(whatsapp).toBeVisible();
    await expect(copier).toBeVisible();
    await expect(lien).toBeHidden();
    await expect(statut).toHaveAttribute('aria-live', 'polite');
    await expect(statut).toHaveAttribute('role', 'status');
    await copier.focus();
    await onglet.keyboard.press('Enter');
    await expect(statut).toHaveText('Lien copié.');
    expect(await onglet.evaluate(() => window.__copies)).toEqual([canonique(MATCH)]);
  });

  test('la copie refusée : l’adresse revient en lien, et la page dit comment la copier', async ({ page: onglet }) => {
    await sansLeBoutonDuTelephone(onglet, { copieRefusee: true });
    const { copier, lien, statut } = await ouvrir(onglet);
    await copier.click();
    await expect(statut).toHaveText('Copie impossible : appuie longtemps sur le lien pour le copier.'.replace(' :', ' :'));
    await expect(lien).toBeVisible();
  });

  test('des cibles de 44 px, sans animation, à 360 px comme au bureau', async ({ browser }) => {
    for (const largeur of [360, 1280]) {
      const contexte = await browser.newContext({ javaScriptEnabled: false, viewport: { width: largeur, height: 800 }, reducedMotion: 'reduce' });
      const onglet = await contexte.newPage();
      await ouvrir(onglet);
      const tailles = await onglet.locator('.partage a, .partage button').evaluateAll((elements) => elements
        .filter((e) => !e.hidden).map((e) => ({ texte: e.textContent.trim(), hauteur: Math.round(e.getBoundingClientRect().height), largeur: Math.round(e.getBoundingClientRect().width) })));
      expect(tailles.length).toBe(2);
      expect(tailles.filter((t) => t.hauteur < 44 || t.largeur < 44)).toEqual([]);
      const mouvements = await onglet.locator('.partage, .partage *').evaluateAll((elements) => elements
        .map((e) => getComputedStyle(e)).filter((s) => s.transitionDuration !== '0s' || s.animationName !== 'none').length);
      expect(mouvements).toBe(0);
      await contexte.close();
    }
  });
});
