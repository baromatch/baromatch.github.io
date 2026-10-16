// Le générateur des pages « Où regarder le match », sans navigateur : les données (vrais bars, doublons, heure de
// Paris, villes), les pages qu’il écrit (indexation, plan du site, données structurées, badge) et les seuls chemins
// qu’il a le droit de toucher. Le scénario inventé (tests/donnees/scenario.json) se lit à l’heure du vendredi
// 23 octobre 2026 ; la copie réduite des listes publiques (tests/donnees/capture) à celle de son enregistrement.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(Object.fromEntries(donnees.ecartes.map((e) => [e.nom, e.raison]))).toEqual({
      'Bar de démo Baromatch': 'démo, test ou QA dans le nom ou l’adresse',
      'Bar DÉMO Lille': 'démo, test ou QA dans le nom ou l’adresse',
      'Chez Lucette': 'bar de démonstration',
      'Le Rideau Baissé': 'bar inactif',
    });
    // Aucune soirée d’un faux bar : le match de Lille, diffusé seulement par deux bars de démo, n’a pas de bar.
    expect(donnees.soirees.map((s) => s.bar.nom).filter((nom) => /démo|lucette|rideau/i.test(nom))).toEqual([]);
    expect(donnees.matchs.find((m) => m.slug === 'lille-lens-2026-10-26').soirees).toEqual([]);

    // Insensible aux accents et aux capitales ; la liste d’exclusion, par identifiant ou adresse de page ; isDemo,
    // qui n’existe pas encore dans les données, est déjà lu.
    const vide = new Set();
    expect(raisonDEcarter({ name: 'Le Comptoir', address: '1 rue des Tèsts, 75001 Paris' }, vide)).toBe('démo, test ou QA dans le nom ou l’adresse');
    expect(raisonDEcarter({ name: 'Bar Qa', address: '1 rue de Paris, 75001 Paris' }, vide)).not.toBeNull();
    expect(raisonDEcarter({ name: 'Le Quai', address: '1 quai de la Gare, 75013 Paris' }, vide)).toBeNull();
    expect(raisonDEcarter({ name: 'Le Contest', address: '1 rue de la Testerie, 75013 Paris' }, vide)).toBeNull();
    expect(raisonDEcarter({ id: 'b-1', name: 'Le Quai', address: '1 quai, 75013 Paris' }, new Set(['b-1']))).toBe('liste d’exclusion');
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
    expect(p.contenu).toContain('Aucun bar ne diffuse encore ce match sur Baromatch.');
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
      expect(corps).toMatch(new RegExp(`Pinte et planche à partager · 12 €</p>\\s*<p class="regarder-offre__sante">${MENTION}</p>`));
      expect(tete).not.toContain('Pinte');
    }
    const comptoir = pageDe('/bar/le-comptoir-du-canal-paris-10/');
    const soiree = comptoir.contenu.split('id="soiree-psg-barca-2026-10-24"')[1].split('</li>')[0];
    expect(soiree).toContain('Menu burger et boisson fraîche · 15 €');
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
    expect(p.contenu).toMatch(/PSG – OL<\/a> · <time[^>]*>dimanche 25 octobre · 20:45<\/time> · Ligue 1 · <span class="regarder-compte">1 bar à Lyon, 1 bar à Paris<\/span>/);
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
