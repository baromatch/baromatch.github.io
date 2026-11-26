// La story de l’affiche de la semaine (generateur/story.mjs) : la même programmation que l’affiche à imprimer
// (/matchs/affiche/), en image verticale de 1080 × 1920 pour Instagram, faite par le même robot, des mêmes données.
// Gratuite pour tout bar, même sans Baromatch. Dessinée en SVG avec la police du site, rendue en PNG par le rendu des
// images de partage (generateur/images), écrite à côté de l’affiche : matchs/affiche/story.png (l’image entière) et
// matchs/affiche/story-apercu.png (270 × 480, celle que montre la page). Les 270 px du haut et les 340 px du bas
// restent vides : Instagram y pose ses boutons.
// Le scénario inventé (tests/donnees/scenario.json), complété de matchs pour remplir la semaine (dont un reporté, un
// annulé et une heure provisoire), lu à l’heure du vendredi 23 octobre 2026, 10 h à Paris.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { MOTS_INTERDITS } from '../generateur/donnees.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { lesPolices, POIDS_MAX } from '../generateur/partage.mjs';
import { chargerLeRendu } from '../generateur/images/rendu.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';
import { CHEMIN_DE_L_APERCU, CHEMIN_DE_LA_STORY, combienTiennent, HAUTEUR_STORY, LARGEUR_STORY, svgDeLaStory, ZONE_LIBRE } from '../generateur/story.mjs';
import { chargerLeVocabulaire, validerLaPage } from '../generateur/validateur.mjs';

const OUVERTE = '/matchs/affiche/';
const { qr } = chargerLeQr();
const contenu = contenuDuScenario();
const sansBarPublie = chargerLeContenu(racine);
const vocabulaire = chargerLeVocabulaire();
const SIGNATURE = 'essai';

const AJOUTS = [
  ['m-ars-che', '2026-10-23T17:00:00Z', 'Premier League', 'Arsenal FC', 'Chelsea FC'],
  ['m-ren-nan', '2026-10-24T13:30:00Z', 'Ligue 1', 'Stade Rennais FC', 'FC Nantes'],
  ['m-str-tou', '2026-10-24T15:00:00Z', 'Ligue 1', 'RC Strasbourg Alsace', 'Toulouse FC'],
  ['m-mon-bre', '2026-10-25T15:00:00Z', 'Ligue 1', 'AS Monaco', 'Stade Brestois 29'],
  ['m-liv-mci', '2026-10-26T20:00:00Z', 'Premier League', 'Liverpool FC', 'Manchester City'],
  ['m-lor-met', '2026-10-27T18:45:00Z', 'Coupe de France', 'FC Lorient', 'FC Metz'],
  ['m-atl-rso', '2026-10-27T20:00:00Z', 'UEFA Europa League', 'Atlético de Madrid', 'Real Sociedad'],
  ['m-pfc-ang', '2026-10-28T17:30:00Z', 'Ligue 1', 'Paris FC', 'Angers SCO', { heureProvisoire: true }],
  ['m-rma-juv', '2026-10-29T20:00:00Z', 'UEFA Champions League', 'Real Madrid', 'Juventus'],
  ['m-nice-lens', '2026-10-27T19:00:00Z', 'Ligue 1', 'OGC Nice', 'RC Lens', { status: 'POSTPONED' }],
  ['m-toulouse-metz', '2026-10-28T19:00:00Z', 'Ligue 1', 'Toulouse FC', 'FC Metz', { status: 'CANCELLED' }],
];
const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'story-'));
  dossiers.push(dossier);
  return dossier;
};
const ecrire = (scenario) => {
  const fichier = path.join(dossierVide(), 'scenario.json');
  writeFileSync(fichier, JSON.stringify(scenario));
  return `scenario:${fichier}`;
};
const scenarioPlein = () => {
  const s = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  for (const [id, startAt, league, homeTeam, awayTeam, plus = {}] of AJOUTS) s.matches.push({ id, startAt, league, homeTeam, awayTeam, ...plus });
  return s;
};
// Trois matchs seulement : tous tiennent sur la story.
const scenarioCourt = () => {
  const s = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  s.matches = AJOUTS.slice(0, 3).map(([id, startAt, league, homeTeam, awayTeam]) => ({ id, startAt, league, homeTeam, awayTeam }));
  return s;
};
// Un seul match, dans trois semaines : l’affiche n’a rien à montrer (la source refuse une liste sans aucun match).
const scenarioVide = () => {
  const s = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  s.matches = [{ id: 'm-loin', startAt: '2026-11-20T19:00:00Z', league: 'Ligue 1', homeTeam: 'Paris FC', awayTeam: 'Angers SCO' }];
  return s;
};
let plein = null;
const sourcePleine = () => {
  if (!plein || !existsSync(plein.slice('scenario:'.length))) plein = ecrire(scenarioPlein());
  return plein;
};

const enMemoire = ({ source = sourcePleine(), avec = contenu, images = { signature: SIGNATURE } } = {}) => construireEnMemoire({
  source, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: avec, qr, images,
});
const pageDe = (site) => {
  const p = site.pages.find((x) => x.chemin === OUVERTE);
  expect(p).toBeTruthy();
  return p;
};
const dessin = async (options) => {
  const site = await enMemoire(options);
  const p = pageDe(site);
  return { site, p, svg: p.story ? svgDeLaStory(p.story, { verre: site.cadre.verre }) : null };
};
// Les textes du dessin, un par balise <text> : sa place, sa taille, sa couleur, sa police, son contenu.
const textesDe = (svg) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
  x: Number(m[1]), y: Number(m[2]), contenu: m[4].replace(/&amp;/g, '&'),
  taille: Number(/font-size="([\d.]+)"/.exec(m[3])[1]), famille: /font-family="([^"]+)"/.exec(m[3])[1],
  couleur: /fill="([^"]+)"/.exec(m[3])[1], espacement: Number(/letter-spacing="(-?[\d.]+)"/.exec(m[3])?.[1] ?? 0),
}));

test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

// Un PNG opaque (les octets de generateur/images/png.mjs) relu : ses dimensions et ses pixels.
const lirePng = (octets) => {
  expect(octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  const largeur = octets.readUInt32BE(16);
  const hauteur = octets.readUInt32BE(20);
  let decalage = 8;
  const idat = [];
  while (decalage < octets.length) {
    const longueur = octets.readUInt32BE(decalage);
    if (octets.toString('latin1', decalage + 4, decalage + 8) === 'IDAT') idat.push(octets.subarray(decalage + 8, decalage + 8 + longueur));
    decalage += 12 + longueur;
  }
  const brut = inflateSync(Buffer.concat(idat));
  const parLigne = largeur * 3;
  const pixels = Buffer.alloc(parLigne * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    expect(brut[y * (parLigne + 1)]).toBe(1);
    for (let x = 0; x < parLigne; x += 1) pixels[y * parLigne + x] = (brut[y * (parLigne + 1) + 1 + x] + (x >= 3 ? pixels[y * parLigne + x - 3] : 0)) & 0xFF;
  }
  return { largeur, hauteur, pixels };
};

// ---------- Ce que la story dit ----------

test('la story montre les prochains matchs de l’affiche, dans l’ordre, sans les reportés ni les annulés, et dit combien d’autres restent', async () => {
  const { p } = await dessin();
  const { story } = p;
  expect(story).toBeTruthy();
  // Les mêmes matchs que l’affiche : ceux de /matchs/, sans le reporté ni l’annulé.
  const dansLAffiche = [...p.contenu.matchAll(/<li class="affiche-ligne">[\s\S]*?<time class="affiche-heure[^"]*" datetime="([^"]+)">/g)].map((m) => m[1]);
  const montres = story.jours.flatMap((j) => j.matchs);
  expect(montres.length).toBeGreaterThanOrEqual(6);
  expect(montres.length).toBeLessThan(dansLAffiche.length);
  expect(story.total).toBe(dansLAffiche.length);
  expect(story.reste).toBe(dansLAffiche.length - montres.length);
  // Les premiers de l’affiche, dans son ordre.
  expect(montres.map((m) => m.debut)).toEqual(montres.map((m) => m.debut).sort());
  expect(montres.map((m) => m.nom)).not.toContain('OGC Nice – RC Lens');
  expect(montres.map((m) => m.nom)).not.toContain('Toulouse FC – FC Metz');
  expect(story.titre).toBe('Les prochains matchs');
  // Ses dates : du premier jour au dernier jour montrés, pas toute la semaine.
  const premier = story.jours[0].jour;
  const dernier = story.jours.at(-1).jour;
  expect(premier).toBe('2026-10-23');
  expect(dernier <= '2026-10-29').toBe(true);
  expect(story.dates).toMatch(/^Du vendredi 23 au \w+ \d+ octobre$/);
});

test('trois matchs : tous tiennent, le titre dit la semaine, ses dates sont celles de l’affiche, et rien ne dit « autres matchs »', async () => {
  const { p, svg } = await dessin({ source: ecrire(scenarioCourt()) });
  expect(p.story.reste).toBe(0);
  expect(p.story.titre).toBe('Les matchs de la semaine');
  expect(p.story.dates).toBe('Du vendredi 23 au jeudi 29 octobre');
  const textes = textesDe(svg).map((t) => t.contenu);
  expect(textes).toContain('Les matchs de la semaine');
  expect(textes.join('\n')).not.toMatch(/autres? match/);
  expect(textes.join('\n')).toContain('Programme préparé sur baromatch.fr, à l’heure de Paris.');
});

test('« Et N autres matchs » avec leur vrai nombre ; un seul de plus : « Et 1 autre match », au singulier', async () => {
  const { p, svg } = await dessin();
  const ligne = textesDe(svg).map((t) => t.contenu).find((t) => t.startsWith('Et '));
  expect(ligne).toBe(`Et ${p.story.reste} autres matchs sur baromatch.fr/matchs`);
  // Deux journées de matchs, chacune de la taille qu’il faut (combienTiennent dit combien tiennent) : un seul match en
  // trop, puis trois.
  const clubs = [['Arsenal FC', 'Chelsea FC'], ['Stade Rennais FC', 'FC Nantes'], ['AS Monaco', 'Stade Brestois 29'], ['Liverpool FC', 'Manchester City'], ['FC Lorient', 'FC Metz'], ['Real Madrid', 'Juventus']];
  const deuxJours = (a, b) => {
    const base = JSON.parse(readFileSync(SCENARIO, 'utf8'));
    base.matches = [...Array.from({ length: a }, (_, i) => [24, i]), ...Array.from({ length: b }, (_, i) => [25, i])].map(([jour, i], n) => ({
      id: `m-jour-${n}`, startAt: `2026-10-${jour}T${String(8 + i).padStart(2, '0')}:00:00Z`, league: 'Ligue 1', homeTeam: clubs[n % 6][0], awayTeam: clubs[n % 6][1],
    }));
    return base;
  };
  const tailles = (reste) => {
    for (let a = 1; a <= 12; a += 1) for (let b = 1; b <= 12; b += 1) if (a + b - combienTiennent([Array(a).fill(0), Array(b).fill(0)]) === reste) return [a, b];
    return null;
  };
  const [a1, b1] = tailles(1);
  const un = await dessin({ source: ecrire(deuxJours(a1, b1)) });
  expect(un.p.story.reste).toBe(1);
  expect(un.p.story.titre).toBe('Les prochains matchs');
  const dits = textesDe(un.svg).map((t) => t.contenu);
  expect(dits).toContain('Et 1 autre match sur baromatch.fr/matchs');
  expect(dits.join('\n')).not.toMatch(/1 autres/);
  const [a3, b3] = tailles(3);
  const trois = await dessin({ source: ecrire(deuxJours(a3, b3)) });
  expect(trois.p.story.reste).toBe(3);
  expect(textesDe(trois.svg).map((t) => t.contenu)).toContain('Et 3 autres matchs sur baromatch.fr/matchs');
  // Tout tient : pas de « Et … », le titre dit la semaine.
  const [a0, b0] = [3, 3];
  const tout = await dessin({ source: ecrire(deuxJours(a0, b0)) });
  expect(tout.p.story.reste).toBe(0);
  expect(tout.p.story.titre).toBe('Les matchs de la semaine');
  // Un jour seul, trop plein : ses dates sont ce jour-là, pas « Du … au … ».
  const seul = await dessin({ source: ecrire(deuxJours(14, 0)) });
  expect(seul.p.story.dates).toBe('Samedi 24 octobre');
  expect(seul.p.story.reste).toBeGreaterThan(0);
});

test('une heure provisoire s’écrit « À confirmer », jamais une heure inventée', async () => {
  // La semaine du scénario : le match provisoire est le 28 octobre ; une semaine courte où il tient.
  const s = scenarioCourt();
  s.matches.push({ id: 'm-pfc-ang', startAt: '2026-10-28T17:30:00Z', league: 'Ligue 1', homeTeam: 'Paris FC', awayTeam: 'Angers SCO', heureProvisoire: true });
  const { svg } = await dessin({ source: ecrire(s) });
  const textes = textesDe(svg).map((t) => t.contenu);
  expect(textes).toContain('À confirmer');
  expect(textes.some((t) => t.startsWith('Paris FC – '))).toBe(true);
  expect(textes).not.toContain('19:30');
});

test('sans match à montrer : aucune story, ni section, ni fichier', async () => {
  const { p, svg } = await dessin({ source: ecrire(scenarioVide()) });
  expect(p.story).toBeFalsy();
  expect(svg).toBeNull();
  expect(p.contenu).not.toContain('id="story"');
});

// ---------- Le dessin ----------

test('1080 × 1920 : la nuit, la police du site seule, des couleurs de la marque, ni image ni lien ; rien dans les 270 px du haut ni les 340 px du bas', async () => {
  const { svg, site } = await dessin();
  expect(LARGEUR_STORY).toBe(1080);
  expect(HAUTEUR_STORY).toBe(1920);
  expect(ZONE_LIBRE).toEqual({ haut: 270, bas: 340 });
  expect(svg).toContain('width="1080" height="1920" viewBox="0 0 1080 1920"');
  expect(svg).toContain('<rect width="1080" height="1920" fill="#0A0B10"/>');
  // Aucune image, aucun lien, aucun style en ligne : un dessin et des mots.
  expect(svg).not.toMatch(/<image\b|href=|<style\b|<script\b|<a\b/);
  // La police : les deux réglages de Bricolage Grotesque du site, et elles seules.
  const polices = new Set(Object.values(lesPolices()).map((f) => f.famille));
  const textes = textesDe(svg);
  expect(textes.length).toBeGreaterThan(10);
  for (const t of textes) expect(polices.has(t.famille), t.famille).toBe(true);
  // Les couleurs : la nuit, le blanc de la marque, l’ambre (pour une seule chose : les dates).
  const couleurs = new Set([...svg.matchAll(/(?:fill|stroke|stop-color)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1].toUpperCase()));
  const permises = new Set(['#0A0B10', '#F7F7F9', '#FFB13D', '#FFFFFF']);
  // Le verre de la marque (cadre.verre) garde les siennes.
  for (const m of site.cadre.verre.matchAll(/(?:fill|stroke|stop-color)="(#[0-9A-Fa-f]{3,8})"/g)) permises.add(m[1].toUpperCase());
  // Les insignes des clubs ont leurs couleurs (leur dessin) ; le reste du dessin n’a que celles de la marque.
  const horsInsignes = svg.slice(0, svg.indexOf('<g class="story-insignes"')) + svg.slice(svg.search(/<svg x="[\d.]+" y="[\d.]+" width="44"/));
  const propres = new Set([...horsInsignes.matchAll(/(?:fill|stroke|stop-color)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1].toUpperCase()));
  for (const c of propres) expect(permises.has(c), c).toBe(true);
  expect(couleurs.has('#FFB13D')).toBe(true);
  expect(textes.filter((t) => t.couleur.toUpperCase() === '#FFB13D').map((t) => t.contenu)).toEqual([expect.stringMatching(/^Du /)]);
  // La zone libre : chaque texte (sa ligne de base, moins ses jambages), chaque insigne.
  const [haut, bas] = [ZONE_LIBRE.haut, HAUTEUR_STORY - ZONE_LIBRE.bas];
  for (const t of textes) {
    expect(t.y - t.taille * 0.75, t.contenu).toBeGreaterThanOrEqual(haut - 1);
    expect(t.y + t.taille * 0.25, t.contenu).toBeLessThanOrEqual(bas + 1);
  }
  for (const m of svg.matchAll(/<g class="story-insignes" transform="translate\(([\d.]+) ([\d.]+)\)">/g)) {
    expect(Number(m[2])).toBeGreaterThanOrEqual(haut);
    expect(Number(m[2]) + 56).toBeLessThanOrEqual(bas);
  }
  // Et dans la largeur : 70 px de chaque côté, aucun texte ne la dépasse.
  const { texte: policeTexte, titre: policeTitre } = lesPolices();
  for (const t of textes) {
    const police = t.famille === policeTitre.famille ? policeTitre : policeTexte;
    expect(t.x, t.contenu).toBeGreaterThanOrEqual(70);
    expect(t.x + police.largeur(t.contenu, t.taille, t.espacement), t.contenu).toBeLessThanOrEqual(1080 - 70 + 1);
  }
});

test('rien que l’affiche n’a le droit de dire : ni « ! », ni mot interdit, ni alcool, ni score, ni « Soir de Match », ni écusson', async () => {
  for (const source of [sourcePleine(), ecrire(scenarioCourt())]) {
    const { svg } = await dessin({ source });
    const dit = textesDe(svg).map((t) => t.contenu).join('\n');
    expect(dit).not.toContain('!');
    expect(dit).not.toMatch(MOTS_INTERDITS);
    expect(dit).not.toMatch(/alcool|bière|pinte|verre offert|happy|tournée|partenaire|soir de match/i);
    // Aucun score : pas de « 2-1 », pas de « 3 : 0 ».
    expect(dit).not.toMatch(/\b\d\s*[-–:]\s*\d\b/);
    expect(svg).not.toMatch(/<image\b/);
  }
});

test('les insignes sont ceux de Baromatch, un par club, jamais deux fois le même identifiant', async () => {
  const { svg } = await dessin();
  const insignes = [...svg.matchAll(/<g class="story-insignes"/g)];
  const { p } = await dessin();
  const montres = p.story.jours.flatMap((j) => j.matchs).length;
  expect(insignes).toHaveLength(montres);
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

test('le même passage, deux fois : le même dessin, octet pour octet', async () => {
  const a = await dessin();
  const b = await dessin();
  expect(a.svg).toBe(b.svg);
});

// ---------- Le fichier ----------

test('construire écrit story.png (1080 × 1920) et story-apercu.png (270 × 480), opaques, légers, dans la liste blanche, hors du plan et de l’index', async () => {
  expect(estPermis(CHEMIN_DE_LA_STORY.slice(1))).toBe(true);
  expect(estPermis(CHEMIN_DE_L_APERCU.slice(1))).toBe(true);
  expect(estPermis('bar/x/story.png')).toBe(false);
  expect(estPermis('matchs/affiche/autre.png')).toBe(false);
  const sortie = await dossierDExemple();
  const resultat = await construire({ source: sourcePleine(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, accepterLesSuppressions: true });
  expect(resultat.ecrits).toContain(CHEMIN_DE_LA_STORY);
  expect(resultat.ecrits).toContain(CHEMIN_DE_L_APERCU);
  const entiere = readFileSync(path.join(sortie, 'matchs', 'affiche', 'story.png'));
  const apercu = readFileSync(path.join(sortie, 'matchs', 'affiche', 'story-apercu.png'));
  const g = lirePng(entiere);
  expect([g.largeur, g.hauteur]).toEqual([1080, 1920]);
  const a = lirePng(apercu);
  expect([a.largeur, a.hauteur]).toEqual([270, 480]);
  // Léger : celle qu’on télécharge pèse moins de 400 Ko, celle que la page montre moins de 60 Ko.
  expect(entiere.length).toBeLessThan(400 * 1024);
  expect(apercu.length).toBeLessThan(60 * 1024);
  expect(POIDS_MAX).toBeGreaterThan(0);
  // L’état la connaît, hors index et hors plan du site.
  expect(resultat.etat.pages[CHEMIN_DE_LA_STORY]).toMatchObject({ type: 'story', cle: 'affiche', indexable: false });
  expect(resultat.etat.pages[CHEMIN_DE_L_APERCU]).toMatchObject({ type: 'story', cle: 'affiche-apercu', indexable: false });
  expect(resultat.plan).not.toContain('story');
  expect(resultat.changees.join('\n')).not.toContain('story');
  // Les pixels : rien de clair dans les 270 px du haut ni les 340 px du bas (là, Instagram pose ses boutons) ; du texte
  // clair au milieu.
  const clair = (y) => { for (let x = 0; x < g.largeur; x += 1) { const i = (y * g.largeur + x) * 3; if (Math.max(g.pixels[i], g.pixels[i + 1], g.pixels[i + 2]) > 140) return true; } return false; };
  const lignesClaires = Array.from({ length: g.hauteur }, (_, y) => clair(y));
  expect(lignesClaires.slice(0, 270).some(Boolean)).toBe(false);
  expect(lignesClaires.slice(g.hauteur - 340).some(Boolean)).toBe(false);
  expect(lignesClaires.slice(270, g.hauteur - 340).filter(Boolean).length).toBeGreaterThan(400);
});

test('refaite à l’identique : le même PNG, octet pour octet, et un second passage ne réécrit rien', async () => {
  const sortie = await dossierDExemple();
  const options = { source: sourcePleine(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, accepterLesSuppressions: true };
  await construire(options);
  const avant = readFileSync(path.join(sortie, 'matchs', 'affiche', 'story.png'));
  const second = await construire(options);
  expect(second.ecrits).not.toContain(CHEMIN_DE_LA_STORY);
  expect(second.ecrits).not.toContain(CHEMIN_DE_L_APERCU);
  expect(readFileSync(path.join(sortie, 'matchs', 'affiche', 'story.png')).equals(avant)).toBe(true);
  // Rendue deux fois à part par deux rendus : les mêmes octets.
  const { rendu: un } = await chargerLeRendu({ polices: Object.values(lesPolices()) });
  const { rendu: deux } = await chargerLeRendu({ polices: Object.values(lesPolices()) });
  const { svg } = await dessin({ images: { signature: un.signature } });
  expect(un.rendre(svg).equals(deux.rendre(svg))).toBe(true);
});

test('quand la semaine se vide, la story s’efface avec sa section ; sans le rendu des images, ni story ni section', async () => {
  const sortie = await dossierDExemple();
  await construire({ source: sourcePleine(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, accepterLesSuppressions: true });
  expect(existsSync(path.join(sortie, 'matchs', 'affiche', 'story.png'))).toBe(true);
  const vide = await construire({ source: ecrire(scenarioVide()), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, accepterLesSuppressions: true });
  expect(vide.supprimees).toEqual(expect.arrayContaining([CHEMIN_DE_LA_STORY, CHEMIN_DE_L_APERCU]));
  expect(existsSync(path.join(sortie, 'matchs', 'affiche', 'story.png'))).toBe(false);
  expect(existsSync(path.join(sortie, 'matchs', 'affiche', 'story-apercu.png'))).toBe(false);
  // Sans le rendu : l’affiche s’écrit, sans story.
  const sans = await dossierDExemple();
  const r = await construire({ source: sourcePleine(), sortie: sans, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, rendu: null, accepterLesSuppressions: true });
  expect(r.ecrits).not.toContain(CHEMIN_DE_LA_STORY);
  expect(existsSync(path.join(sans, 'matchs', 'affiche', 'story.png'))).toBe(false);
  expect(readFileSync(path.join(sans, 'matchs', 'affiche', 'index.html'), 'utf8')).not.toContain('id="story"');
});

// ---------- La page ----------

test('la page de l’affiche montre la story : son aperçu à ses dimensions, son lien de téléchargement, ses mots ; contrôlée, valide, sans script de plus', async () => {
  const { p, site } = await dessin();
  expect(site.refusees.map((r) => r.chemin)).not.toContain(OUVERTE);
  expect(controlerLaPage(p)).toEqual([]);
  expect(validerLaPage(vocabulaire, p.contenu)).toEqual([]);
  const section = /<section class="regarder-section affiche-story" aria-labelledby="titre-story" id="story">[\s\S]*?<\/section>/.exec(p.contenu)?.[0];
  expect(section).toBeTruthy();
  expect(section).toContain('<h2 id="titre-story">Pour ta story Instagram</h2>');
  expect(section).toMatch(/<img class="affiche-story__image" src="\/matchs\/affiche\/story-apercu\.png\?v=[\w-]{10}" width="270" height="480" loading="lazy" decoding="async" alt="[^"]+">/);
  expect(section).toMatch(/<a class="affiche-story__telecharger" href="\/matchs\/affiche\/story\.png\?v=[\w-]{10}" download="baromatch-affiche-de-la-semaine-story\.png">Télécharger l’image/);
  expect(section).toContain('même sans Baromatch');
  // L’image ne dit pas ce qu’un bar diffuse : la note le dit.
  expect(section).toContain('pas seulement ceux que tu diffuses');
  const texte = texteVisible(section);
  expect(texte).not.toMatch(MOTS_INTERDITS);
  expect(texte).not.toMatch(/alcool|bière|pinte|verre offert|happy|partenaire|!/i);
  // Seulement les scripts de l’affiche d’avant : aucun de plus.
  expect([...p.contenu.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]).filter((s) => !s.includes('mesure.js'))).toEqual([' type="application/ld+json"']);
  // La version dans l’adresse change avec le dessin : une autre semaine, une autre adresse.
  const autre = await dessin({ source: ecrire(scenarioCourt()) });
  const version = (html) => /story\.png\?v=([\w-]{10})/.exec(html)[1];
  expect(version(autre.p.contenu)).not.toBe(version(p.contenu));
  expect(version((await dessin()).p.contenu)).toBe(version(p.contenu));
});

test('sans le rendu des images (images false) : la page de l’affiche n’a ni story ni image', async () => {
  const { p } = await dessin({ images: false });
  expect(p.story ?? null).toBeNull();
  expect(p.contenu).not.toContain('id="story"');
  expect(p.contenu.split('<main')[1]).not.toMatch(/<img\b/);
});

test('la page des bars mène à la story, une fois, vers l’ancre de la page de l’affiche, dans « Pour démarrer » ; la page reste sous ses 73 000 octets', () => {
  const html = readFileSync(path.join(racine, 'pour-les-bars.html'), 'utf8');
  const phrase = '<p class="chapo marche__story">Pour ton Instagram, sans attendre\u00A0: <a href="/matchs/affiche/#story">la story des matchs de la semaine</a>, à télécharger. Elle est gratuite, même sans Baromatch.</p>'.replace('\u00A0', '&nbsp;');
  expect(html).toContain(phrase);
  expect(html.split('href="/matchs/affiche/#story"')).toHaveLength(2);
  // Dans « Pour démarrer », après son résumé, avant les questions ; et l’affiche à imprimer garde son seul lien d’avant le formulaire.
  expect(html.indexOf('class="chapo marche__resume"')).toBeLessThan(html.indexOf(phrase));
  expect(html.indexOf(phrase)).toBeLessThan(html.indexOf('aria-labelledby="titre-questions"'));
  expect(html.slice(0, html.indexOf('id="proposer"')).split('href="/matchs/affiche/"')).toHaveLength(2);
  expect(Buffer.byteLength(html)).toBeLessThan(73_000);
  // L’adresse de la page des bars ne bouge pas : son canonique est toujours le sien.
  expect(html).toContain('<link rel="canonical" href="https://baromatch.fr/pour-les-bars.html">');
});

// ---------- Dans le navigateur ----------

const dossierDExemple = async () => {
  const dossier = dossierVide();
  await construireLeSiteDExemple(dossier);
  return dossier;
};
const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});
let serveur;
test.describe('dans le navigateur', () => {
  test.beforeAll(async () => {
    const dossier = await dossierDExemple();
    await construire({ source: sourcePleine(), sortie: dossier, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, qr, accepterLesSuppressions: true });
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(async () => { await serveur?.arreter(); });

  test('à 390 px, texte à 100 et 200 % : l’aperçu et le lien tiennent dans la page, 44 px de haut, l’image se charge, ses octets sont ceux du PNG', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const demandes = [];
    page.on('request', (r) => demandes.push(r.url()));
    for (const echelle of [1, 2]) {
      await page.goto(`${serveur.adresse}/matchs/affiche/`);
      await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, echelle * 100);
      const section = page.locator('#story');
      await section.scrollIntoViewIfNeeded();
      await expect(section.locator('h2')).toHaveText('Pour ta story Instagram');
      const image = section.locator('img');
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((i) => i.complete && i.naturalWidth)).toBe(270);
      expect(await image.evaluate((i) => i.naturalHeight)).toBe(480);
      const lien = section.getByRole('link', { name: /Télécharger l’image/ });
      const boite = await lien.boundingBox();
      expect(boite.height).toBeGreaterThanOrEqual(44);
      // Rien ne déborde de la page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const dehors = await section.locator('*').evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length);
      expect(dehors).toBe(0);
    }
    // Le lien de téléchargement donne le PNG entier.
    const reponse = await page.request.get(`${serveur.adresse}${await page.locator('#story a[download]').getAttribute('href')}`);
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toBe('image/png');
    const g = lirePng(await reponse.body());
    expect([g.largeur, g.hauteur]).toEqual([1080, 1920]);
    expect(demandes.every((u) => u.startsWith(serveur.adresse))).toBe(true);
  });

  test('à l’impression, la story n’est pas sur la feuille ; à l’écran, elle vient après l’affiche et avant « Avant d’afficher »', async ({ page }) => {
    await page.goto(`${serveur.adresse}/matchs/affiche/`);
    const ordre = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id || s.getAttribute('aria-labelledby')));
    expect(ordre.indexOf('titre-story') === -1 ? ordre.indexOf('story') : ordre.indexOf('titre-story')).toBe(ordre.indexOf('titre-apres') - 1);
    expect(ordre.indexOf('titre-feuille')).toBeLessThan(ordre.indexOf('titre-apres'));
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#story')).toBeHidden();
  });

  test('sans animation et à mouvement réduit : la section ne bouge pas, elle est entière', async ({ browser }) => {
    const contexte = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    await page.goto(`${serveur.adresse}/matchs/affiche/`);
    const animations = await page.locator('#story').evaluate((s) => [s, ...s.querySelectorAll('*')].flatMap((el) => el.getAnimations()).length);
    expect(animations).toBe(0);
    await contexte.close();
  });
});
