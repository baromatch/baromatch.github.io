// Les insignes des clubs : chaque club est dessiné exactement comme dans l’appli Baromatch, avec son générateur, copié
// dans generateur/insignes/ par generateur/outils/insignes/exporter.mjs, et posé dans les pages par
// generateur/insigne.mjs. Ce qu’on vérifie : que la copie dessine comme l’appli (des dessins de son paquet compilé,
// tests/donnees/insignes/references.json) ; que les pages posent ces dessins comme l’appli les pose (la
// paire de sa liste « Les matchs », l’insigne seul, le drapeau d’une sélection, l’insigne neutre d’un club inconnu) ;
// et qu’il ne reste nulle part un ancien disque, ni un écusson.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { blocDeLaSemaine, REPERES } from '../generateur/accueil.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { clubDe, indexerLesClubs } from '../generateur/donnees.mjs';
import { ecartsDeLaTable } from '../generateur/outils/insignes/exporter.mjs';
import { bandesDe, identifiantsUniques, insigne, paireDInsignes, TAILLES } from '../generateur/insigne.mjs';
import { svgDeLaCarte } from '../generateur/partage.mjs';
import * as badge from '../generateur/insignes/badge.mjs';
import * as specs from '../generateur/insignes/specs.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';

const DONNEES = path.join(racine, 'tests', 'donnees', 'insignes');
const lire = (fichier) => JSON.parse(readFileSync(path.join(DONNEES, fichier), 'utf8'));
const REFERENCES = lire('references.json');
// La semaine des planches : de vrais noms de clubs, des matchs inventés ; elle s’ouvre le jeudi 29 octobre 2026.
const SEMAINE = path.join(DONNEES, 'semaine-planche.json');
const JEUDI = Date.parse('2026-10-29T09:00:00Z');

// Un insigne de l’appli sans sa racine : ce que sa paire met dans chacun de ses deux groupes.
const sansRacine = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const ouverture = (classe, largeur, hauteur, boite) => `<svg class="${classe}" width="${largeur}" height="${hauteur}" viewBox="${boite}" aria-hidden="true" focusable="false">`;
const COPIE = path.join(racine, 'generateur', 'insignes');
// Les modules de la copie que les tests lisent : le dessin d’un insigne et la table des clubs.
const insignes = { ...badge, ...specs };
const PROVENANCE = JSON.parse(readFileSync(path.join(COPIE, 'provenance.json'), 'utf8'));

test.describe('la copie du générateur de l’appli', () => {
  test('elle dessine comme le paquet compilé de l’appli, et personne ne l’a retouchée depuis l’exportation', () => {
    const { _lisezMoi, ...references } = REFERENCES;
    expect(Object.keys(references)).toHaveLength(19);
    for (const [cle, svg] of Object.entries(references)) {
      const [, quoi, taille, fond] = /^(.+)@(\d+)\/(night|light)$/.exec(cle);
      const fiche = quoi.startsWith('neutre:') ? insignes.fallbackBadgeSpec(quoi.slice('neutre:'.length)) : insignes.badgeSpecFor(quoi);
      const idPrefix = `ib-f-${fiche.slug}-${insignes.badgeTier(Number(taille))}-s${fond[0]}0`.replace(/[^a-zA-Z0-9_-]/g, '');
      expect(insignes.badgeSvg(fiche, { size: Number(taille), variant: 'standard', surface: fond, season: '26/27', stamps: 0, idPrefix }), cle).toBe(svg);
    }
    // Chaque fichier de la copie, tel que l’exportation l’a écrit (son empreinte dans provenance.json), et rien d’autre.
    const fichiers = readdirSync(COPIE).filter((f) => f !== 'provenance.json').sort();
    expect(fichiers).toEqual(Object.keys(PROVENANCE.fichiers));
    for (const fichier of fichiers) {
      expect(createHash('sha256').update(readFileSync(path.join(COPIE, fichier))).digest('hex'), fichier).toBe(PROVENANCE.fichiers[fichier]);
    }
    // La version de l’appli d’où vient la copie : un numéro de version.
    expect(PROVENANCE.versionDeLAppli).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('aucun commentaire copié : seulement l’en-tête de l’exportation ; les contours des lettres, sous la licence de leur police', () => {
    // La ligne de copyright de la police, mot pour mot, telle que fonts/LICENSE-OFL.txt l’écrit.
    const licence = readFileSync(path.join(racine, 'fonts', 'LICENSE-OFL.txt'), 'utf8');
    const copyright = licence.split('\n')[0];
    expect(copyright).toBe('Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)');
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
    const ENTETES = {
      // Une partie de Bricolage Grotesque, changée de format : elle reste sous sa licence, la SIL OFL 1.1.
      'glyphs.generated.mjs': `/* Contours des lettres de Bricolage Grotesque, ${copyright}, sous licence SIL OFL 1.1 (texte : fonts/LICENSE-OFL.txt). Copie produite par generateur/outils/insignes/exporter.mjs : ne pas modifier à la main. */\n`,
      autres: '/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */\n',
    };
    const modules = readdirSync(COPIE).filter((f) => f.endsWith('.mjs'));
    expect(modules).toContain('glyphs.generated.mjs');
    for (const fichier of modules) {
      const texte = readFileSync(path.join(COPIE, fichier), 'utf8');
      const entete = ENTETES[fichier] ?? ENTETES.autres;
      expect(texte.startsWith(entete), fichier).toBe(true);
      // Ni « // » en début de ligne, ni « /* » après l’en-tête (le code copié n’a ni l’un ni l’autre ailleurs).
      expect(texte.slice(entete.length), fichier).not.toMatch(/^\s*\/\/|\/\*/m);
    }
    expect(readFileSync(path.join(COPIE, 'glyphs.generated.mjs'), 'utf8')).not.toContain('©');
  });

  test('un seul renommage, une règle générale écrite dans la provenance : aucun nom en capitales n’y finit par « _FROM »', () => {
    expect(PROVENANCE.renommage).toBe('Dans la copie, un nom écrit en capitales qui finit par « _FROM » finit par « _AT » ; rien d’autre n’est renommé.');
    for (const fichier of readdirSync(COPIE).filter((f) => f.endsWith('.mjs'))) {
      expect(readFileSync(path.join(COPIE, fichier), 'utf8'), fichier).not.toMatch(/\b[A-Z][A-Z0-9_]*_FROM\b/);
    }
  });

  test('les drapeaux : pour chaque pays, seulement le sens des bandes et leurs couleurs, ni tracé, ni image', () => {
    const drapeaux = JSON.parse(readFileSync(path.join(COPIE, 'drapeaux.json'), 'utf8'));
    expect(Object.keys(drapeaux).length).toBeGreaterThan(50);
    for (const [code, entree] of Object.entries(drapeaux)) {
      expect(code).toMatch(/^[a-z]{2}(?:-[a-z]{3})?$/);
      expect(Object.keys(entree), code).toEqual(['direction', 'bands']);
      expect(['vertical', 'horizontal'], code).toContain(entree.direction);
      expect(entree.bands.length, code).toBeGreaterThanOrEqual(2);
      expect(entree.bands.length, code).toBeLessThanOrEqual(4);
      for (const bande of entree.bands) expect(bande, code).toMatch(/^#[0-9A-F]{6}$/);
    }
    // Leur provenance : la version de l’appli, et l’empreinte de la table d’où elles viennent.
    expect(PROVENANCE.empreinteDesDrapeaux).toMatch(/^[0-9a-f]{64}$/);
  });

  // Les champs de la table, à chaque niveau, avec leur sorte : exactement ceux que lisent les modules copiés (badge.mjs,
  // patterns.mjs, type.mjs). De la géographie, seulement les coordonnées du stade (écrites sur le bord) ; ni le nom du
  // club, ni sa ville, ni son maillot extérieur. « kern.# » : le crénage, lettre par lettre.
  const CHAMPS_D_UNE_FICHE = {
    slug: 'string', code: 'string', pattern: 'string', 'colours.primary': 'string', 'colours.secondary': 'string', 'colours.tertiary': 'string',
    founded: 'number', 'geography.lat': 'number', 'geography.lon': 'number', density: 'string', 'kern.#': 'number', 'nudge.x': 'number', 'nudge.y': 'number',
    band: 'string', split: 'boolean', letters: 'string', yearOnFace: 'boolean',
  };
  const CHAMPS_DE_L_INSIGNE_NEUTRE = { slug: 'string', code: 'string', 'colours.primary': 'string', 'colours.secondary': 'string', pattern: 'string', neutral: 'boolean' };
  // Chaque valeur au bout d’un chemin (« geography.lat »), avec sa sorte ; un tableau se lit comme un objet (« x.0 »).
  const feuilles = (valeur, ou = '') => (valeur !== null && typeof valeur === 'object'
    ? Object.keys(valeur).flatMap((cle) => feuilles(valeur[cle], ou ? `${ou}.${cle}` : cle))
    : [[ou, typeof valeur]]);

  test('la table des clubs ne garde que les champs que le dessin lit, à chaque niveau, et aucun autre', () => {
    const texte = readFileSync(path.join(COPIE, 'specs.mjs'), 'utf8');
    expect(texte).not.toMatch(/https?:/);
    expect(texte).not.toMatch(/\b(?:name|city|away|feature|angle|place|reason|season|source)\s*:/);
    expect(insignes.CLUB_BADGE_SLUGS.length).toBeGreaterThan(50);
    for (const slug of insignes.CLUB_BADGE_SLUGS) {
      const fiche = insignes.badgeSpecFor(slug);
      for (const [chemin, sorte] of feuilles(fiche)) expect(CHAMPS_D_UNE_FICHE[chemin.replace(/^kern\.\d+$/, 'kern.#')], `${slug} : ${chemin}`).toBe(sorte);
      for (const champ of ['slug', 'code', 'pattern', 'colours']) expect(fiche[champ], `${slug} : ${champ}`).toBeTruthy();
    }
    for (const [chemin, sorte] of feuilles(insignes.NEUTRAL_BADGE)) expect(CHAMPS_DE_L_INSIGNE_NEUTRE[chemin], `l’insigne neutre : ${chemin}`).toBe(sorte);
  });

  test('une copie dont la table aurait un autre champ, à n’importe quel niveau, ou une autre sorte, est refusée par l’exportation', async () => {
    // La copie telle qu’elle est : rien à refuser.
    expect(ecartsDeLaTable(insignes)).toEqual([]);
    // Des copies modifiées, dans un dossier temporaire : une note glissée dans un champ imbriqué, ou une chaîne là où un
    // nombre est attendu.
    const MODIFICATIONS = [
      ['geography.note', "geography: { lat: 45.478, lon: 9.124 }", "geography: { lat: 45.478, lon: 9.124, note: 'à relire' }"],
      ['colours.note', "colours: { primary: '#FB090B', secondary: '#111111' }", "colours: { primary: '#FB090B', secondary: '#111111', note: 'à relire' }"],
      ['kern.note', "geography: { lat: 45.478, lon: 9.124 }", "geography: { lat: 45.478, lon: 9.124 }, kern: { 0: 1, note: 'à relire' }"],
      ['kern.0', "geography: { lat: 45.478, lon: 9.124 }", "geography: { lat: 45.478, lon: 9.124 }, kern: { 0: 'à relire' }"],
      ['nudge.note', "geography: { lat: 45.478, lon: 9.124 }", "geography: { lat: 45.478, lon: 9.124 }, nudge: { x: 1, note: 'à relire' }"],
      ['founded', 'founded: 1899', "founded: '1899'"],
      ['geography.lat', 'lat: 45.478', "lat: '45.478'"],
      ['name', "{ slug: 'ac-milan',", "{ slug: 'ac-milan', name: 'AC Milan',"],
      ['away', "geography: { lat: 45.478, lon: 9.124 }", "geography: { lat: 45.478, lon: 9.124 }, away: { pattern: 'solid' }"],
    ];
    const dossier = mkdtempSync(path.join(tmpdir(), 'insignes-copie-'));
    try {
      for (const fichier of readdirSync(COPIE)) copyFileSync(path.join(COPIE, fichier), path.join(dossier, fichier));
      const table = readFileSync(path.join(COPIE, 'specs.mjs'), 'utf8');
      const essayer = async (nom, texte) => {
        writeFileSync(path.join(dossier, `specs-${nom}.mjs`), texte);
        return ecartsDeLaTable(await import(pathToFileURL(path.join(dossier, `specs-${nom}.mjs`)).href));
      };
      for (const [champ, avant, apres] of MODIFICATIONS) {
        expect(table.split(avant).length, champ).toBeGreaterThan(1);
        expect(await essayer(champ.replace('.', '-'), table.replace(avant, apres)), champ).toEqual([`ac-milan.${champ}`]);
      }
      // L’insigne neutre, de même.
      expect(await essayer('neutre', table.replace('neutral: true }', "neutral: true, note: 'à relire' }"))).toEqual(['NEUTRAL_BADGE.note']);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

test.describe('l’accueil', () => {
  test('la carte Le Havre – PSG porte exactement la paire de l’appli à 30 px, sur le fond clair des cartes', async () => {
    const site = await construireEnMemoire({ source: `scenario:${SEMAINE}`, maintenant: JEUDI, racine });
    const bloc = blocDeLaSemaine({ donnees: site.donnees, textes: site.contenu.textes, maintenant: JEUDI });
    const carte = bloc.split('<li class="carte-match').find((c) => c.includes('href="/matchs/le-havre-psg-2026-10-30/"'));
    expect(carte).toBeDefined();
    const clubs = carte.split('<a class="carte-match__clubs"')[1].split('</a>')[0];
    const dessin = clubs.slice(clubs.indexOf('<svg'), clubs.lastIndexOf('</svg>') + '</svg>'.length);
    // La paire de l’appli : un seul dessin de 2 × 30 + 4 px, Le Havre puis le PSG, le second décalé de 200 unités et de
    // l’écart (4 px, ramenés à l’échelle du dessin).
    expect(dessin).toBe('<svg class="insignes" width="64" height="30" viewBox="0 0 426.6666666666667 200" aria-hidden="true" focusable="false">'
      + `<g>${sansRacine(REFERENCES['le-havre-ac@30/light'])}</g>`
      + `<g transform="translate(226.66666666666666 0)">${sansRacine(REFERENCES['paris-saint-germain@30/light'])}</g></svg>`);
    // Puis les deux noms, écrits.
    expect(clubs.slice(clubs.lastIndexOf('</svg>'))).toContain('<span class="carte-match__club">Le Havre</span>');
    expect(clubs.slice(clubs.lastIndexOf('</svg>'))).toContain('<span class="carte-match__club">PSG</span>');
  });
});

test.describe('les insignes, posés comme l’appli les pose', () => {
  test('un insigne seul : le dessin de l’appli à sa taille, dans un carré de 200 unités, décoratif', () => {
    for (const [slug, fond] of [['paris-saint-germain', 'night'], ['rc-lens', 'night'], ['paris-saint-germain', 'light']]) {
      expect(insigne({ slug, nom: 'peu importe' }, { taille: TAILLES.entete, fond, maintenant: JEUDI }))
        .toBe(`${ouverture('insigne', 58, 58, '0 0 200 200')}${sansRacine(REFERENCES[`${slug}@58/${fond}`])}</svg>`);
    }
    // À 160 px, la saison de l’instant du passage s’écrit sur le bord (« 26/27 » de juillet 2026 à juin 2027).
    expect(insigne({ slug: 'paris-saint-germain' }, { taille: TAILLES.partage, fond: 'night', maintenant: JEUDI }))
      .toBe(`${ouverture('insigne', 160, 160, '0 0 200 200')}${sansRacine(REFERENCES['paris-saint-germain@160/night'])}</svg>`);
  });

  test('un club que l’appli ne connaît pas : son insigne neutre, le carton d’encre et les trois premières lettres de son nom', () => {
    const pafos = { slug: 'pafos-fc', nom: 'Pafos FC' };
    expect(insignes.badgeSpecFor(pafos.slug)).toBeUndefined();
    expect(insigne(pafos, { taille: 30, fond: 'light', maintenant: JEUDI })).toBe(`${ouverture('insigne', 30, 30, '0 0 200 200')}${sansRacine(REFERENCES['neutre:Pafos FC@30/light'])}</svg>`);
    expect(insignes.fallbackBadgeSpec(pafos.nom).code).toBe('PAF');
    // Aucune couleur devinée : le carton d’encre, quel que soit le club.
    expect(insigne(pafos, { taille: 30, fond: 'night', maintenant: JEUDI })).toContain('fill="#1B1D27"');
  });

  test('une sélection garde son drapeau : des bandes égales dans un disque, l’anneau blanc à 18 %, aucune lettre ; à côté d’un club, deux dessins à 4 px', () => {
    expect(bandesDe('nt-fr')).toEqual({ direction: 'vertical', bands: ['#0055A4', '#FFFFFF', '#EF4135'] });
    expect(bandesDe('nt-zz')).toBeUndefined();
    expect(bandesDe('paris-saint-germain')).toBeUndefined();
    const france = `${ouverture('insigne', 30, 30, '0 0 30 30')}`
      + '<defs><clipPath id="drapeau-fr-30"><circle cx="15" cy="15" r="15"/></clipPath></defs><g clip-path="url(#drapeau-fr-30)">'
      + '<rect x="0" y="0" width="10.5" height="30" fill="#0055A4"/><rect x="10" y="0" width="10.5" height="30" fill="#FFFFFF"/><rect x="20" y="0" width="10" height="30" fill="#EF4135"/>'
      + '</g><circle cx="15" cy="15" r="14.5" stroke="rgba(255,255,255,0.18)" stroke-width="1" fill="none"/></svg>';
    expect(insigne({ slug: 'nt-fr', nom: 'France' }, { taille: 30, fond: 'night', maintenant: JEUDI })).toBe(france);
    // Sur un fond clair (que l’appli ne connaît pas pour un drapeau), l’anneau est le filet d’encre des insignes clairs :
    // la bande blanche ne se perd pas dans le papier.
    expect(insigne({ slug: 'nt-fr', nom: 'France' }, { taille: 30, fond: 'light', maintenant: JEUDI })).toBe(france.replace('rgba(255,255,255,0.18)', 'rgba(20,21,31,0.6)'));
    // Une sélection que la table ne connaît pas : l’insigne neutre de son nom, comme dans l’appli.
    expect(insigne({ slug: 'nt-zz', nom: 'Zedland' }, { taille: 30, fond: 'light', maintenant: JEUDI })).toContain('fill="#1B1D27"');
    const paire = paireDInsignes({ slug: 'nt-fr', nom: 'France' }, { slug: 'paris-saint-germain', nom: 'PSG' }, { fond: 'light', maintenant: JEUDI });
    expect(paire).toMatch(/^<span class="insignes insignes--drapeau" aria-hidden="true"><svg class="insigne" width="30" height="30" viewBox="0 0 30 30"[^>]*>.*<\/svg><svg class="insigne" width="30" height="30" viewBox="0 0 200 200"[^>]*>.*<\/svg><\/span>$/);
    expect(paire).toContain(sansRacine(REFERENCES['paris-saint-germain@30/light']));
  });

  test('sur une page, un identifiant ne sert qu’une fois : le même insigne dessiné deux fois prend « -2 », avec ses renvois', () => {
    const lens = insigne({ slug: 'rc-lens' }, { taille: 58, fond: 'night', maintenant: JEUDI });
    const nice = insigne({ slug: 'ogc-nice' }, { taille: 30, fond: 'night', maintenant: JEUDI });
    const page = identifiantsUniques(`<p>Avant</p>${lens}<p id="ib-garde">Entre</p>${nice}${lens}${nice}${lens}`);
    const [premier, deuxieme, troisieme] = page.match(/<svg class="insigne"[\s\S]*?<\/svg>/g).filter((d) => d.includes('rc-lens'));
    expect(premier).toBe(lens);
    const fois = (dessin, n) => dessin.replace(/ id="([^"]+)"/g, ` id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
    expect(deuxieme).toBe(fois(lens, 2));
    expect(deuxieme).toContain('id="ib-f-rc-lens-large-sn0-field-2"');
    expect(troisieme).toBe(fois(lens, 3));
    const ids = [...page.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
    expect(ids.length).toBeGreaterThan(6);
    expect(new Set(ids).size).toBe(ids.length);
    // Chaque renvoi vise un identifiant de la page ; rien hors des dessins ne change.
    for (const [, cible] of page.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(cible);
    expect(page.startsWith('<p>Avant</p>')).toBe(true);
    expect(page).toContain('<p id="ib-garde">Entre</p>');
  });

  test('chaque club que le site connaît, et chaque club des matchs enregistrés, a son insigne dans l’appli', () => {
    const contenu = chargerLeContenu(racine);
    const index = indexerLesClubs(contenu.clubs);
    // clubs.json : le premier nom de chaque club est celui de son insigne (insigne.mjs le prend).
    const sansFiche = Object.entries(contenu.clubs).filter(([cle]) => !cle.startsWith('_'))
      .filter(([, club]) => !insignes.badgeSpecFor(club.slugs[0]) && !bandesDe(club.slugs[0])).map(([cle]) => cle);
    expect(sansFiche).toEqual([]);
    // Les matchs enregistrés (tests/donnees/capture) : aucun insigne neutre ; un club ajouté à l’appli plus tard, mais pas
    // encore à sa table, en aurait un, et ce test le dirait.
    const matchs = JSON.parse(readFileSync(path.join(racine, 'tests', 'donnees', 'capture', 'matches.json'), 'utf8'));
    const neutres = matchs.flatMap((m) => [clubDe(index, m.homeClub, m.homeTeam), clubDe(index, m.awayClub, m.awayTeam)])
      .filter((club) => !insignes.badgeSpecFor(club.slug) && !bandesDe(club.slug)).map((club) => club.nom);
    expect([...new Set(neutres)]).toEqual([]);
  });
});

test.describe('les pages générées : les insignes là où l’appli les montre', () => {
  // La semaine des planches, construite en mémoire : ses pages (matchs, clubs, compétitions, villes, « Ce soir », la
  // semaine, l’agenda, les pages en anglais).
  let site;
  test.beforeAll(async () => {
    site = await construireEnMemoire({ source: `scenario:${SEMAINE}`, maintenant: JEUDI, racine });
  });
  const pageDe = (chemin) => site.pages.find((p) => p.chemin === chemin)?.contenu;

  test('l’en-tête d’un match : les deux insignes de l’appli à 58 px, sur le clair (le jour), domicile puis extérieur', () => {
    const tete = (chemin) => pageDe(chemin).match(/<header class="regarder-tete">([\s\S]*?)<\/header>/)[1];
    const seul = (cle) => `${ouverture('insigne', 58, 58, '0 0 200 200')}${sansRacine(REFERENCES[cle])}</svg>`;
    const lens = insigne({ slug: 'losc-lille' }, { taille: 58, fond: 'light' });
    expect(tete('/matchs/lille-lens-2026-10-31/').startsWith(`\n  <div class="regarder-insignes">${lens}`)).toBe(true);
    expect(tete('/matchs/lille-lens-2026-10-31/')).toContain(`<div class="regarder-insignes">${lens}${seul('rc-lens@58/light')}</div>`);
    // Le PSG à l’extérieur sur deux pages : sur chacune, le dessin de l’appli, ses identifiants tels quels.
    expect(tete('/matchs/le-havre-psg-2026-10-30/')).toContain(`${seul('paris-saint-germain@58/light')}</div>`);
    expect(tete('/matchs/real-madrid-psg-2026-11-03/')).toContain(`${seul('paris-saint-germain@58/light')}</div>`);
    // Une sélection : son drapeau ; un club inconnu de l’appli : son insigne neutre.
    expect(tete('/matchs/france-italie-2026-11-01/')).toContain('<div class="regarder-insignes"><svg class="insigne" width="58" height="58" viewBox="0 0 58 58"');
    expect(tete('/matchs/monaco-pafos-2026-11-04/')).toContain(`${ouverture('insigne', 58, 58, '0 0 200 200')}${sansRacine(REFERENCES['neutre:Pafos FC@58/light'])}</svg></div>`);
    // La page en anglais d’un match, de même.
    expect(pageDe('/en/matches/le-havre-psg-2026-10-30/')).toContain(`${seul('paris-saint-germain@58/light')}</div>`);
  });

  test('chaque ligne de match, sur chaque page, porte la paire de l’appli (30 px, sur le clair) devant son nom', () => {
    const pages = site.pages.filter((p) => p.chemin.endsWith('/') && /<a class="regarder-matchs__match" href="\/(?:en\/)?match(?:s|es)\/[^"]+-20\d\d-\d\d-\d\d\/"/.test(p.contenu));
    const chemins = pages.map((p) => p.chemin);
    for (const attendu of ['/matchs/', '/ce-soir/', '/matchs/club/psg/', '/matchs/competition/ligue-1/', '/matchs/le-havre-psg-2026-10-30/']) expect(chemins).toContain(attendu);
    for (const p of pages) {
      const liens = [...p.contenu.matchAll(/<a class="regarder-matchs__match" href="(\/(?:en\/)?match(?:s|es)\/[^"]+-20\d\d-\d\d-\d\d\/)">([\s\S]*?)<\/a>/g)];
      expect(liens.length, p.chemin).toBeGreaterThan(0);
      for (const [, adresse, dedans] of liens) {
        expect(dedans, `${p.chemin} → ${adresse}`).toMatch(/^(?:<svg class="insignes" width="64" height="30" viewBox="0 0 426\.6666666666667 200" aria-hidden="true" focusable="false">[\s\S]*?<\/svg>|<span class="insignes insignes--drapeau" aria-hidden="true">(?:<svg class="insigne" width="30" height="30"[\s\S]*?<\/svg>){2}<\/span>)<span class="regarder-matchs__nom">[^<]+<\/span>$/);
      }
    }
    // Le Havre – PSG, dans la semaine : exactement la paire de l’appli, sur le clair.
    expect(pageDe('/matchs/')).toContain('<svg class="insignes" width="64" height="30" viewBox="0 0 426.6666666666667 200" aria-hidden="true" focusable="false">'
      + `<g>${sansRacine(REFERENCES['le-havre-ac@30/light'])}</g><g transform="translate(226.66666666666666 0)">${sansRacine(REFERENCES['paris-saint-germain@30/light'])}</g></svg><span class="regarder-matchs__nom">Le Havre – PSG</span></a>`);
  });

  test('l’en-tête d’un club et l’agenda : l’insigne du club, à côté de son nom', () => {
    expect(pageDe('/matchs/club/psg/')).toContain(`<header class="regarder-tete">\n  <div class="regarder-insignes">${ouverture('insigne', 58, 58, '0 0 200 200')}${sansRacine(REFERENCES['paris-saint-germain@58/light'])}</svg></div>`);
    const agenda = pageDe('/agenda/');
    const cartes = [...agenda.matchAll(/<h3 class="regarder-carte__nom">(<svg class="insigne" width="30" height="30" viewBox="0 0 200 200" aria-hidden="true" focusable="false">[\s\S]*?<\/svg>)([^<]+)<\/h3>/g)];
    expect(cartes.length).toBeGreaterThan(0);
    const psg = cartes.find(([, , nom]) => nom === 'PSG');
    expect(psg[1]).toBe(`${ouverture('insigne', 30, 30, '0 0 200 200')}${sansRacine(REFERENCES['paris-saint-germain@30/light'])}</svg>`);
  });

  test('l’agenda : un club que l’appli connaît, absent de clubs.json, y a son insigne, le même que dans les lignes de match', async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'insignes-'));
    try {
      const fichier = path.join(dossier, 'scenario.json');
      const club = (slug, canonicalName) => ({ slug, canonicalName });
      writeFileSync(fichier, JSON.stringify({
        matches: [{ id: 'p-farum-psg', startAt: '2026-10-31T16:00:00.000Z', league: 'Ligue 1', homeTeam: 'FC Nordsjælland', awayTeam: 'Paris Saint-Germain', homeClub: club('fc-nordsj-lland', 'FC Nordsjælland'), awayClub: club('paris-saint-germain', 'Paris Saint-Germain') }],
        bars: [],
        matchNights: [],
      }));
      const avec = await construireEnMemoire({ source: `scenario:${fichier}`, maintenant: JEUDI, racine });
      expect(Object.values(chargerLeContenu(racine).clubs).some((c) => c.slugs?.includes('fc-nordsj-lland'))).toBe(false);
      const farum = insigne({ slug: 'fc-nordsj-lland', nom: 'FC Nordsjælland' }, { taille: 30, fond: 'light' });
      expect(farum).not.toContain('fill="#1B1D27"');
      const agenda = avec.pages.find((p) => p.chemin === '/agenda/').contenu;
      expect(agenda).toContain(`<h3 class="regarder-carte__nom">${farum}Nordsjælland</h3>`);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('la page d’un bar : chaque soirée annoncée porte la paire de l’appli (30 px, sur le clair) devant le nom du match', async () => {
    const scenario = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario() });
    const pages = scenario.pages.filter((p) => p.type === 'bar' && p.contenu.includes('id="titre-soirees"'));
    expect(pages.length).toBeGreaterThan(0);
    let soirees = 0;
    for (const p of pages) {
      const section = p.contenu.split('id="titre-soirees"')[1].split('</section>')[0];
      for (const [, dedans] of section.matchAll(/<h3 class="regarder-carte__nom">([\s\S]*?)<\/h3>/g)) {
        soirees += 1;
        expect(dedans, p.chemin).toMatch(/^(?:<svg class="insignes" width="64" height="30" viewBox="0 0 426\.6666666666667 200" aria-hidden="true" focusable="false">(?:(?!<svg)[\s\S])*?<\/svg>|<span class="insignes insignes--drapeau" aria-hidden="true">(?:<svg class="insigne"[^>]*>(?:(?!<svg)[\s\S])*?<\/svg>){2}<\/span>)(?:<a href="\/matchs\/[^"]+">[^<]+<\/a>|[^<]+)$/);
      }
    }
    expect(soirees).toBeGreaterThan(0);
    // Le PSG – OL du Zinc : exactement la paire que la semaine en donne.
    const zinc = scenario.pages.find((p) => p.chemin === '/bar/le-zinc-des-amis-paris-11/').contenu;
    const psgOl = scenario.donnees.matchs.find((m) => m.slug === 'psg-ol-2026-10-25');
    expect(zinc).toContain(`<h3 class="regarder-carte__nom">${paireDInsignes(psgOl.domicile, psgOl.exterieur, { fond: 'light' })}<a href="/matchs/psg-ol-2026-10-25/">PSG – OL</a></h3>`);
  });

  test('chaque page : des identifiants uniques, chaque renvoi vers l’un d’eux, aucun dessin qui ne soit un insigne décoratif', async () => {
    // Avec la semaine des planches, une semaine où un même club et une même sélection jouent deux fois : Monaco (dont
    // l’insigne de 30 px a ses identifiants) et la France (son drapeau), sur la semaine, leurs pages, l’agenda.
    const dossier = mkdtempSync(path.join(tmpdir(), 'insignes-doublons-'));
    let doublons;
    try {
      const fichier = path.join(dossier, 'scenario.json');
      const club = (slug, canonicalName) => ({ slug, canonicalName });
      const match = (id, startAt, league, [domicile, nomDomicile], [exterieur, nomExterieur]) => ({
        id, startAt, league, homeTeam: nomDomicile, awayTeam: nomExterieur, homeClub: club(domicile, nomDomicile), awayClub: club(exterieur, nomExterieur),
      });
      writeFileSync(fichier, JSON.stringify({
        matches: [
          match('d-monaco-lens', '2026-10-30T19:00:00.000Z', 'Ligue 1', ['as-monaco', 'AS Monaco'], ['rc-lens', 'RC Lens']),
          match('d-nice-monaco', '2026-11-01T16:00:00.000Z', 'Ligue 1', ['ogc-nice', 'OGC Nice'], ['as-monaco', 'AS Monaco']),
          match('d-france-italie', '2026-10-31T19:45:00.000Z', 'Match amical', ['nt-fr', 'France'], ['nt-it', 'Italie']),
          match('d-espagne-france', '2026-11-03T19:45:00.000Z', 'Match amical', ['nt-es', 'Espagne'], ['nt-fr', 'France']),
        ],
        bars: [],
        matchNights: [],
      }));
      doublons = await construireEnMemoire({ source: `scenario:${fichier}`, maintenant: JEUDI, racine });
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
    for (const p of [...site.pages, ...doublons.pages].filter((q) => q.chemin.endsWith('/'))) {
      const ids = [...p.contenu.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
      expect(ids.length - new Set(ids).size, p.chemin).toBe(0);
      for (const [, cible] of p.contenu.matchAll(/url\(#([^)]+)\)/g)) expect(ids, p.chemin).toContain(cible);
      for (const dessin of p.contenu.match(/<svg class="insignes?"[^>]*>/g) ?? []) expect(dessin, p.chemin).toMatch(/ aria-hidden="true" focusable="false">$/);
    }
    // Ces pages ont bien des insignes dessinés deux fois : sans identifiantsUniques, leurs identifiants seraient doublés.
    const renommes = doublons.pages.filter((p) => / id="(?:ib-f-|drapeau-)[^"]+-2"/.test(p.contenu)).map((p) => p.chemin);
    expect(renommes).toEqual(expect.arrayContaining(['/matchs/', '/matchs/club/monaco/']));
  });

  test('chaque image de partage, du scénario et de la semaine des planches : son texte dessiné en entier ; celle d’un match dit ce que dit son texte alternatif', async () => {
    const scenario = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario() });
    const decoder = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const plat = (t) => t.replace(/\u00A0/g, ' ').toLocaleLowerCase('fr-FR');
    let matchs = 0;
    for (const s of [site, scenario]) {
      const cartes = s.pages.filter((p) => p.carte);
      expect(cartes.length).toBeGreaterThan(5);
      for (const p of cartes) {
        const svg = svgDeLaCarte(p.carte, { verre: s.cadre.verre });
        const dessine = [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map(([, t]) => decoder(t)).filter((t) => t !== 'Baromatch');
        const lignes = ['surtitre', 'titre', 'ligne', 'ambre'].map((cle) => p.carte[cle]).filter(Boolean);
        // Le titre peut tenir sur deux lignes : le texte dessiné, bout à bout, est celui des lignes de la carte.
        expect(dessine.join(' '), p.chemin).toBe(lignes.join(' '));
        if (!p.carte.insignes) continue;
        matchs += 1;
        for (const l of lignes) expect(plat(p.carte.alt), `${p.chemin} : « ${l} »`).toContain(plat(l));
      }
    }
    expect(matchs).toBeGreaterThan(8);
    // « Samedi 31 octobre · heure à confirmer » ne tient pas entre deux insignes de 160 px : ils sont plus petits.
    const olAngers = scenario.pages.find((p) => p.chemin === '/matchs/ol-angers-2026-10-31/');
    expect(olAngers.carte.ligne).toBe('Samedi 31 octobre · heure à confirmer');
    expect(svgDeLaCarte(olAngers.carte, { verre: scenario.cadre.verre })).toMatch(/<svg x="112" y="\d+(?:\.\d+)?" width="128" height="128" viewBox="0 0 200 200">/);
  });

  // Le fond d’un insigne, lu dans son dessin : sur un fond clair, chaque insigne a son filet d’encre à 60 % (un club, un
  // drapeau) ou son bord d’encre (l’insigne neutre) ; sur la nuit, ni l’un ni l’autre. Une paire en compte deux.
  const FILET_CLAIR = /stroke="rgba\(20,21,31,0\.6\)"|stroke="#14151F" stroke-width="[\d.]+" stroke-opacity="0\.85"/g;
  const fondDuDessin = (dessin) => {
    const filets = (dessin.match(FILET_CLAIR) ?? []).length;
    const insignes = dessin.startsWith('<svg class="insignes"') ? 2 : 1;
    return filets === 0 ? 'night' : filets === insignes ? 'light' : `mêlé (${filets} sur ${insignes})`;
  };
  // Les insignes d’une page qui ne suivent pas son thème : <html class="jour"> donne le clair, sinon la nuit ; sur le
  // papier d’une affiche, toujours le clair.
  const horsDuTheme = (p) => {
    const jour = /<html[^>]*\sclass="[^"]*\bjour\b/.test(p.contenu);
    const attendu = p.type?.startsWith('affiche') || jour ? 'light' : 'night';
    return (p.contenu.match(/<svg class="insignes?"[\s\S]*?<\/svg>/g) ?? []).map(fondDuDessin).filter((f) => f !== attendu).map((f) => `${p.chemin} : ${f} au lieu de ${attendu}`);
  };

  test('le fond des insignes suit le thème de chaque page : <html class="jour"> donne le clair, sinon la nuit ; sur une affiche, le clair', async () => {
    // Le fond, lu sur des dessins connus : un club, l’insigne neutre, un drapeau, une paire.
    for (const club of [{ slug: 'paris-saint-germain' }, { slug: 'pafos-fc', nom: 'Pafos FC' }, { slug: 'nt-fr', nom: 'France' }]) {
      for (const taille of [30, 58]) for (const fond of ['light', 'night']) expect(fondDuDessin(insigne(club, { taille, fond })), `${club.slug}, ${taille}, ${fond}`).toBe(fond);
    }
    for (const fond of ['light', 'night']) expect(fondDuDessin(paireDInsignes({ slug: 'le-havre-ac' }, { slug: 'rc-lens' }, { fond }))).toBe(fond);
    // Chaque page générée, de la semaine des planches et du scénario (affiches comprises).
    const scenario = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario(), qr: chargerLeQr().qr });
    const pages = [...site.pages, ...scenario.pages].filter((p) => /<svg class="insignes?"/.test(p.contenu ?? ''));
    expect(pages.length).toBeGreaterThan(30);
    expect(pages.some((p) => p.type === 'affiche')).toBe(true);
    expect(pages.flatMap(horsDuTheme)).toEqual([]);
    // Une page générée qui change de thème sans que ses insignes suivent (le jour retiré, ou posé) : ce test le voit.
    const match = site.pages.find((p) => p.chemin === '/matchs/le-havre-psg-2026-10-30/');
    const autreTheme = match.contenu.includes('<html lang="fr" class="jour">')
      ? match.contenu.replace('<html lang="fr" class="jour">', '<html lang="fr">')
      : match.contenu.replace('<html lang="fr">', '<html lang="fr" class="jour">');
    expect(autreTheme).not.toBe(match.contenu);
    expect(horsDuTheme({ ...match, contenu: autreTheme }).length).toBeGreaterThan(2);
  });

  test('l’image de partage d’un match : les deux insignes de l’appli à 160 px, sur la nuit, la saison écrite', () => {
    const page = site.pages.find((p) => p.chemin === '/matchs/le-havre-psg-2026-10-30/');
    expect(page.carte.insignes).toEqual({ domicile: { slug: 'le-havre-ac', cle: 'le-havre', nom: 'Le Havre AC' }, exterieur: { slug: 'paris-saint-germain', cle: 'psg', nom: 'Paris Saint-Germain' }, saison: '26/27' });
    const svg = svgDeLaCarte(page.carte, { verre: site.cadre.verre });
    // À 64 px des bords de la carte (x 48, largeur 1104), au milieu de la hauteur du texte (de 150 à 538).
    expect(svg).toContain(`<svg x="928" y="264" width="160" height="160" viewBox="0 0 200 200">${sansRacine(REFERENCES['paris-saint-germain@160/night'])}</svg>`);
    expect(svg).toMatch(/<svg x="112" y="264" width="160" height="160" viewBox="0 0 200 200">/);
    expect(svg).not.toMatch(/<image|href=|aria-hidden/);
    // Sans les insignes (une autre sorte de page), la carte reste celle d’avant.
    expect(svgDeLaCarte({ ...page.carte, insignes: undefined }, { verre: site.cadre.verre })).not.toContain('width="160"');
  });
});

test.describe('les lignes de match, dans le navigateur (le scénario)', () => {
  let dossier;
  let serveur;
  const portLibre = () => new Promise((resoudre) => {
    const sonde = createServer();
    sonde.listen(0, '127.0.0.1', () => { const { port } = sonde.address(); sonde.close(() => resoudre(port)); });
  });
  test.beforeAll(async () => {
    dossier = mkdtempSync(path.join(tmpdir(), 'insignes-lignes-'));
    await construireLeSiteDExemple(dossier, { rendu: null });
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(async () => {
    await serveur?.arreter();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  // Les pages où un long nom suit sa paire (« Paris Saint-Germain v FC Barcelona », en anglais), et celles en français.
  const PAGES_DES_LIGNES = ['/en/', '/en/champions-league/', '/en/matches/psg-barca-2026-10-24/', '/matchs/', '/ce-soir/', '/matchs/club/psg/', '/regarder-le-match/paris/'];
  // Chaque ligne de match visible qui a sa paire : chaque dessin (sa largeur, celle de son attribut), la paire, le nom
  // (le texte seul) et ses mots coupés sur deux lignes (« Saint- / Germain »).
  const lireLesLignes = (page) => page.evaluate(() => [...document.querySelectorAll('.regarder-matchs__match')].filter((l) => l.checkVisibility() && l.querySelector('.insignes')).map((ligne) => {
    const paire = ligne.querySelector('.insignes').getBoundingClientRect();
    // Le nom : son élément (le texte de la ligne, s’il n’en a pas).
    const nom = ligne.querySelector('.regarder-matchs__nom') ?? ligne;
    const rects = [];
    const coupes = [];
    const marcheur = document.createTreeWalker(nom, NodeFilter.SHOW_TEXT);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      for (const mot of n.data.matchAll(/\S+/g)) {
        const plage = document.createRange();
        plage.setStart(n, mot.index);
        plage.setEnd(n, mot.index + mot[0].length);
        const lignes = [...plage.getClientRects()].filter((r) => r.width > 0);
        rects.push(...lignes);
        if (new Set(lignes.map((r) => Math.round(r.top))).size > 1) coupes.push(mot[0]);
      }
    }
    return {
      nom: nom.textContent.trim(),
      dessins: [...ligne.querySelectorAll('svg')].map((d) => [d.getBoundingClientRect().width, Number(d.getAttribute('width'))]),
      paire: { gauche: paire.left, droite: paire.right, haut: paire.top, bas: paire.bottom },
      texte: { gauche: Math.min(...rects.map((r) => r.left)), haut: Math.min(...rects.map((r) => r.top)), basPremiere: Math.min(...rects.map((r) => r.bottom)) },
      coupes,
    };
  }));

  for (const largeur of [320, 360, 393, 412]) {
    test(`à ${largeur} px, texte à 100 et 200 % : chaque nom à côté de sa paire ou dessous, la paire à sa taille, aucun mot coupé (à 200 %, dès 393 px)`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(MAINTENANT_DU_SCENARIO));
      await page.setViewportSize({ width: largeur, height: 900 });
      let lignes = 0;
      let dessous = 0;
      for (const chemin of PAGES_DES_LIGNES) {
        await page.goto(`${serveur.adresse}${chemin}`);
        await page.evaluate(() => document.fonts.ready);
        for (const pourcent of [100, 200]) {
          await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
          const cas = `${chemin}, ${pourcent} %`;
          const lus = await lireLesLignes(page);
          lignes += lus.length;
          const ecarts = [];
          for (const l of lus) {
            for (const [vue, attendue] of l.dessins) if (Math.abs(vue - attendue) > 0.5) ecarts.push(`${l.nom} : un insigne de ${vue} px au lieu de ${attendue}`);
            const aCote = l.texte.gauche >= l.paire.droite - 0.5 && l.texte.haut < l.paire.bas && l.texte.basPremiere > l.paire.haut;
            const auDessous = l.texte.haut >= l.paire.bas - 0.5;
            if (auDessous) dessous += 1;
            if (!aCote && !auDessous) ecarts.push(`${l.nom} : ni à côté de sa paire, ni dessous`);
            // À 320 et 360 px, texte à 200 %, « Saint-Germain » se coupe à son trait d’union, comme sans les insignes :
            // la ligne n’a pas la place d’un mot de plus.
            if (pourcent === 100 || largeur >= 393) for (const mot of l.coupes) ecarts.push(`${l.nom} : « ${mot} » coupé`);
          }
          expect(ecarts, cas).toEqual([]);
        }
      }
      expect(lignes).toBeGreaterThan(20);
      expect(dessous).toBeGreaterThan(0);
    });
  }
});

test.describe('plus aucun ancien disque, et jamais un écusson', () => {
  // Les fichiers que git suit (ou suivrait) : les pages, le générateur, les feuilles de style.
  const FICHIERS = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: racine, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const lireDuDepot = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');

  test('ni dans les pages, ni dans le générateur, ni dans les styles', () => {
    const lus = FICHIERS.filter((f) => /\.html$/.test(f) || /^generateur\/.*\.(?:mjs|json)$/.test(f) || /^(?:styles|affiche)\.css$/.test(f));
    expect(lus.length).toBeGreaterThan(100);
    const restes = lus.filter((f) => /class="disque|viewBox="0 0 2 2"|export const disque|couleurs\.json|\.disque\b/.test(lireDuDepot(f)));
    expect(restes).toEqual([]);
    expect(FICHIERS).not.toContain('generateur/contenu/couleurs.json');
  });

  test('le générateur ne lit d’un club que son slug et son nom (canonicalName), rien d’autre', () => {
    // Le club d’un match n’entre que par clubDe (generateur/donnees.mjs), et la copie réduite des matchs enregistrés ne
    // garde que ces deux champs (generateur/outils/reduire-capture.mjs).
    const generateur = FICHIERS.filter((f) => /^generateur\/.*\.mjs$/.test(f) && !f.startsWith('generateur/insignes/'));
    expect(generateur.filter((f) => /\b(?:home|away)Club\b/.test(lireDuDepot(f)))).toEqual(['generateur/donnees.mjs', 'generateur/outils/reduire-capture.mjs']);
    expect(lireDuDepot('generateur/outils/reduire-capture.mjs')).toContain("const CLUB = ['slug', 'canonicalName'];");
    // clubDe ne lit que ces deux champs : chaque usage du club est la lecture de l’un d’eux.
    const source = clubDe.toString();
    const usages = [...source.matchAll(/\bclubBrut\b(\??\.\w+)?/g)].slice(1);
    expect(usages.length).toBeGreaterThan(0);
    expect([...new Set(usages.map(([, lecture]) => lecture?.replace(/^\?/, '')))].sort()).toEqual(['.canonicalName', '.slug']);
    // Et un club qui porterait d’autres champs donne exactement le même résultat.
    const index = indexerLesClubs(chargerLeContenu(racine).clubs);
    for (const [club, equipe] of [
      [{ slug: 'paris-saint-germain', canonicalName: 'Paris Saint-Germain' }, 'Paris Saint-Germain'],
      [{ slug: 'fc-nordsj-lland', canonicalName: 'FC Nordsjælland' }, 'FC Nordsjælland'],
      [{ slug: 'club-inconnu', canonicalName: 'Club Inconnu' }, 'Club Inconnu'],
    ]) {
      expect(clubDe(index, { ...club, autre: 'x', image: 'x' }, equipe), club.slug).toEqual(clubDe(index, club, equipe));
    }
  });

  test('sur l’accueil, chaque insigne est décoratif, fait de formes, et suivi du nom écrit du club', async () => {
    // L’accueil enregistré (une semaine sans match n’a aucune carte, c’est permis), et le bloc de la semaine des planches,
    // qui en a toujours.
    const accueil = readFileSync(path.join(racine, 'index.html'), 'utf8');
    const site = await construireEnMemoire({ source: `scenario:${SEMAINE}`, maintenant: JEUDI, racine });
    const planches = blocDeLaSemaine({ donnees: site.donnees, textes: site.contenu.textes, maintenant: JEUDI });
    const liensDe = (bloc) => bloc.split('<a class="carte-match__clubs"').slice(1).map((l) => l.split('</a>')[0]);
    expect(liensDe(planches)).toHaveLength(5);
    const liens = [...liensDe(accueil.split(REPERES.debut)[1].split(REPERES.fin)[0]), ...liensDe(planches)];
    for (const lien of liens) {
      // La paire de l’appli (un seul dessin), ou deux dessins quand une sélection y est (son drapeau), puis les noms.
      expect(lien).toMatch(/^ href="[^"]+">(?:<svg class="insignes" width="64" height="30" viewBox="0 0 426\.6666666666667 200" aria-hidden="true" focusable="false">(?:(?!<svg)[\s\S])*?<\/svg>|<span class="insignes insignes--drapeau" aria-hidden="true">(?:<svg class="insigne" width="30" height="30" viewBox="[^"]+" aria-hidden="true" focusable="false">(?:(?!<svg)[\s\S])*?<\/svg>){2}<\/span>)<span class="carte-match__club">[^<]+<\/span><span class="visuellement-cache"> – <\/span><span class="carte-match__club">[^<]+<\/span>$/);
      for (const dessin of lien.match(/<svg[\s\S]*?<\/svg>/g)) expect(dessin).not.toMatch(/<image|href=|<text|<title|style=/);
    }
    expect(liensDe(planches).filter((lien) => lien.includes('insignes--drapeau'))).toHaveLength(1);
    // Hors du bloc, aucun insigne : l’accueil écrit à la main n’en dessine pas.
    expect(accueil.split(REPERES.debut)[0] + accueil.split(REPERES.fin)[1]).not.toContain('class="insigne');
    // Un identifiant n’y sert qu’une fois.
    const ids = [...accueil.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
    expect(ids.length - new Set(ids).size).toBe(0);
  });
});
