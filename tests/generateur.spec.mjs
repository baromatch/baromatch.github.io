// Le générateur des pages « Où regarder le match », sans navigateur : les données (vrais bars, doublons, heure de
// Paris, villes), les pages qu’il écrit (indexation, plan du site, données structurées, badge) et les seuls chemins
// qu’il a le droit de toucher. Le scénario inventé (tests/donnees/scenario.json) se lit à l’heure du vendredi
// 23 octobre 2026 ; la copie réduite des listes publiques (tests/donnees/capture) à celle de son enregistrement.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { lireLaSource } from '../generateur/sources.mjs';
import { arrondissementDe, clubDe, indexerLesClubs, lireLAdresse, preparer, raisonDEcarter, villeDe } from '../generateur/donnees.mjs';
import { isoDeParis, jourDeParis, quandEnLettres } from '../generateur/heure.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { blocsDe, chargerLeVocabulaire, validerLaPage, validerUnBloc } from '../generateur/validateur.mjs';
import { controlerLaPage } from '../generateur/controle.mjs';
import { echapper } from '../generateur/texte.mjs';
import { construire } from '../generateur/construire.mjs';
import { ecrireUnFichier, estPermis } from '../generateur/etat.mjs';
import { prevenirIndexNow, reglagesIndexNow, requeteIndexNow } from '../generateur/publier.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');
const ENREGISTREMENT = Date.parse('2026-10-15T19:44:29Z');
const contenu = chargerLeContenu(racine);

const donneesDu = async (source, maintenant) => preparer(await lireLaSource(source), { maintenant, ...contenu });

test.describe('les données', () => {
  test('les bars de démo, d’essai, inactifs ou exclus ne sont jamais de vrais bars', async () => {
    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    expect(donnees.bars.map((b) => b.nom).sort()).toEqual(['Au Bon Coin', 'La Cave des Gones', 'Le Café des Sports', 'Le Comptoir du Canal', 'Le Zinc des Amis']);
    const essai = 'démo, test ou essai dans le nom, l’adresse ou l’identifiant';
    expect(Object.fromEntries(donnees.ecartes.map((e) => [e.nom, e.raison]))).toEqual({
      'Bar de démo Baromatch': essai,
      'Bar DÉMO Lille': essai,
      'Chez Lucette': 'bar de démonstration',
      'Le Rideau Baissé': 'bar inactif',
      // Les noms d’essai courants, même collés à un chiffre, à « _ » ou à un autre mot.
      'Bar de démonstration': essai,
      'Bar d’essai Baromatch': essai,
      'Bar Test1': essai,
      bar_test: essai,
      Demo2: essai,
      'QA2 Bar': essai,
      TestBar: essai,
      'Bar recette': essai,
      // Un vrai bar écarté à tort : moins grave qu’un faux bar publié, et réintégré par la liste « forcer ».
      'Le Testament': essai,
    });
    // Aucune soirée d’un faux bar : le match de Lille, diffusé seulement par deux bars de démo, n’a pas de bar.
    const faux = new Set(donnees.ecartes.map((e) => e.id));
    expect(donnees.soirees.filter((s) => faux.has(s.bar.id))).toEqual([]);
    expect(donnees.matchs.find((m) => m.slug === 'lille-lens-2026-10-26').soirees).toEqual([]);

    // Insensible aux accents et aux capitales, sans limite de mot, dans le nom, l’adresse ou l’identifiant ; « qa »
    // seul ou collé à un chiffre ou à « _ », jamais dans « Aquarium » ; la liste d’exclusion, par identifiant ou
    // adresse de page ; isDemo, qui n’existe pas encore dans les données, est déjà lu.
    const vide = new Set();
    const rue = '1 rue de Paris, 75001 Paris';
    expect(raisonDEcarter({ name: 'Le Comptoir', address: '1 rue des Tèsts, 75001 Paris' }, vide)).toBe(essai);
    expect(raisonDEcarter({ name: 'Bar Qa', address: rue }, vide)).toBe(essai);
    for (const name of ['Bar staging', 'Sandbox Pub', 'Le Bar fictif', 'Comptoir factice', 'Démonstration', 'bar_qa', 'Le Contest']) {
      expect(raisonDEcarter({ name, address: rue }, vide), name).toBe(essai);
    }
    expect(raisonDEcarter({ id: 'bar-arrival-qa-production', name: 'Le Comptoir', address: rue }, vide)).toBe(essai);
    expect(raisonDEcarter({ id: 'b-9', name: 'L’Aquarium', address: '1 quai de la Gare, 75013 Paris' }, vide)).toBeNull();
    expect(raisonDEcarter({ name: 'Le Quai', address: '1 quai de la Gare, 75013 Paris' }, vide)).toBeNull();
    expect(raisonDEcarter({ id: 'b-t1', name: 'Le Testament', address: rue }, vide, new Set(['b-t1']))).toBeNull();
    expect(raisonDEcarter({ id: 'b-1', name: 'Le Quai', address: '1 quai, 75013 Paris' }, new Set(['b-1']))).toBe('liste d’exclusion');
    const force = preparer(await lireLaSource(`scenario:${SCENARIO}`), { maintenant: VENDREDI, ...contenu, forcer: ['b-t1'] });
    expect(force.bars.map((b) => b.nom)).toContain('Le Testament');
    expect(force.bars.map((b) => b.nom)).not.toContain('TestBar');
    // La liste « forcer » existe dans bars-exclus.json, vide, et son mode d’emploi est écrit à côté.
    const fichierExclus = JSON.parse(readFileSync(path.join(racine, 'generateur', 'bars-exclus.json'), 'utf8'));
    expect(fichierExclus.forcer).toEqual([]);
    expect(fichierExclus._lisezMoi).toContain('Le Testament');
    expect(fichierExclus._lisezMoi).toContain('forcer');
    const exclu = preparer(await lireLaSource(`scenario:${SCENARIO}`), { maintenant: VENDREDI, ...contenu, exclus: ['le-zinc-des-amis-paris-11'] });
    expect(exclu.bars.map((b) => b.nom)).not.toContain('Le Zinc des Amis');
  });

  test('la copie enregistrée de ce soir : zéro vrai bar (le seul bar est celui de démo)', async () => {
    const donnees = await donneesDu(`capture:${CAPTURE}`, ENREGISTREMENT);
    expect(donnees.bars).toEqual([]);
    expect(donnees.soirees).toEqual([]);
    expect(donnees.ecartes.map((e) => e.nom)).toEqual(['Bar de démo Baromatch']);
    // 79 matchs reçus, dont un en double (Ligue des champions et UEFA Champions League) : 78.
    expect(donnees.matchs).toHaveLength(78);
  });

  test('les doublons : un seul match, le nom français de la compétition, toutes les soirées', async () => {
    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    const barca = donnees.matchs.filter((m) => m.domicile.cle === 'psg' && m.exterieur.cle === 'barca');
    expect(barca).toHaveLength(1);
    expect(barca[0].competition).toBe('Ligue des champions');
    expect(barca[0].ids).toEqual(['m-psg-barca-en', 'm-psg-barca-fr']);
    expect(barca[0].slug).toBe('psg-barca-2026-10-24');
    // Le Zinc annonce la soirée sous les deux identifiants : une seule soirée ; le Comptoir, sous l’autre, la rejoint.
    expect(barca[0].soirees.map((s) => s.bar.nom)).toEqual(['Le Comptoir du Canal', 'Le Zinc des Amis']);

    // Dans la copie de ce soir : PSG – Barça, une seule fois, en Ligue des champions.
    const capture = await donneesDu(`capture:${CAPTURE}`, ENREGISTREMENT);
    const psgBarca = capture.matchs.filter((m) => m.domicile.cle === 'psg' && m.exterieur.cle === 'barca');
    expect(psgBarca.map((m) => [m.slug, m.competition])).toEqual([['psg-barca-2026-10-20', 'Ligue des champions']]);
    // Des séparateurs « - » et « – », et deux matchs à la même heure qui ne sont pas des doublons : chacun garde le sien.
    expect(capture.matchs.filter((m) => m.debut === Date.parse('2026-10-25T16:15:00Z'))).toHaveLength(4);
  });

  test('les noms courts des clubs, Havre AC et Le Havre AC ne font qu’un, et le repli sans sigles', async () => {
    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    const slugs = donnees.matchs.map((m) => m.slug);
    expect(slugs).toEqual(expect.arrayContaining(['psg-ol-2026-10-25', 'le-havre-auxerre-2026-10-25', 'le-havre-psg-2026-10-30', 'om-lens-2026-10-22']));
    const havre = donnees.matchs.filter((m) => [m.domicile.cle, m.exterieur.cle].includes('le-havre'));
    expect(havre.map((m) => [m.domicile.court, m.domicile.nom])).toEqual([['Le Havre', 'Le Havre AC'], ['Le Havre', 'Le Havre AC']]);

    const index = indexerLesClubs(contenu.clubs);
    expect(clubDe(index, { slug: 'paris-saint-germain', canonicalName: 'Paris Saint-Germain' })).toEqual({ cle: 'psg', court: 'PSG', nom: 'Paris Saint-Germain' });
    expect(clubDe(index, { slug: 'fk-bod-glimt', canonicalName: 'FK Bodø/Glimt' })).toEqual({ cle: 'bodo-glimt', court: 'Bodø/Glimt', nom: 'FK Bodø/Glimt' });
    expect(clubDe(index, { slug: 'sk-sturm-graz', canonicalName: 'SK Sturm Graz' }).court).toBe('Sturm Graz');
    expect(clubDe(index, null, 'Como 1907').court).toBe('Como 1907');
    // Chaque club de la copie de ce soir a un nom court sans sigle (sauf le Paris FC, dont c’est le nom).
    const capture = await donneesDu(`capture:${CAPTURE}`, ENREGISTREMENT);
    const courts = new Set(capture.matchs.flatMap((m) => [m.domicile.court, m.exterieur.court]));
    expect([...courts].filter((nom) => nom !== 'Paris FC' && /\b(?:FC|AC|CF|SC|AS|SSC|UD|KV|BC|SK|FK|RC|OGC|AJ)\b/.test(nom))).toEqual([]);
  });

  test('l’heure de Paris, des deux côtés du changement d’heure du 25 octobre', async () => {
    // Samedi 24 : Paris est à +02:00 ; dimanche 25 après 3 h : +01:00.
    expect(quandEnLettres(Date.parse('2026-10-24T19:00:00Z'))).toBe('samedi 24 octobre · 21:00');
    expect(isoDeParis(Date.parse('2026-10-24T19:00:00Z'))).toBe('2026-10-24T21:00:00+02:00');
    expect(quandEnLettres(Date.parse('2026-10-25T19:45:00Z'))).toBe('dimanche 25 octobre · 20:45');
    expect(isoDeParis(Date.parse('2026-10-25T19:45:00Z'))).toBe('2026-10-25T20:45:00+01:00');
    expect(isoDeParis(Date.parse('2026-10-25T13:00:00Z'))).toBe('2026-10-25T14:00:00+01:00');
    // La nuit du changement : 00:30 UTC est 02:30 en heure d’été, 01:30 UTC est 02:30 en heure d’hiver.
    expect(isoDeParis(Date.parse('2026-10-25T00:30:00Z'))).toBe('2026-10-25T02:30:00+02:00');
    expect(isoDeParis(Date.parse('2026-10-25T01:30:00Z'))).toBe('2026-10-25T02:30:00+01:00');
    // Le jour d’un match tard le soir est celui de Paris, pas celui d’UTC.
    expect(jourDeParis(Date.parse('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    expect(quandEnLettres(Date.parse('2026-10-31T23:30:00Z'))).toBe('dimanche 1er novembre · 00:30');
    // Une heure provisoire ne s’affiche pas.
    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    const provisoire = donnees.matchs.find((m) => m.slug === 'ol-angers-2026-10-31');
    expect(provisoire.heureConfirmee).toBe(false);
    expect(quandEnLettres(provisoire.debut, provisoire.heureConfirmee)).toBe('samedi 31 octobre · heure à confirmer');
  });

  test('la ville et l’arrondissement d’un bar, lus dans son adresse', async () => {
    expect(lireLAdresse('Site QA - 99 Rue de Rivoli, 75001 Paris')).toEqual({ rue: 'Site QA - 99 Rue de Rivoli', codePostal: '75001', ville: 'Paris' });
    expect(lireLAdresse('3 Place Sainte-Anne 35000 Rennes, France')).toEqual({ rue: '3 Place Sainte-Anne', codePostal: '35000', ville: 'Rennes' });
    expect(lireLAdresse('Quelque part à Paris')).toBeNull();
    const villes = contenu.villes;
    expect(villeDe(villes, '75011', 'Paris')).toEqual({ cle: 'paris', nom: 'Paris' });
    expect(villeDe(villes, '59800', 'Lille')).toEqual({ cle: 'lille', nom: 'Lille' });
    expect(villeDe(villes, '35000', 'Rennes')).toEqual({ cle: 'rennes', nom: 'Rennes' });
    expect(arrondissementDe('paris', 'Paris', '75001')).toEqual({ numero: 1, libelle: 'Paris 1er', ancre: 'paris-1' });
    expect(arrondissementDe('paris', 'Paris', '75116').libelle).toBe('Paris 16e');
    expect(arrondissementDe('lyon', 'Lyon', '69003')).toEqual({ numero: 3, libelle: 'Lyon 3e', ancre: 'lyon-3' });
    expect(arrondissementDe('marseille', 'Marseille', '13001').libelle).toBe('Marseille 1er');
    expect(arrondissementDe('lille', 'Lille', '59000')).toBeNull();

    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    const parNom = Object.fromEntries(donnees.bars.map((b) => [b.nom, [b.ville.cle, b.quartier, b.slug]]));
    expect(parNom).toEqual({
      'Le Zinc des Amis': ['paris', 'Paris 11e', 'le-zinc-des-amis-paris-11'],
      'Le Comptoir du Canal': ['paris', 'Paris 10e', 'le-comptoir-du-canal-paris-10'],
      'La Cave des Gones': ['lyon', 'Lyon 2e', 'la-cave-des-gones-lyon-2'],
      'Au Bon Coin': ['lyon', 'Lyon 2e', 'au-bon-coin-lyon-2'],
      'Le Café des Sports': ['rennes', 'Rennes', 'le-cafe-des-sports-rennes'],
    });
  });

  test('les offres : telles que le bar les a écrites, la mention santé sauf sans alcool, jamais un mot interdit', async () => {
    const donnees = await donneesDu(`scenario:${SCENARIO}`, VENDREDI);
    const offre = (bar, slug) => donnees.soirees.find((s) => s.bar.nom === bar && s.match.slug === slug).offre;
    expect(offre('Le Zinc des Amis', 'psg-ol-2026-10-25')).toEqual({ titre: 'Pinte et planche à partager', prixCentimes: 1200, alcool: true });
    expect(offre('Le Comptoir du Canal', 'psg-barca-2026-10-24')).toEqual({ titre: 'Menu burger et boisson fraîche', prixCentimes: 1500, alcool: false });
    expect(offre('Le Comptoir du Canal', 'le-havre-psg-2026-10-30')).toBeNull();
    expect(donnees.avertissements).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle contient un mot que le site ne publie pas']);
    // Une soirée annulée ne compte pas ; une soirée complète (CLOSED) reste annoncée.
    expect(donnees.soirees.filter((s) => s.bar.nom === 'Le Comptoir du Canal' && s.match.slug === 'psg-ol-2026-10-25')).toEqual([]);
    expect(donnees.bars.find((b) => b.nom === 'La Cave des Gones').soirees.map((s) => s.match.slug)).toEqual(['brest-nice-2026-10-23', 'psg-ol-2026-10-25']);
  });

  test('une source illisible, en erreur ou sans match arrête tout', async () => {
    await expect(lireLaSource('ailleurs')).rejects.toThrow(/Source inconnue/);
    await expect(lireLaSource(`capture:${path.join(racine, 'tests', 'donnees', 'absent')}`)).rejects.toThrow();
    const dossier = mkdtempSync(path.join(tmpdir(), 'scenario-'));
    try {
      const sansMatch = path.join(dossier, 'vide.json');
      writeFileSync(sansMatch, JSON.stringify({ ...JSON.parse(readFileSync(SCENARIO, 'utf8')), matches: [] }));
      await expect(lireLaSource(`scenario:${sansMatch}`)).rejects.toThrow(/Aucun match/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
    // Une adresse qui répond une erreur, puis une qui renvoie autre chose qu’une liste.
    for (const reponse of [(_, r) => { r.statusCode = 500; r.end('panne'); }, (_, r) => r.end('{"erreur": true}')]) {
      const serveur = createServer(reponse);
      await new Promise((resoudre) => serveur.listen(0, '127.0.0.1', resoudre));
      try {
        await expect(lireLaSource('api', { adresse: `http://127.0.0.1:${serveur.address().port}` })).rejects.toThrow();
      } finally {
        serveur.close();
      }
    }
  });
});

// ---------- Les pages ----------

const NOEUDS = (valeur) => (Array.isArray(valeur) ? valeur.flatMap(NOEUDS)
  : valeur && typeof valeur === 'object' ? [valeur, ...Object.values(valeur).flatMap(NOEUDS)] : []);
const donneesStructurees = (p) => blocsDe(p.contenu).flatMap((bloc) => bloc['@graph']);
const deType = (p, type) => NOEUDS(donneesStructurees(p)).filter((n) => [].concat(n['@type'] ?? []).includes(type));
const robotsDe = (p) => p.contenu.match(/<meta name="robots" content="([^"]*)">/)[1];

test.describe('les pages', () => {
  let site;
  test.beforeAll(async () => {
    site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine });
  });
  const pageDe = (chemin) => {
    const trouvee = site.pages.find((p) => p.chemin === chemin);
    expect(trouvee, chemin).toBeTruthy();
    return trouvee;
  };

  test('chaque page passe le contrôle et la validation de ses données structurées', () => {
    // construireEnMemoire refuse tout le passage à la première erreur : arriver ici, c’est zéro erreur.
    expect(site.pages.map((p) => p.chemin)).toEqual(expect.arrayContaining([
      '/matchs/', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/', '/regarder-le-match/paris/', '/bar/le-zinc-des-amis-paris-11/',
    ]));
    const vocabulaire = chargerLeVocabulaire();
    for (const p of site.pages) expect(validerLaPage(vocabulaire, p.contenu), p.chemin).toEqual([]);
    expect(site.avertissements).toContain('Ville sans guide : Rennes (1 bar). Son guide s’écrit dans generateur/contenu/villes.json.');
  });

  test('une ville avec des bars : indexable, ses bars par arrondissement, ses soirées, sa FAQ balisée', () => {
    const paris = pageDe('/regarder-le-match/paris/');
    expect(paris.indexable).toBe(true);
    expect(robotsDe(paris)).toBe('max-image-preview:large');
    expect(paris.contenu).toContain('<h1 class="regarder-titre">Où regarder le match à Paris</h1>');
    for (const ancre of ['paris-10', 'paris-11']) expect(paris.contenu).toContain(`id="${ancre}"`);
    expect(paris.contenu).toContain('<a href="/bar/le-zinc-des-amis-paris-11/">Le Zinc des Amis</a>');
    expect(paris.contenu).toContain('<a href="/bar/le-zinc-des-amis-paris-11/#soiree-psg-ol-2026-10-25">Le Zinc des Amis</a>');
    const [liste] = deType(paris, 'ItemList');
    expect(liste.itemListElement.map((i) => i.url)).toEqual(['https://baromatch.fr/bar/le-comptoir-du-canal-paris-10/', 'https://baromatch.fr/bar/le-zinc-des-amis-paris-11/']);
    // La FAQ balisée répète mot pour mot les questions et réponses lisibles (villes.json), dans l’ordre.
    const [faq] = deType(paris, 'FAQPage');
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(contenu.villes.paris.faq.map((q) => [q.question, q.reponse]));
    for (const { question, reponse } of contenu.villes.paris.faq) {
      expect(paris.contenu).toContain(`<summary>${echapper(question)}</summary>`);
      expect(paris.contenu).toContain(`<p>${echapper(reponse)}</p>`);
    }
    // Le guide écrit est là, tel quel.
    for (const paragraphe of contenu.villes.paris.guide) expect(paris.contenu).toContain(echapper(paragraphe));
    // Une ville sans guide (Rennes) a sa page, faite de ses vraies données.
    const rennes = pageDe('/regarder-le-match/rennes/');
    expect(rennes.indexable).toBe(true);
    expect(rennes.contenu).toContain('1 bar de Rennes diffuse le match sur Baromatch.');
  });

  test('une ville sans bar : noindex, et la page le dit', () => {
    for (const chemin of ['/regarder-le-match/marseille/', '/regarder-le-match/lille/']) {
      const p = pageDe(chemin);
      expect(p.indexable).toBe(false);
      expect(robotsDe(p)).toBe('noindex');
      expect(p.contenu).toMatch(/Aucun bar de (Marseille|Lille) n’est encore sur Baromatch\./);
      expect(deType(p, 'ItemList')).toEqual([]);
    }
  });

  test('un match sans vrai bar : noindex, et le lien « Tu tiens un bar ? » vers Pour les bars', () => {
    const p = pageDe('/matchs/lille-lens-2026-10-26/');
    expect(p.indexable).toBe(false);
    expect(robotsDe(p)).toBe('noindex');
    expect(p.contenu).toContain('Pas encore de bar pour ce match sur Baromatch.');
    expect(p.contenu).toContain('<a href="/pour-les-bars.html">Tu tiens un bar ?</a>');
    expect(p.contenu).not.toMatch(/démo|Lucette/i);
    expect(deType(p, 'Event')).toEqual([]);
  });

  test('un match avec des bars : ses soirées en Event, la même adresse que sur la page du bar', () => {
    const match = pageDe('/matchs/psg-ol-2026-10-25/');
    expect(match.indexable).toBe(true);
    expect(match.contenu).toContain('<h1 class="regarder-titre">PSG – OL : les bars qui diffusent le match</h1>');
    expect(match.contenu).toContain('<p class="regarder-affiche">Paris Saint-Germain – Olympique Lyonnais</p>');
    expect(match.contenu).toContain('<time datetime="2026-10-25T20:45:00+01:00">dimanche 25 octobre · 20:45</time>');
    expect(match.contenu).toContain('Les places qui restent sont dans l’appli.');
    const evenements = deType(match, 'Event');
    expect(evenements.map((ev) => ev.name)).toEqual(['PSG – OL à la Cave des Gones', 'PSG – OL au Zinc des Amis']);
    const zinc = evenements[1];
    expect(zinc).toMatchObject({
      startDate: '2026-10-25T20:45:00+01:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: ['https://baromatch.fr/img/og-image.jpg'],
      url: 'https://baromatch.fr/bar/le-zinc-des-amis-paris-11/#soiree-psg-ol-2026-10-25',
      location: { '@type': 'BarOrPub', name: 'Le Zinc des Amis', address: { streetAddress: '12 Rue Oberkampf', postalCode: '75011', addressLocality: 'Paris', addressCountry: 'FR' } },
      organizer: { '@type': 'BarOrPub', name: 'Le Zinc des Amis' },
      about: { '@type': 'SportsEvent', homeTeam: { '@type': 'SportsTeam', name: 'Paris Saint-Germain' }, awayTeam: { '@type': 'SportsTeam', name: 'Olympique Lyonnais' } },
    });
    // Le bar est le lieu de la diffusion, jamais celui du match ; pas d’offre tant que l’appli n’est pas ouverte.
    expect(zinc.about.location).toBeUndefined();
    expect(zinc.offers).toBeUndefined();
    // La même soirée, sur la page du bar : la même adresse, et l’ancre existe.
    const bar = pageDe('/bar/le-zinc-des-amis-paris-11/');
    expect(deType(bar, 'Event').map((ev) => ev.url)).toContain(zinc.url);
    expect(bar.contenu).toContain('id="soiree-psg-ol-2026-10-25"');
    // Avant le changement d’heure, le décalage d’été.
    expect(deType(pageDe('/matchs/psg-barca-2026-10-24/'), 'Event')[0].startDate).toBe('2026-10-24T21:00:00+02:00');
  });

  test('les offres : dans le corps seulement, avec la mention santé sauf sans alcool', () => {
    const MENTION = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
    for (const chemin of ['/matchs/psg-ol-2026-10-25/', '/bar/le-zinc-des-amis-paris-11/']) {
      const p = pageDe(chemin);
      const [tete, corps] = p.contenu.split('<body>');
      expect(corps).toMatch(new RegExp(`Pinte et planche à partager · 12 €</p>\\s*<p class="regarder-offre__sante">${MENTION}</p>`));
      expect(tete).not.toContain('Pinte');
    }
    const comptoir = pageDe('/bar/le-comptoir-du-canal-paris-10/');
    const soiree = comptoir.contenu.split('id="soiree-psg-barca-2026-10-24"')[1].split('</li>')[0];
    expect(soiree).toContain('Menu burger et boisson fraîche · 15 €');
    expect(soiree).not.toContain(MENTION);
    // Aucune offre dans une page de ville, un aperçu, un badge ou une donnée structurée ; l’offre au mot interdit, nulle part.
    for (const p of site.pages) {
      if (p.type === 'ville' || p.type === 'villes' || p.type === 'semaine') expect(p.contenu, p.chemin).not.toContain('regarder-offre');
      expect(JSON.stringify(donneesStructurees(p)), p.chemin).not.toMatch(/Pinte|burger/);
      expect(p.contenu, p.chemin).not.toMatch(/happy hour/i);
    }
  });

  test('aucun score, aucun nombre de places, aucune réservation promise tant que l’appli est fermée', () => {
    for (const p of site.pages) {
      expect(p.contenu, p.chemin).not.toMatch(/\bscores?\b|\b3 – 1\b|places? restantes?|Réserve ta place/i);
    }
  });

  test('l’appli ouverte : « Réserve ta place dans l’appli » vers le magasin, et la place gratuite dans chaque Event', async () => {
    const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
    const autre = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: ouverte });
    const p = autre.pages.find((x) => x.chemin === '/matchs/psg-ol-2026-10-25/');
    expect(p.contenu).toContain('<a class="capsule" href="https://magasin.exemple/baromatch-android">Réserve ta place dans l’appli · Android</a>');
    expect(p.contenu).not.toContain('préviens-moi');
    expect(deType(p, 'Event')[0].offers).toEqual({ '@type': 'Offer', price: 0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: 'https://magasin.exemple/baromatch-android' });
  });

  test('la semaine : le bloc du soir, les jours, le nombre de vrais bars de chaque match', () => {
    const p = pageDe('/matchs/');
    expect(p.indexable).toBe(true);
    const ceSoir = p.contenu.split('id="titre-ce-soir">')[1].split('</section>')[0];
    expect(ceSoir).toMatch(/^Ce soir, vendredi 23 octobre<\/h2>/);
    expect(ceSoir).toContain('<a href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a>');
    expect(ceSoir).toContain('1 bar à Lyon');
    expect(p.contenu).toContain('<h2 id="jour-2026-10-25">Dimanche 25 octobre</h2>');
    // Sous le titre du jour, la ligne ne répète pas la date : l’heure seule, la date complète dans datetime.
    expect(p.contenu).toMatch(/PSG – OL<\/a> · <time datetime="2026-10-25T20:45:00\+01:00">20:45<\/time> · Ligue 1 · <span class="regarder-compte">1 bar à Lyon, 1 bar à Paris<\/span>/);
    expect(p.contenu).toMatch(/Lille – Lens<\/a>[^\n]*Pas encore de bar/);
    // Sept jours : le jeudi 29 en est le dernier, le vendredi 30 n’y est pas.
    expect(p.contenu).not.toContain('jour-2026-10-30');
  });

  test('un bar sans soirée annoncée reste indexable et le dit', () => {
    const p = pageDe('/bar/au-bon-coin-lyon-2/');
    expect(p.indexable).toBe(true);
    expect(p.contenu).toContain('Pas de soirée annoncée pour l’instant.');
    expect(deType(p, 'Event')).toEqual([]);
    expect(deType(p, 'BarOrPub')[0]).toMatchObject({ name: 'Au Bon Coin', address: { postalCode: '69002' } });
  });

  test('chaque page : un fil d’Ariane balisé, rattaché à l’organisation de l’accueil par son @id', () => {
    for (const p of site.pages) {
      const [fil] = deType(p, 'BreadcrumbList');
      expect(fil.itemListElement[0], p.chemin).toMatchObject({ position: 1, name: 'Accueil', item: 'https://baromatch.fr/' });
      expect(fil.itemListElement.at(-1).item, p.chemin).toBe(`https://baromatch.fr${p.chemin}`);
      const principal = donneesStructurees(p)[0];
      expect(principal.publisher, p.chemin).toEqual({ '@id': 'https://baromatch.fr/#organisation' });
      expect(principal.url, p.chemin).toBe(`https://baromatch.fr${p.chemin}`);
    }
  });

  test('la copie enregistrée de ce soir : zéro vrai bar, donc chaque page en noindex', async () => {
    const capture = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: ENREGISTREMENT, racine });
    expect(capture.pages.filter((p) => p.indexable).map((p) => p.chemin)).toEqual([]);
    expect(capture.pages.filter((p) => p.type === 'bar')).toEqual([]);
    expect(capture.pages.every((p) => robotsDe(p) === 'noindex')).toBe(true);
    for (const p of capture.pages) expect(p.contenu, p.chemin).not.toMatch(/démo|Rivoli/i);
  });
});

test.describe('le validateur et le contrôle refusent ce qui est faux', () => {
  const vocabulaire = chargerLeVocabulaire();
  const bloc = (...graphe) => ({ '@context': 'https://schema.org', '@graph': graphe });
  const evenement = {
    '@type': 'Event', name: 'PSG – OL au Zinc', startDate: '2026-10-25T20:45:00+01:00', image: ['https://baromatch.fr/img/og-image.jpg'],
    location: { '@type': 'BarOrPub', name: 'Le Zinc', address: { '@type': 'PostalAddress', streetAddress: '12 Rue Oberkampf', postalCode: '75011', addressLocality: 'Paris', addressCountry: 'FR' } },
  };

  test('schema.org : type, propriété, place de la propriété, type de valeur, énumération', () => {
    expect(validerUnBloc(vocabulaire, bloc(evenement))).toEqual([]);
    expect(vocabulaire.version).toBe('30.1');
    const erreurs = (noeud) => validerUnBloc(vocabulaire, bloc(noeud)).join('\n');
    expect(erreurs({ ...evenement, '@type': 'Evenement' })).toMatch(/le type « Evenement » n’existe pas/);
    expect(erreurs({ ...evenement, lieu: 'Paris' })).toMatch(/la propriété « lieu » n’existe pas/);
    expect(erreurs({ ...evenement, homeTeam: { '@type': 'SportsTeam', name: 'PSG' } })).toMatch(/« homeTeam » ne va pas sur Event/);
    expect(erreurs({ ...evenement, eventStatus: 'https://schema.org/InStock' })).toMatch(/n’est pas une valeur de EventStatusType/);
    expect(erreurs({ ...evenement, eventStatus: 'Prévu' })).toMatch(/n’est pas une valeur de EventStatusType/);
    expect(erreurs({ ...evenement, location: { ...evenement.location, '@type': 'SportsTeam' } })).toMatch(/un SportsTeam là où schema.org attend/);
    expect(erreurs({ ...evenement, startDate: 'dimanche' })).toMatch(/n’est pas une date ISO 8601/);
    expect(validerUnBloc(vocabulaire, { '@graph': [evenement] }).join()).toMatch(/@context/);
  });

  test('Google : ce qu’exige un Event et un fil d’Ariane ; rien de Google pour une FAQ', () => {
    const erreurs = (...graphe) => validerUnBloc(vocabulaire, bloc(...graphe)).join('\n');
    expect(erreurs({ ...evenement, image: undefined })).toMatch(/sans image/);
    expect(erreurs({ ...evenement, location: { '@type': 'BarOrPub', name: 'Le Zinc' } })).toMatch(/sans address PostalAddress/);
    expect(erreurs({ ...evenement, location: { ...evenement.location, address: { '@type': 'PostalAddress', streetAddress: '12 Rue Oberkampf' } } })).toMatch(/postalCode manque/);
    expect(erreurs({ ...evenement, startDate: undefined })).toMatch(/sans startDate/);
    const fil = (elements) => ({ '@type': 'BreadcrumbList', itemListElement: elements.map((x) => ({ '@type': 'ListItem', ...x })) });
    expect(erreurs(fil([{ position: 1, name: 'Accueil', item: 'https://baromatch.fr/' }, { position: 2, name: 'Paris' }]))).toBe('');
    expect(erreurs(fil([{ position: 1, name: 'Accueil' }, { position: 2, name: 'Paris' }]))).toMatch(/item manque/);
    expect(erreurs(fil([{ position: 2, name: 'Accueil', item: 'https://baromatch.fr/' }, { position: 3, name: 'Paris' }]))).toMatch(/position 2, 1 attendu/);
    // Une question sans réponse n’est pas une erreur de schema.org, et aucune règle de Google n’est appliquée à une FAQ.
    expect(erreurs({ '@type': 'FAQPage', name: 'FAQ', mainEntity: [{ '@type': 'Question', name: 'Une question ?' }] })).toBe('');
  });

  test('le contrôle des pages : titre, description, h1, noindex, « ! » et mots interdits', async () => {
    const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine });
    const p = site.pages.find((x) => x.chemin === '/regarder-le-match/paris/');
    expect(controlerLaPage(p)).toEqual([]);
    const avec = (remplacer) => controlerLaPage({ ...p, contenu: remplacer(p.contenu) }).join('\n');
    expect(avec((h) => h.replace(/<title>[^<]*/, '<title>Paris'))).toMatch(/titre de 5 caractères/);
    expect(avec((h) => h.replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="Trop court"'))).toMatch(/description de 10 caractères/);
    expect(avec((h) => h.replace('</main>', '<h1>Encore</h1></main>'))).toMatch(/2 h1/);
    expect(avec((h) => h.replace('max-image-preview:large', 'noindex'))).toMatch(/robots « noindex » pour une page indexable/);
    expect(avec((h) => h.replace('</main>', '<p>Venez nombreux !</p></main>'))).toMatch(/point d’exclamation/);
    expect(avec((h) => h.replace('</main>', '<p>Happy hour à 19 h.</p></main>'))).toMatch(/mot que le site ne publie pas/);
    expect(avec((h) => h.replace('</main>', '<p>Le score final.</p></main>'))).toMatch(/mot que le site ne publie pas/);
    expect(avec((h) => h.replace('</body>', '<script src="/x.js"></script></body>'))).toMatch(/un script autre/);
    // Le nom d’un bar est le sien : « Chez Max ! » ne refuse pas la page.
    expect(controlerLaPage({ ...p, contenu: p.contenu.replace('</main>', '<p>Chez Max !</p></main>') }, { motsDesBars: ['Chez Max !'] })).toEqual([]);
  });
});

// ---------- L’état, les pages passées, le plan du site, le badge, la liste blanche ----------

test.describe('d’un passage à l’autre', () => {
  const dossiers = [];
  const dossierVide = () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'pages-des-matchs-'));
    dossiers.push(dossier);
    return dossier;
  };
  test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });
  const lire = (dossier, relatif) => readFileSync(path.join(dossier, relatif), 'utf8');
  const etatDe = (dossier) => JSON.parse(lire(dossier, 'regarder-le-match/etat.json'));
  const plan = (dossier) => lire(dossier, 'sitemap.xml');
  const passer = (sortie, maintenant, options = {}) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, ...options });
  const scenarioSans = (dossier, retirer) => {
    const brut = JSON.parse(readFileSync(SCENARIO, 'utf8'));
    const fichier = path.join(dossier, 'scenario-modifie.json');
    writeFileSync(fichier, JSON.stringify(retirer(brut)));
    return `scenario:${fichier}`;
  };

  test('un match passé : la page reste, en noindex, hors du plan du site, vers le prochain match ; puis disparaît', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    const avant = etatDe(sortie).pages['/matchs/om-lens-2026-10-22/'];
    expect(avant).toMatchObject({ type: 'match', cle: 'om-lens-2026-10-22', date: '2026-10-22T18:45:00.000Z', change: '2026-10-21', indexable: true });
    expect(avant.empreinte).toMatch(/^[\w-]{22}$/);
    expect(plan(sortie)).toContain('<loc>https://baromatch.fr/matchs/om-lens-2026-10-22/</loc><lastmod>2026-10-21</lastmod>');

    const resultat = await passer(sortie, '2026-10-23T08:00:00Z');
    const page = lire(sortie, 'matchs/om-lens-2026-10-22/index.html');
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(page).toContain('<h2 id="titre-passe">Ce match est passé</h2>');
    expect(page).toContain('Le prochain match de Lens : <a href="/matchs/lille-lens-2026-10-26/">Lille – Lens</a>');
    expect(page).not.toMatch(/regarder-carte|Zinc/);
    expect(plan(sortie)).not.toContain('om-lens');
    const apres = etatDe(sortie).pages['/matchs/om-lens-2026-10-22/'];
    expect(apres).toMatchObject({ indexable: false, change: '2026-10-23' });
    // Une page qui n’a pas changé garde sa date ; le plan du site donne celle de son dernier vrai changement.
    expect(etatDe(sortie).pages['/matchs/psg-ol-2026-10-25/'].change).toBe('2026-10-21');
    expect(plan(sortie)).toContain('<loc>https://baromatch.fr/matchs/psg-ol-2026-10-25/</loc><lastmod>2026-10-21</lastmod>');
    expect(resultat.changees).not.toContain('https://baromatch.fr/matchs/psg-ol-2026-10-25/');
    expect(resultat.changees).toContain('https://baromatch.fr/matchs/');

    // Le même passage refait n’écrit rien.
    expect((await passer(sortie, '2026-10-23T08:00:00Z')).ecrits).toEqual([]);

    // 30 jours après son coup d’envoi, la page disparaît, et l’état l’oublie.
    await passer(sortie, '2026-11-22T08:00:00Z');
    expect(existsSync(path.join(sortie, 'matchs/om-lens-2026-10-22'))).toBe(false);
    expect(etatDe(sortie).pages['/matchs/om-lens-2026-10-22/']).toBeUndefined();
    expect(existsSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/index.html'))).toBe(true);
  });

  test('un bar qui n’est plus dans les données : noindex, vers sa ville, puis disparaît ; un bar exclu disparaît aussitôt', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    const sansZinc = scenarioSans(sortie, (brut) => ({ ...brut, bars: brut.bars.filter((b) => b.id !== 'b-zinc') }));
    await construire({ source: sansZinc, sortie, maintenant: Date.parse('2026-10-23T08:00:00Z'), racine });
    const page = lire(sortie, 'bar/le-zinc-des-amis-paris-11/index.html');
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(page).toContain('Ce bar n’est plus sur Baromatch.');
    expect(page).toContain('<a href="/regarder-le-match/paris/">Où regarder le match à Paris</a>');
    expect(plan(sortie)).not.toContain('le-zinc-des-amis');
    expect(etatDe(sortie).pages['/bar/le-zinc-des-amis-paris-11/'].memoire.disparu).toBe('2026-10-23T08:00:00.000Z');
    expect(lire(sortie, 'bar/le-zinc-des-amis-paris-11/badge.svg')).not.toContain('On diffuse');
    await construire({ source: sansZinc, sortie, maintenant: Date.parse('2026-11-23T08:00:00Z'), racine });
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11'))).toBe(false);

    // Un bar mis dans la liste d’exclusion ne garde pas sa page un seul passage.
    const autre = dossierVide();
    await passer(autre, '2026-10-21T08:00:00Z');
    await passer(autre, '2026-10-21T09:00:00Z', { contenu: { ...contenu, exclus: ['b-coin'] } });
    expect(existsSync(path.join(autre, 'bar/au-bon-coin-lyon-2'))).toBe(false);
  });

  test('le plan du site : les pages fixes telles quelles, les pages générées indexables seulement', async () => {
    const sortie = dossierVide();
    const fixe = readFileSync(path.join(racine, 'sitemap.xml'), 'utf8').replace(/\r\n/g, '\n')
      .replace('</urlset>', '  <url><loc>https://baromatch.fr/presse.html</loc><lastmod>2026-10-14</lastmod></url>\n  <url><loc>https://baromatch.fr/matchs/vieux-match-2026-01-01/</loc><lastmod>2026-01-01</lastmod></url>\n</urlset>');
    writeFileSync(path.join(sortie, 'sitemap.xml'), fixe);
    await passer(sortie, '2026-10-23T08:00:00Z');
    const xml = plan(sortie);
    const lignes = (texte) => texte.split('\n').filter((l) => l.includes('<url>'));
    const fixes = lignes(fixe).filter((l) => !l.includes('/matchs/'));
    expect(lignes(xml).slice(0, fixes.length)).toEqual(fixes);
    expect(xml).not.toContain('vieux-match');
    const etat = etatDe(sortie);
    const generees = lignes(xml).slice(fixes.length).map((l) => l.match(/<loc>https:\/\/baromatch\.fr([^<]*)<\/loc>/)[1]);
    expect(generees).toEqual(Object.keys(etat.pages).filter((c) => etat.pages[c].indexable && c.endsWith('/')));
    for (const chemin of ['/regarder-le-match/marseille/', '/matchs/lille-lens-2026-10-26/', '/matchs/ol-angers-2026-10-31/']) expect(generees).not.toContain(chemin);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
  });

  test('la liste blanche : rien d’autre que matchs/, regarder-le-match/, bar/ et sitemap.xml n’est touché', async () => {
    const sortie = dossierVide();
    // Un dossier qui ressemble au site : des fichiers que le générateur n’a pas le droit de toucher.
    const temoins = { 'index.html': 'accueil', 'marque.json': '{}', 'robots.txt': 'robots', 'bar.html': 'bar', 'matchs.txt': 'm', 'regarder.css': 'css' };
    for (const [nom, texte] of Object.entries(temoins)) writeFileSync(path.join(sortie, nom), texte);
    const avant = new Set(readdirSync(sortie));
    await passer(sortie, '2026-10-23T08:00:00Z');
    for (const [nom, texte] of Object.entries(temoins)) expect(lire(sortie, nom), nom).toBe(texte);
    const fichiers = (dossier, prefixe = '') => readdirSync(path.join(sortie, dossier)).flatMap((nom) => {
      const relatif = path.posix.join(dossier, nom);
      return statSync(path.join(sortie, relatif)).isDirectory() ? fichiers(relatif) : [relatif];
    });
    const crees = [...readdirSync(sortie)].filter((nom) => !avant.has(nom));
    expect(crees.sort()).toEqual(['bar', 'matchs', 'regarder-le-match', 'sitemap.xml']);
    const tous = ['bar', 'matchs', 'regarder-le-match'].flatMap((d) => fichiers(d));
    expect(tous.filter((relatif) => !estPermis(relatif))).toEqual([]);
    for (const refuse of ['index.html', 'marque.json', 'robots.txt', 'tests/x.html', 'matchs/../index.html', 'bar/x/script.js', 'generateur/construire.mjs']) {
      expect(estPermis(refuse), refuse).toBe(false);
      expect(() => ecrireUnFichier(sortie, refuse, 'x'), refuse).toThrow(/Chemin refusé/);
    }
    for (const permis of ['sitemap.xml', 'regarder-le-match/etat.json', 'matchs/index.html', 'bar/le-zinc-des-amis-paris-11/badge.svg']) expect(estPermis(permis), permis).toBe(true);
    // Le générateur lui-même n’écrit qu’en passant par cette liste.
    const source = readFileSync(path.join(racine, 'generateur', 'construire.mjs'), 'utf8') + readFileSync(path.join(racine, 'generateur', 'etat.mjs'), 'utf8');
    expect(source.match(/writeFileSync\(/g)).toHaveLength(2);
    expect(source).toContain('if (typeof options.changees === \'string\') writeFileSync(options.changees');
  });

  test('la prudence : un passage qui ferait disparaître plus de la moitié des pages n’écrit rien', async () => {
    // Les données manquantes ne vident pas le site : un match ou un bar absent garde sa page 30 jours (plus haut).
    // Mais un passage qui supprimerait d’un coup plus de la moitié des pages publiées (ici, après une longue pause,
    // vingt pages de matchs de septembre arrivées au bout de leurs 30 jours) s’arrête et le dit.
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const etat = etatDe(sortie);
    for (let i = 1; i <= 30; i += 1) {
      const slug = `vieux-match-${i}-2026-09-01`;
      etat.pages[`/matchs/${slug}/`] = { type: 'match', cle: slug, date: '2026-09-01T18:00:00.000Z', empreinte: 'x', change: '2026-09-01', indexable: false,
        memoire: { slug, ids: [slug], debut: '2026-09-01T18:00:00.000Z', heureConfirmee: true, competition: 'Ligue 1', domicile: { cle: 'a', court: 'A', nom: 'A' }, exterieur: { cle: 'b', court: 'B', nom: 'B' } } };
    }
    writeFileSync(path.join(sortie, 'regarder-le-match/etat.json'), JSON.stringify(etat));
    const etatAvant = lire(sortie, 'regarder-le-match/etat.json');
    await expect(passer(sortie, '2026-10-23T09:00:00Z')).rejects.toThrow(/supprimerait 30 des 50 pages publiées : rien n’est écrit/);
    expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(etatAvant);
    // Voulu : relancé en le disant, le passage les supprime.
    await passer(sortie, '2026-10-23T09:00:00Z', { accepterLesSuppressions: true });
    expect(Object.keys(etatDe(sortie).pages).filter((c) => c.includes('vieux-match'))).toEqual([]);
    // Des données illisibles n’écrivent rien non plus.
    const etatJuste = lire(sortie, 'regarder-le-match/etat.json');
    await expect(construire({ source: 'api', adresse: 'http://127.0.0.1:9', sortie, maintenant: Date.parse('2026-10-23T10:00:00Z'), racine })).rejects.toThrow(/Données illisibles/);
    expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(etatJuste);
  });

  test('le badge vivant : la prochaine soirée, ou « On diffuse le match », jamais « Réserve ta place » tant que l’appli est fermée', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const badge = (slug) => lire(sortie, `bar/${slug}/badge.svg`);
    const texte = (svg) => [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    expect(texte(badge('la-cave-des-gones-lyon-2'))).toEqual(['Ce soir ici · 20:45', 'Brest – Nice · sur Baromatch']);
    expect(texte(badge('le-zinc-des-amis-paris-11'))).toEqual(['Samedi 24 octobre ici · 21:00', 'PSG – Barça · sur Baromatch']);
    expect(texte(badge('au-bon-coin-lyon-2'))).toEqual(['On diffuse le match', 'sur Baromatch']);
    const svg = badge('le-zinc-des-amis-paris-11');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="360" height="72" viewBox="0 0 360 72" role="img" aria-labelledby="titre-badge">/);
    expect(svg).toContain('<title id="titre-badge">Le Zinc des Amis sur Baromatch : samedi 24 octobre ici · 21:00, PSG – Barça</title>');
    expect(svg).toContain('<rect x="0.5" y="0.5" width="359" height="71" rx="35.5" fill="#0A0B10" stroke="#FFFFFF" stroke-opacity="0.14"/>');
    expect(svg).toContain('fill="#F7F7F9"');
    expect(svg).toContain('<tspan fill="#FFB13D">sur Baromatch</tspan>');
    expect(svg).toContain('font-family="\'Bricolage Grotesque\', system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif"');
    expect(svg).toContain('stop-color="#FFB13D"');
    for (const slug of ['la-cave-des-gones-lyon-2', 'le-zinc-des-amis-paris-11', 'au-bon-coin-lyon-2']) {
      expect(badge(slug)).not.toMatch(/Réserve|Pinte|offre|<script|href=/i);
    }
    // L’appli ouverte : la dernière ligne devient « Réserve ta place sur Baromatch ».
    const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
    await passer(sortie, '2026-10-23T08:00:00Z', { contenu: ouverte });
    expect(texte(badge('la-cave-des-gones-lyon-2'))).toEqual(['Ce soir ici · 20:45 · Brest – Nice', 'Réserve ta place sur Baromatch']);
    expect(texte(badge('au-bon-coin-lyon-2'))).toEqual(['On diffuse le match', 'Réserve ta place sur Baromatch']);

    // Le code à coller : le badge et un lien vers la page du bar, au nom du bar, sans paramètre de suivi.
    const page = lire(sortie, 'bar/au-bon-coin-lyon-2/index.html');
    const code = page.match(/<textarea[^>]*readonly[^>]*>([^<]*)<\/textarea>/)[1];
    expect(code).toBe(echapper('<a href="https://baromatch.fr/bar/au-bon-coin-lyon-2/" title="Au Bon Coin sur Baromatch"><img src="https://baromatch.fr/bar/au-bon-coin-lyon-2/badge.svg" width="360" height="72" alt="Au Bon Coin sur Baromatch"></a>'));
    expect(page).toContain('<summary>Tu tiens ce bar ? Ton badge</summary>');
  });

  test('la copie enregistrée de ce soir, écrite : tout en noindex, le plan du site inchangé', async () => {
    const sortie = dossierVide();
    const resultat = await construire({ source: `capture:${CAPTURE}`, sortie, maintenant: ENREGISTREMENT, racine });
    expect(resultat.changees).toEqual([]);
    expect(Object.values(etatDe(sortie).pages).filter((p) => p.indexable)).toEqual([]);
    expect(plan(sortie)).toBe(readFileSync(path.join(racine, 'sitemap.xml'), 'utf8').replace(/\r\n/g, '\n'));
    expect(existsSync(path.join(sortie, 'bar'))).toBe(false);
  });
});

// ---------- L’Action et IndexNow ----------

test.describe('l’Action « Pages des matchs » et IndexNow', () => {
  const action = readFileSync(path.join(racine, '.github', 'workflows', 'pages-des-matchs.yml'), 'utf8').replace(/\r\n/g, '\n');

  test('l’Action : quand elle tourne, ce qu’elle peut, et qu’elle ne fait qu’un passage à la fois', () => {
    expect(action).toContain("    - cron: '17 */3 * * *'");
    expect(action).toMatch(/\n  workflow_dispatch:\n/);
    expect(action).toMatch(/\n  push:\n    branches: \[main\]\n    paths:\n      - 'generateur\/\*\*'\n      - 'marque\.json'\n/);
    // Le droit d’écrire le dépôt et de demander la publication de Pages, rien d’autre.
    expect(action).toMatch(/\npermissions:\n  contents: write\n  pages: write\n\n/);
    expect(action).toMatch(/\nconcurrency:\n  group: pages-des-matchs\n  cancel-in-progress: false\n/);
    // Des actions à leur étiquette de version (vérifiées le 16 octobre 2026), Node 22, rien à installer.
    expect([...action.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1])).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
    expect(action).toContain('node-version: 22');
    expect(action).not.toMatch(/npm (ci|install)/);
    // Le générateur contre les listes publiques ; seuls les chemins de la liste blanche sont enregistrés.
    expect(action).toContain('node generateur/construire.mjs --source=api --changees="$RUNNER_TEMP/changees.txt" $option');
    expect(action).toContain('for chemin in matchs regarder-le-match bar sitemap.xml; do');
    expect(action).toContain("grep -vqE '^(matchs|regarder-le-match|bar)/|^sitemap\\.xml$'");
    expect(action).toContain('git pull -q --rebase origin main');
    // La publication demandée après l’envoi ; IndexNow n’arrête jamais l’Action.
    expect(action).toMatch(/node generateur\/publier\.mjs pages\n/);
    expect(action).toMatch(/continue-on-error: true\n        run: node generateur\/publier\.mjs indexnow "\$RUNNER_TEMP\/changees\.txt"\n/);
  });

  test('IndexNow : la clé servie à la racine, seulement les adresses du site, une erreur qui n’arrête rien', async () => {
    const reglages = reglagesIndexNow();
    expect(reglages.cle).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    expect(readFileSync(path.join(racine, `${reglages.cle}.txt`), 'utf8')).toBe(reglages.cle);
    const corps = requeteIndexNow(['https://baromatch.fr/matchs/', 'https://baromatch.fr/matchs/', 'https://ailleurs.fr/x'], reglages);
    expect(corps).toEqual({ host: 'baromatch.fr', key: reglages.cle, keyLocation: `https://baromatch.fr/${reglages.cle}.txt`, urlList: ['https://baromatch.fr/matchs/'] });

    const journal = [];
    const noter = (ligne) => journal.push(ligne);
    expect(await prevenirIndexNow([], { reglages, journal: noter })).toBe('rien');
    const envoyes = [];
    const recu = async (adresse, options) => { envoyes.push([adresse, JSON.parse(options.body)]); return { ok: true, status: 202 }; };
    expect(await prevenirIndexNow(['https://baromatch.fr/matchs/'], { reglages, envoyer: recu, journal: noter })).toBe('envoye');
    expect(envoyes).toEqual([['https://api.indexnow.org/indexnow', corps]]);
    const panne = async () => { throw new Error('réseau coupé'); };
    expect(await prevenirIndexNow(['https://baromatch.fr/matchs/'], { reglages, envoyer: panne, journal: noter })).toBe('erreur');
    expect(await prevenirIndexNow(['https://baromatch.fr/matchs/'], { reglages, envoyer: async () => ({ ok: false, status: 403 }), journal: noter })).toBe('refuse');
    expect(journal.at(-1)).toBe('IndexNow : 1 adresses envoyées, réponse 403.');
  });
});
