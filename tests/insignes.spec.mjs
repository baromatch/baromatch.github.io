// Les insignes des clubs : chaque club est dessiné exactement comme dans l’appli Baromatch, avec son générateur, copié
// dans generateur/insignes/ par generateur/outils/insignes/exporter.mjs, et posé dans les pages par
// generateur/insigne.mjs. Ce qu’on vérifie : que la copie dessine comme l’appli (les empreintes que l’appli tient, et des
// dessins de son paquet compilé, tests/donnees/insignes/) ; que les pages posent ces dessins comme l’appli les pose (la
// paire de sa liste « Les matchs », l’insigne seul, le drapeau d’une sélection, l’insigne neutre d’un club inconnu) ;
// et qu’il ne reste nulle part un ancien disque, ni un écusson.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { clubDe, indexerLesClubs } from '../generateur/donnees.mjs';
import { bandesDe, identifiantsUniques, insigne, paireDInsignes, TAILLES } from '../generateur/insigne.mjs';
import * as insignes from '../generateur/insignes/index.mjs';
import { racine } from './outils/environnement.mjs';

const DONNEES = path.join(racine, 'tests', 'donnees', 'insignes');
const lire = (fichier) => JSON.parse(readFileSync(path.join(DONNEES, fichier), 'utf8'));
const REFERENCES = lire('references.json');
// Un jeudi de la saison 26/27.
const JEUDI = Date.parse('2026-10-29T09:00:00Z');

// Un insigne de l’appli sans sa racine : ce que sa paire met dans chacun de ses deux groupes.
const sansRacine = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const ouverture = (classe, largeur, hauteur, boite) => `<svg class="${classe}" width="${largeur}" height="${hauteur}" viewBox="${boite}" aria-hidden="true" focusable="false">`;
const empreinte = (svg) => createHash('sha256').update(svg).digest().subarray(0, 8).toString('base64url');
const COPIE = path.join(racine, 'generateur', 'insignes');
const PROVENANCE = JSON.parse(readFileSync(path.join(COPIE, 'provenance.json'), 'utf8'));

test.describe('la copie du générateur de l’appli', () => {
  test('elle redonne les 500 empreintes que l’appli tient : 100 clubs à 20, 48 et 160 px, sur fond clair, et leur dos', () => {
    const { _lisezMoi, ...attendues } = lire('empreintes.json');
    expect(_lisezMoi).toContain(`l’appli Baromatch ${PROVENANCE.versionDeLAppli}`);
    const obtenues = {};
    for (const slug of [...insignes.CLUB_BADGE_SLUGS].sort()) {
      const fiche = insignes.badgeSpecFor(slug);
      for (const size of [20, 48, 160]) obtenues[`${slug}@${size}`] = empreinte(insignes.badgeSvg(fiche, { size, season: '26/27', idPrefix: 'b' }));
      obtenues[`${slug}@160/light`] = empreinte(insignes.badgeSvg(fiche, { size: 160, surface: 'light', season: '26/27', idPrefix: 'b' }));
      obtenues[`${slug}@back`] = empreinte(insignes.badgeBackSvg(fiche, { size: 160, since: 'Sur Baromatch depuis mars 2026', idPrefix: 'k' }));
    }
    expect(Object.keys(obtenues)).toHaveLength(500);
    expect(obtenues).toEqual(attendues);
  });

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
    // La version de l’appli d’où vient la copie : un numéro de version, jamais un identifiant de commit.
    expect(PROVENANCE.versionDeLAppli).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('aucun commentaire copié : seulement l’en-tête de l’exportation, et la licence de la police des lettres', () => {
    for (const fichier of readdirSync(COPIE).filter((f) => f.endsWith('.mjs'))) {
      const texte = readFileSync(path.join(COPIE, fichier), 'utf8');
      const entete = texte.match(/^(?:\/\*[^\n]*\*\/\n)+/)[0];
      expect(entete, fichier).toMatch(/^\/\* © Baromatch, tous droits réservés\. Copie produite par generateur\/outils\/insignes\/exporter\.mjs \(voir provenance\.json\) : ne pas modifier à la main\. \*\/\n/);
      if (fichier === 'glyphs.generated.mjs') expect(entete).toContain('/* Bricolage Grotesque (SIL Open Font License 1.1)');
      // Ni « // » en début de ligne, ni « /* » après l’en-tête (le code copié n’a ni l’un ni l’autre ailleurs).
      expect(texte.slice(entete.length), fichier).not.toMatch(/^\s*\/\/|\/\*/m);
    }
    // La licence de la police, à côté des polices du site, citée par l’en-tête des lettres.
    expect(readFileSync(path.join(racine, 'fonts', 'LICENSE-OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  test('la table des clubs ne garde que ce que le dessin lit : ni sources, ni raisons d’un motif ou d’un code', () => {
    const texte = readFileSync(path.join(COPIE, 'specs.mjs'), 'utf8');
    expect(texte).not.toMatch(/https?:|codeFrom|patternReason|sources|reason|source|propriétaire|choix/);
    // Les champs d’une fiche : ceux que le dessin lit, et le nom du club ; ceux du maillot extérieur, son motif et ses
    // couleurs (generateur/outils/insignes/exporter.mjs n’en laisse passer aucun autre).
    const DESSIN = ['slug', 'name', 'city', 'code', 'pattern', 'colours', 'founded', 'geography', 'density', 'away', 'kern', 'nudge', 'band', 'split', 'letters', 'yearOnFace'];
    for (const slug of insignes.CLUB_BADGE_SLUGS) {
      const fiche = insignes.badgeSpecFor(slug);
      for (const champ of Object.keys(fiche)) expect(DESSIN, `${slug} : ${champ}`).toContain(champ);
      for (const champ of Object.keys(fiche.away ?? {})) expect(['pattern', 'colours', 'density', 'split'], `${slug} : away.${champ}`).toContain(champ);
      for (const champ of ['slug', 'name', 'code', 'pattern', 'colours']) expect(fiche[champ], `${slug} : ${champ}`).toBeTruthy();
    }
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
    expect(insigne({ slug: 'nt-fr', nom: 'France' }, { taille: 30, fond: 'light', maintenant: JEUDI })).toBe(`${ouverture('insigne', 30, 30, '0 0 30 30')}`
      + '<defs><clipPath id="drapeau-fr-30"><circle cx="15" cy="15" r="15"/></clipPath></defs><g clip-path="url(#drapeau-fr-30)">'
      + '<rect x="0" y="0" width="10.5" height="30" fill="#0055A4"/><rect x="10" y="0" width="10.5" height="30" fill="#FFFFFF"/><rect x="20" y="0" width="10" height="30" fill="#EF4135"/>'
      + '</g><circle cx="15" cy="15" r="14.5" stroke="rgba(255,255,255,0.18)" stroke-width="1" fill="none"/></svg>');
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
