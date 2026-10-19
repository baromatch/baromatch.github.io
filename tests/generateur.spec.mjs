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
import { contenuDuScenario, PUBLIES_DU_SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { lireLaSource } from '../generateur/sources.mjs';
import { arrondissementDe, clubDe, indexerLesClubs, lireLAdresse, nomInterdit, offreInterdite, preparer, raisonDEcarter, villeDe } from '../generateur/donnees.mjs';
import { motDAlcool } from '../generateur/alcool.mjs';
import { isoDeParis, jourDeParis, quandEnLettres } from '../generateur/heure.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { SEUILS } from '../generateur/pages.mjs';
import { blocsDe, chargerLeVocabulaire, validerLaPage, validerUnBloc } from '../generateur/validateur.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { insecables, offre as offreAffichee } from '../generateur/gabarits.mjs';
import { echapper } from '../generateur/texte.mjs';
import { auBar } from '../generateur/jsonld.mjs';
import { construire, verifierLesListes } from '../generateur/construire.mjs';
import { ecrireUnFichier, estPermis } from '../generateur/etat.mjs';
import { anonymiser, reduire } from '../generateur/outils/reduire-capture.mjs';
import { prevenirIndexNow, publierLesPages, reglagesIndexNow, requeteIndexNow } from '../generateur/publier.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');
const ENREGISTREMENT = Date.parse('2026-10-15T19:44:29Z');
// Le contenu du dépôt, et les bars du scénario dans la liste des bars publiés (vide dans le dépôt aujourd’hui).
const contenu = contenuDuScenario();

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
    expect(raisonDEcarter({ id: 'bar-arrivee-qa-exemple', name: 'Le Comptoir', address: rue }, vide)).toBe(essai);
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
    const exclu = preparer(await lireLaSource(`scenario:${SCENARIO}`), { maintenant: VENDREDI, ...contenu, exclus: ['b-zinc'] });
    expect(exclu.bars.map((b) => b.nom)).not.toContain('Le Zinc des Amis');
    // La liste d’exclusion ne lit qu’un identifiant : jamais un nom ni une adresse de page dans un fichier public.
    const parAdresse = preparer(await lireLaSource(`scenario:${SCENARIO}`), { maintenant: VENDREDI, ...contenu, exclus: ['le-zinc-des-amis-paris-11'] });
    expect(parAdresse.bars.map((b) => b.nom)).toContain('Le Zinc des Amis');
    expect(fichierExclus._lisezMoi).toContain('identifiant');
  });

  test('un bar n’est publié qu’avec son accord écrit (bars-publies.json), et son nom passe le filtre', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    // La liste du dépôt, vide aujourd’hui : aucun vrai bar n’apparaît, chacun attend son accord, le journal ne dit que
    // son identifiant.
    const fichier = JSON.parse(readFileSync(path.join(racine, 'generateur', 'bars-publies.json'), 'utf8'));
    expect(fichier.bars).toEqual([]);
    expect(fichier._lisezMoi).toMatch(/accord écrit/);
    expect(fichier._lisezMoi).toContain('Claude');
    const sansAccord = preparer(brut, { maintenant: VENDREDI, ...chargerLeContenu(racine) });
    expect(sansAccord.bars).toEqual([]);
    expect(sansAccord.soirees).toEqual([]);
    expect(sansAccord.avertissements).toContain('Bar b-zinc écarté : pas dans la liste des bars publiés (generateur/bars-publies.json) : il attend son accord écrit');
    expect(sansAccord.avertissements.join('\n')).not.toContain('Zinc des Amis');
    const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: chargerLeContenu(racine) });
    expect(site.pages.filter((p) => p.type === 'bar')).toEqual([]);
    for (const p of site.pages) expect(p.contenu, p.chemin).not.toMatch(/Zinc|Comptoir du Canal|Cave des Gones|Bon Coin|Café des Sports|BarOrPub|regarder-compte"><a/);
    // Un bar de démo ou d’essai reste écarté, même dans la liste.
    expect(PUBLIES_DU_SCENARIO).toEqual(expect.arrayContaining(['b-demo', 'b-x7']));
    const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu });
    expect(donnees.bars.map((b) => b.id)).not.toContain('b-demo');
    expect(donnees.bars.map((b) => b.id)).not.toContain('b-x7');

    // Le nom passe le même filtre que les offres (loi Evin), sans accents ni capitales ; les caractères de contrôle et
    // invisibles sont retirés du nom, de l’adresse et de l’offre avant tout usage ; une ville sans clé écarte le bar.
    const ajout = (id, name, address = '40 Rue de Lappe, 75011 Paris') => ({ id, name, address, isActive: true });
    brut.bars.push(ajout('b-hh', 'Le HAPPY Hour Café'), ajout('b-ob', 'L’Open-Bar du Canal'), ajout('b-tour', 'La Tournée des Grands Ducs'),
      ajout('b-vol', 'Bières à Volonté'), ajout('b-off', 'La Pinte offerte'), ajout('b-cache', 'Le Ha\u200Bppy Hour'),
      ajout('b-ctl', 'Le\u0007 Petit\u202E Zinc\u200D', '41 Rue\nde Lappe,\u0000 75011 Paris'), ajout('b-vide', 'Le Bar du Bout', '1 Rue X, 97411 ***'),
      ajout('b-ok', 'Le Score Bar'));
    brut.matchNights.push({ id: 'n-ctl', status: 'OPEN', bar: { id: 'b-ctl' }, match: { id: 'm-psg-ol' }, offer: { title: 'Planche\u0008 à partager\u200B', priceCents: null, until: null, hasAlcohol: false } });
    const publies = [...PUBLIES_DU_SCENARIO, 'b-hh', 'b-ob', 'b-tour', 'b-vol', 'b-off', 'b-cache', 'b-ctl', 'b-vide', 'b-ok'];
    const filtre = preparer(brut, { maintenant: VENDREDI, ...contenu, publies });
    const raisonDe = (id) => filtre.ecartes.find((x) => x.id === id)?.raison;
    for (const id of ['b-hh', 'b-ob', 'b-tour', 'b-vol', 'b-off', 'b-cache']) expect(raisonDe(id), id).toMatch(/^un mot que le site ne publie pas dans le nom/);
    expect(filtre.avertissements).toContain('Bar b-hh écarté : un mot que le site ne publie pas dans le nom (« happy hour »)');
    expect(raisonDe('b-vide')).toBe('ville illisible dans l’adresse');
    expect(filtre.avertissements).toContain('Bar b-vide écarté : ville illisible dans l’adresse');
    expect(filtre.bars.find((b) => b.id === 'b-ok')).toBeTruthy();
    const propre = filtre.bars.find((b) => b.id === 'b-ctl');
    expect(propre).toMatchObject({ nom: 'Le Petit Zinc', adresse: '41 Rue de Lappe, 75011 Paris', slug: 'le-petit-zinc-paris-11' });
    expect(propre.soirees[0].offre.titre).toBe('Planche à partager');
  });

  test('la copie enregistrée de ce soir : zéro vrai bar (le seul bar est celui de démo)', async () => {
    const donnees = await donneesDu(`capture:${CAPTURE}`, ENREGISTREMENT);
    expect(donnees.bars).toEqual([]);
    expect(donnees.soirees).toEqual([]);
    expect(donnees.ecartes.map((e) => e.nom)).toEqual(['Bar de démo']);
    // 79 matchs reçus, dont un en double (Ligue des champions et UEFA Champions League) : 78.
    expect(donnees.matchs).toHaveLength(78);
  });
  test('la copie publique des listes : aucun identifiant de l’appli, le bar de démo factice, aucun vrai bar', async () => {
    const brut = await lireLaSource(`capture:${CAPTURE}`);
    const ids = [...brut.matches.map((m) => m.id), ...brut.bars.map((b) => b.id), ...brut.matchNights.flatMap((n) => [n.id, n.bar.id, n.match.id])];
    expect(ids.filter((id) => !/^(?:match|soiree|bar)-\d{3}$/.test(id))).toEqual([]);
    expect(brut.bars).toEqual([{ id: 'bar-001', name: 'Bar de démo', address: 'Site de démo - 1 rue de l’Exemple, 75001 Paris', isActive: true, features: null }]);
    // Rendue factice une seconde fois, elle ne change pas ; un vrai bar n’y entre jamais.
    expect(anonymiser(reduire(brut))).toEqual(brut);
    expect(() => anonymiser({ ...brut, bars: [{ id: 'b-1', name: 'Le Zinc des Amis', address: '12 Rue Oberkampf, 75011 Paris' }] })).toThrow(/vrais bars/);
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
    expect(lireLAdresse('Site QA - 1 rue de l’Exemple, 75001 Paris')).toEqual({ rue: 'Site QA - 1 rue de l’Exemple', codePostal: '75001', ville: 'Paris' });
    expect(lireLAdresse('3 Place Sainte-Anne 35000 Rennes, France')).toEqual({ rue: '3 Place Sainte-Anne', codePostal: '35000', ville: 'Rennes' });
    expect(lireLAdresse('Quelque part à Paris')).toBeNull();
    // Un vrai bar dont l’adresse est écrite autrement ne disparaît pas ; « Paris 11e » reste juste.
    const oberkampf = { rue: '12 Rue Oberkampf', codePostal: '75011', ville: 'Paris' };
    for (const ecrite of ['12 Rue Oberkampf, 75011, Paris', '12 Rue Oberkampf, Paris 75011', '12 Rue Oberkampf, 75011 Paris, FR', '12 Rue Oberkampf, 75011 Paris 11e']) {
      expect(lireLAdresse(ecrite), ecrite).toEqual(oberkampf);
    }
    expect(lireLAdresse('12 rue Oberkampf 75011 PARIS')).toEqual({ ...oberkampf, rue: '12 rue Oberkampf' });
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.bars.find((b) => b.id === 'b-zinc').address = '12 rue Oberkampf 75011 PARIS';
    const zinc = preparer(brut, { maintenant: VENDREDI, ...contenu }).bars.find((b) => b.id === 'b-zinc');
    expect([zinc.slug, zinc.quartier, zinc.adresse]).toEqual(['le-zinc-des-amis-paris-11', 'Paris 11e', '12 rue Oberkampf, 75011 Paris']);
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
    // Loi Evin : une offre avec alcool (ou sans hasAlcohol à false) ne se publie pas ; à sa place, « Une offre du bar
    // dans l’appli », sans titre ni prix. Seule une offre que le bar dit sans alcool se montre, avec son heure limite.
    expect(offre('Le Zinc des Amis', 'psg-ol-2026-10-25')).toEqual({ dansLAppli: true });
    expect(offre('Le Comptoir du Canal', 'psg-barca-2026-10-24')).toEqual({ titre: 'Menu burger et boisson fraîche', prixCentimes: 1500, jusqua: Date.parse('2026-10-24T18:00:00.000Z') });
    expect(offre('Le Comptoir du Canal', 'le-havre-psg-2026-10-30')).toEqual({ dansLAppli: true });
    const sansMot = await lireLaSource(`scenario:${SCENARIO}`);
    const burger = sansMot.matchNights.find((n) => n.id === 'n-comptoir-barca');
    for (const hasAlcohol of [undefined, null, 'false', 0, true]) {
      burger.offer = { ...burger.offer, hasAlcohol };
      expect(preparer(sansMot, { maintenant: VENDREDI, ...contenu }).soirees.find((s) => s.id === 'n-comptoir-barca').offre, String(hasAlcohol)).toEqual({ dansLAppli: true });
    }
    // Une offre dite sans alcool qui en nomme un ne se montre pas non plus : rien d’alcoolisé n’est jamais écrit, donc
    // jamais de mention santé à mettre dessous.
    burger.offer = { ...burger.offer, title: 'Planche et verre de vin', hasAlcohol: false, until: null };
    expect(preparer(sansMot, { maintenant: VENDREDI, ...contenu }).soirees.find((s) => s.id === 'n-comptoir-barca').offre).toEqual({ dansLAppli: true });
    expect(offreAffichee({ titre: 'Menu burger', prixCentimes: 1200, jusqua: null }, contenu.textes)).not.toContain('regarder-offre__sante');
    expect(donnees.avertissements).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« happy hour »), ce que le site ne publie pas']);
    // Loi Evin, sans accents ni capitales : la gratuité près d’une boisson, une quantité, une récompense ne
    // s’affichent pas ; le passage continue, avec un avertissement par offre écartée.
    const poussentABoire = ['Pinte offerte à chaque but du PSG', 'Tournee generale a la mi-temps', 'Shot offert', 'Deux bières pour le prix d’une',
      'Open bar pendant le match', 'Bières à volonté', '2 pour 1 sur les cocktails', 'HAPPY-HOUR', 'Une pinte achetée, une offerte', 'Boisson gratuite'];
    for (const titre of poussentABoire) expect(offreInterdite(titre), titre).not.toBeNull();
    for (const titre of ['Pinte et planche à partager', 'Menu burger et boisson fraîche']) expect(offreInterdite(titre), titre).toBeNull();
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const zinc = brut.matchNights.find((n) => n.id === 'n-zinc-psg-ol');
    zinc.offer = { ...zinc.offer, title: 'Shot offert' };
    const sansShot = preparer(brut, { maintenant: VENDREDI, ...contenu });
    expect(sansShot.soirees.find((s) => s.id === 'n-zinc-psg-ol').offre).toEqual({ dansLAppli: true });
    expect(sansShot.avertissements).toContain('Offre de « Le Zinc des Amis » non affichée : elle pousse à boire (« offert … shot »), ce que le site ne publie pas');
    // Une soirée annulée ne compte pas ; une soirée complète (CLOSED) reste annoncée.
    expect(donnees.soirees.filter((s) => s.bar.nom === 'Le Comptoir du Canal' && s.match.slug === 'psg-ol-2026-10-25')).toEqual([]);
    expect(donnees.bars.find((b) => b.nom === 'La Cave des Gones').soirees.map((s) => s.match.slug)).toEqual(['brest-nice-2026-10-23', 'psg-ol-2026-10-25']);
  });

  test('loi Evin : une offre qui nomme un alcool, ou qui parle d’une remise ou d’une gratuité, ne montre ni son titre ni son prix', async () => {
    // Les mots de l’appli, lus comme elle (les cas de son offerAlcohol.test.ts) : seul « sans alcool » y échappe.
    const casDeLAppli = [
      ['Pinte 5 €', 'Pinte'], ['La pinte à 5 €', 'pinte'], ['2 DEMIS achetés, le 3e offert', 'DEMIS'], ['Bière pression 4 €', 'Bière'],
      ['biere a 4 euros', 'biere'], ['Verre de vin rouge', 'vin'], ['Rosé bien frais', 'Rosé'], ['Coupe de champagne si Paris gagne', 'champagne'],
      ['Cocktails à 8 €', 'Cocktails'], ['Shot offert à chaque but', 'Shot'], ['Whisky coca', 'Whisky'], ['Gin tonic 9 €', 'Gin'],
      ['Apéro jusqu’au coup d’envoi', 'Apéro'], ['Planche apéritive et 2 apéritifs', 'apéritifs'], ['Bière sans alcool 4 €', null],
      ['Pinte de bière sans alcool', null], ['Cocktails sans alcool', null], ['Softs et boissons sans alcool', null],
      ['Pinte 5 € ou cocktail sans alcool', 'Pinte'], ['Nachos offerts', null], ['Menu burger 12 €', null], ['Gingembre frais', null],
      ['Ti-punch maison', 'punch'], ['Pinte ou soft sans alcool', 'Pinte'], ['Pinte (ou version sans alcool) 5 €', 'Pinte'],
      ['Bière blonde sans alcool', null], ['Demi-tarif sur les frites', null], ['Une demi-heure offerte', null], ['Demi à 3 €', 'Demi'],
      ['Pichet de rouge', 'Pichet'], ['Heineken 5 €', 'Heineken'], ['1664 à 6 €', '1664'], ['Jägermeister offert', 'Jägermeister'],
      ['Happy hour 18 h – 20 h', 'Happy hour'], ['Vin, bière sans alcool', 'Vin'], ['Pinte + bière sans alcool', 'Pinte'],
      ['Bière-pression sans alcool', null], ['Vin - bière sans alcool', 'Vin'], ['Pinte\nBière sans alcool', 'Pinte'],
      ['Bière sans alcool', null], ['Happyhour 18 h', 'Happyhour'], ['Verre de rouge 4 €', 'rouge'], ['Kro 3 €', 'Kro'],
      ['Panaché', 'Panaché'], ['Carton rouge : nachos offerts', null], ['Screenshot du score = café offert', null],
    ];
    for (const [titre, mot] of casDeLAppli) expect(motDAlcool(titre), titre).toBe(mot);
    // L’argot que le site ajoute à la liste de l’appli.
    expect(['Une binouze et des frites', 'Girafe à partager', 'Bibine du match'].map(motDAlcool)).toEqual(['binouze', 'Girafe', 'Bibine']);

    // Cochée « sans alcool » par le bar, une offre qui nomme un alcool reste « Une offre du bar dans l’appli » : ni titre,
    // ni prix (les exemples de la revue, et un mot coupé par un caractère invisible ou un retour à la ligne).
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const soiree = brut.matchNights.find((n) => n.id === 'n-comptoir-barca');
    const offreDu = (title) => {
      soiree.offer = { title, priceCents: 500, until: null, hasAlcohol: false };
      const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu });
      return { offre: donnees.soirees.find((s) => s.id === 'n-comptoir-barca').offre, avertissements: donnees.avertissements };
    };
    for (const titre of ['Pinte à 5 €', 'Bière -50% pendant le match', 'Planche et verre de vin', 'Pinte\nBière sans alcool', 'Une bi​nouze', 'APÉRO GÉANT']) {
      expect(offreDu(titre).offre, titre).toEqual({ dansLAppli: true });
    }
    expect(offreDu('Bière sans alcool et burger').offre).toEqual({ titre: 'Bière sans alcool et burger', prixCentimes: 500, jusqua: null });

    // Une remise ou une gratuité, même sans boisson nommée : le site ne sait pas sur quoi elle porte, il ne l’écrit pas.
    const remises = ['Burger -20 %', '-50% sur la carte', 'Tout à 50 % pendant le match', 'Frites à moitié prix', 'Tarif réduit pendant le match',
      'Réduction sur le menu', 'Remise de 2 € sur les planches', '-3 € sur le menu', 'Nachos offerts', 'Planche offerte avec le menu', 'Café gratuit',
      '3 pour 2 sur les softs', 'Softs à volonté', 'Planches illimitées', 'Promo sur les burgers', 'Menu à 10 € au lieu de 15 €', 'Happyhour',
      'Un soft par but du PSG'];
    for (const titre of remises) expect(offreInterdite(titre), titre).not.toBeNull();
    for (const titre of ['Menu burger et boisson fraîche', 'Planche à partager', 'Burger du match · frites maison', 'Demi-finale : planche du soir', 'Menu pour 2 à 25 €']) {
      expect(offreInterdite(titre), titre).toBeNull();
    }
    const remise = offreDu('Burger -20 %');
    expect(remise.offre).toEqual({ dansLAppli: true });
    expect(remise.avertissements).toContain('Offre de « Le Comptoir du Canal » non affichée : elle parle d’une remise ou d’une gratuité (« -20 % »), ce que le site ne publie pas');
    expect(offreDu('Burger, et le score en direct').avertissements).toContain('Offre de « Le Comptoir du Canal » non affichée : elle parle du score (« score »), ce que le site ne publie pas');
    // Le nom d’un bar n’est écarté que si la remise ou la gratuité touche une boisson : « Le Réduit » reste un bar.
    for (const nom of ['Le Réduit', 'Le Cadeau', 'La Cave à Bières', 'Le 1664', 'Les Promos']) expect(nomInterdit(nom), nom).toBeNull();
    for (const nom of ['Les Bières à moitié prix', 'Le Shot Gratuit', 'La Pinte -50%']) expect(nomInterdit(nom), nom).not.toBeNull();

    // Sur les pages : ni le titre, ni le prix ; à sa place, « Une offre du bar dans l’appli ».
    soiree.offer = { title: 'Pinte à 5 €', priceCents: 500, until: null, hasAlcohol: false };
    const site = await construireEnMemoire({ brut, maintenant: VENDREDI, racine, contenu });
    for (const p of site.pages) expect(p.contenu, p.chemin).not.toMatch(/Pinte|5 €/);
    const carte = site.pages.find((p) => p.chemin === '/bar/le-comptoir-du-canal-paris-10/').contenu.split('id="soiree-psg-barca-2026-10-24"')[1].split('</li>')[0];
    expect(carte).toContain('<p class="regarder-offre__texte">Une offre du bar dans l’appli</p>');
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
    site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu });
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

  test('une espace insécable avant « ? », « : » et « ; », dans les textes fixes et sur chaque page', () => {
    // Dans textes.json et villes.json (relus ici sans mise en forme, donc sans espace avant les « : » du JSON).
    expect(JSON.stringify([contenu.textes, contenu.villes]).match(/.{20} [?:;]/g)).toBeNull();
    for (const p of site.pages) expect(p.contenu.match(/.{30} [?:;]/g), p.chemin).toBeNull();
    expect(pageDe('/matchs/lille-lens-2026-10-26/').contenu).toContain(`Tu tiens un bar${String.fromCharCode(160)}?`);
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
    // La FAQ commence par une question vraie, faite des données (les bars, l’appli), puis celle de villes.json.
    const [faq] = deType(paris, 'FAQPage');
    const questionsDeParis = [
      { question: 'Baromatch est-il à Paris ?', reponse: `Oui. 2 bars de Paris diffusent le match sur Baromatch. ${contenu.textes.ville.appliFermee}` },
      ...contenu.villes.paris.faq,
    ];
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(questionsDeParis.map((q) => [insecables(q.question), insecables(q.reponse)]));
    for (const { question, reponse } of questionsDeParis) {
      expect(paris.contenu).toContain(`<summary>${insecables(echapper(question))}</summary>`);
      expect(paris.contenu).toContain(`<p>${insecables(echapper(reponse))}</p>`);
    }
    // Le guide écrit est là, tel quel ; il ne dit rien qui dépende du moment, et le contrôle refuse une page de ville
    // indexable dont le guide le ferait.
    for (const paragraphe of contenu.villes.paris.guide) expect(paris.contenu).toContain(insecables(echapper(paragraphe)));
    for (const ville of Object.keys(contenu.villes).filter((c) => !c.startsWith('_'))) {
      const { guide, faq: questions } = contenu.villes[ville];
      expect([...guide, ...questions.flatMap((q) => [q.question, q.reponse])].join(' '), ville).not.toMatch(/pas encore|premiers bars|pas ouverte|places|réserv|garde ta place/i);
    }
    const perime = { ...paris, contenu: paris.contenu.replace('<h2 id="titre-guide">', '<p>L’appli cherche ses premiers bars.</p><h2 id="titre-guide">') };
    expect(controlerLaPage(perime).join()).toContain('un guide de ville qui dépend du moment : « premiers bars »');
    expect(paris.titre).toBe('Bars foot à Paris : où regarder le match — Baromatch');
    // Une ville sans guide (Rennes) a sa page, faite de ses vraies données ; indexable à partir de 3 vrais bars.
    expect(SEUILS).toEqual({ barsParMatch: 2, barsParVilleAvecGuide: 1, barsParVilleSansGuide: 3, joursSansSoireePourUnBar: 60, barsPourLaSemaine: 1 });
    const rennes = pageDe('/regarder-le-match/rennes/');
    expect(rennes.indexable).toBe(false);
    expect(rennes.contenu).toContain('1 bar de Rennes diffuse le match sur Baromatch.');
  });

  test('les seuils d’indexation : 3 bars pour une ville sans guide, 60 jours sans soirée pour un bar', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.bars.push({ id: 'b-r2', name: 'Le Penalty', address: '4 Place Sainte-Anne, 35000 Rennes', isActive: true },
      { id: 'b-r3', name: 'La Lucarne', address: '5 Place Sainte-Anne, 35000 Rennes', isActive: true });
    const trois = await construireEnMemoire({ brut, maintenant: VENDREDI, racine, contenu: { ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-r2', 'b-r3'] } });
    expect(trois.pages.find((p) => p.chemin === '/regarder-le-match/rennes/').indexable).toBe(true);
    // Au Bon Coin n’annonce aucune soirée : sa page reste indexable 60 jours, comptés depuis sa dernière soirée (ou son
    // arrivée), gardés dans l’état.
    const coin = (jours) => construireEnMemoire({
      source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu,
      anciens: { matchs: [], bars: [{ slug: 'au-bon-coin-lyon-2', id: 'b-coin', ville: { cle: 'lyon', nom: 'Lyon' }, derniereSoiree: new Date(VENDREDI - jours * 86_400_000).toISOString() }], adresses: {} },
    }).then((site) => site.pages.find((p) => p.chemin === '/bar/au-bon-coin-lyon-2/'));
    expect((await coin(59)).indexable).toBe(true);
    const oublie = await coin(61);
    expect(oublie.indexable).toBe(false);
    expect(oublie.memoire.derniereSoiree).toBe(new Date(VENDREDI - 61 * 86_400_000).toISOString());
    // Brest – Nice n’a qu’un bar : sa page existe, en noindex.
    expect(trois.pages.find((p) => p.chemin === '/matchs/brest-nice-2026-10-23/').indexable).toBe(false);
  });

  test('une ville sans bar : noindex, et la page le dit', () => {
    for (const chemin of ['/regarder-le-match/marseille/', '/regarder-le-match/lille/']) {
      const p = pageDe(chemin);
      expect(p.indexable).toBe(false);
      expect(robotsDe(p)).toBe('noindex');
      expect(p.contenu).toMatch(/Aucun bar de (Marseille|Lille) n’est encore sur Baromatch\./);
      expect(deType(p, 'FAQPage')[0].mainEntity[0].acceptedAnswer.text).toMatch(/^Pas encore de bar à (Marseille|Lille) sur Baromatch\. L’appli, elle, est en test/);
      expect(deType(p, 'ItemList')).toEqual([]);
    }
  });

  test('un match sans vrai bar : noindex, et le lien « Tu tiens un bar ? » vers Pour les bars', () => {
    const p = pageDe('/matchs/lille-lens-2026-10-26/');
    expect(p.indexable).toBe(false);
    expect(robotsDe(p)).toBe('noindex');
    expect(p.contenu).toContain('Pas encore de bar pour ce match sur Baromatch.');
    expect(p.contenu).toContain(insecables('<a href="/pour-les-bars.html">Tu tiens un bar ?</a>'));
    expect(p.contenu).not.toMatch(/démo|Lucette/i);
    expect(deType(p, 'Event')).toEqual([]);
  });

  test('un match avec des bars : ses soirées en Event, la même adresse que sur la page du bar', () => {
    const match = pageDe('/matchs/psg-ol-2026-10-25/');
    expect(match.indexable).toBe(true);
    expect(match.contenu).toContain(insecables('<h1 class="regarder-titre">PSG – OL : les bars qui diffusent le match</h1>'));
    expect(match.titre).toBe('PSG – OL, 25 octobre : les bars qui diffusent le match');
    expect(pageDe('/matchs/brest-nice-2026-10-23/').indexable).toBe(false);
    // Le maillage : les villes et les décomptes mènent à la page de la ville.
    expect(match.contenu).toContain('<h3 class="regarder-ville"><a href="/regarder-le-match/lyon/">Lyon</a></h3>');
    expect(match.contenu).toContain('<p class="regarder-compte"><a href="/regarder-le-match/lyon/">1 bar à Lyon</a>, <a href="/regarder-le-match/paris/">1 bar à Paris</a></p>');
    expect(match.contenu).toContain('<p class="regarder-affiche">Paris Saint-Germain – Olympique Lyonnais</p>');
    expect(match.contenu).toContain('<time datetime="2026-10-25T20:45:00+01:00">dimanche 25 octobre · 20:45</time>');
    expect(match.contenu).not.toContain('Les places qui restent sont dans l’appli.');
    const evenements = deType(match, 'Event');
    expect(evenements.map((ev) => ev.name)).toEqual(['PSG – OL à La Cave des Gones', 'PSG – OL au Zinc des Amis']);
    // L’article du nom du bar : « Les » avant « Le », une espace après ; « La » et « L’ » gardent leur majuscule.
    const noms = ['Les Trois Frères', 'Le Zinc', 'La Lucarne', 'L’Annexe', "L'Annexe", 'Legends Pub', 'Lavomatic', 'Lesbos Café', 'Au Bon Coin'];
    expect(noms.map(auBar)).toEqual([' aux Trois Frères', ' au Zinc', ' à La Lucarne', ' à L’Annexe', " à L'Annexe", ' à Legends Pub', ' à Lavomatic', ' à Lesbos Café', ', Au Bon Coin']);
    const zinc = evenements[1];
    expect(zinc).toMatchObject({
      startDate: '2026-10-25T20:45:00+01:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: 'https://baromatch.fr/bar/le-zinc-des-amis-paris-11/#soiree-psg-ol-2026-10-25',
      location: { '@type': 'BarOrPub', name: 'Le Zinc des Amis', address: { streetAddress: '12 Rue Oberkampf', postalCode: '75011', addressLocality: 'Paris', addressCountry: 'FR' } },
      organizer: { '@type': 'BarOrPub', name: 'Le Zinc des Amis' },
      about: { '@type': 'SportsEvent', homeTeam: { '@type': 'SportsTeam', name: 'Paris Saint-Germain' }, awayTeam: { '@type': 'SportsTeam', name: 'Olympique Lyonnais' } },
    });
    // Le bar est le lieu de la diffusion, jamais celui du match ; pas d’offre tant que l’appli n’est pas ouverte.
    expect(zinc.about.location).toBeUndefined();
    expect(zinc.offers).toBeUndefined();
    // Aucune image générique dans un Event : Google en veut une qui représente l’évènement.
    expect(zinc.image).toBeUndefined();
    // La même soirée, sur la page du bar : la même adresse, et l’ancre existe.
    const bar = pageDe('/bar/le-zinc-des-amis-paris-11/');
    expect(deType(bar, 'Event').map((ev) => ev.url)).toContain(zinc.url);
    expect(bar.contenu).toContain('id="soiree-psg-ol-2026-10-25"');
    // Avant le changement d’heure, le décalage d’été.
    expect(deType(pageDe('/matchs/psg-barca-2026-10-24/'), 'Event')[0].startDate).toBe('2026-10-24T21:00:00+02:00');
  });

  test('les offres : dans le corps seulement, avec la mention santé sauf sans alcool', () => {
    const MENTION = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
    // L’offre avec alcool du Zinc : « Une offre du bar dans l’appli », sans titre, sans prix.
    for (const chemin of ['/matchs/psg-ol-2026-10-25/', '/bar/le-zinc-des-amis-paris-11/']) {
      const p = pageDe(chemin);
      expect(p.contenu).toContain('<p class="regarder-offre__texte">Une offre du bar dans l’appli</p>');
      expect(p.contenu).not.toMatch(/Pinte|12\u00A0€/);
      expect(p.contenu).not.toContain(MENTION);
    }
    const comptoir = pageDe('/bar/le-comptoir-du-canal-paris-10/');
    const soiree = comptoir.contenu.split('id="soiree-psg-barca-2026-10-24"')[1].split('</li>')[0];
    expect(soiree).toContain('Menu burger et boisson fraîche · 15\u00A0€ · jusqu’à 20:00');
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
      expect(p.contenu, p.chemin).not.toContain('Les places qui restent sont dans l’appli.');
      // Ni place gardée, ni places, ni réservation dans ce que lit le visiteur : « Quand l’appli ouvre, tu pourras… ».
      expect(texteVisible(p.contenu), p.chemin).not.toMatch(/garde ta place|places|réserv/i);
    }
    expect(pageDe('/matchs/').contenu).toContain(insecables('<p>Quand l’appli ouvre, tu pourras :</p>'));
  });

  test('l’appli ouverte : « Réserve ta place dans l’appli » vers le magasin, et la place gratuite dans chaque Event', async () => {
    const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
    const autre = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: ouverte });
    const p = autre.pages.find((x) => x.chemin === '/matchs/psg-ol-2026-10-25/');
    expect(p.contenu).toContain('<a class="capsule" href="https://magasin.exemple/baromatch-android">Réserve ta place dans l’appli · Android</a>');
    expect(p.contenu).not.toContain('préviens-moi');
    // La phrase sur les places qui restent : seulement l’appli ouverte.
    expect(contenu.textes.places).toBe('Les places qui restent sont dans l’appli.');
    expect(p.contenu).toContain('<p class="regarder-note">Les places qui restent sont dans l’appli.</p>');
    expect(autre.pages.find((x) => x.chemin === '/bar/le-zinc-des-amis-paris-11/').contenu).toContain('Les places qui restent sont dans l’appli.');
    // Au présent quand l’appli est ouverte.
    expect(p.contenu).toContain('<li><strong>Garde ta place</strong> Pour toi ou pour toute la bande, avant de sortir. Ça ne coûte rien.</li>');
    expect(p.contenu).not.toContain('tu pourras');
    expect(deType(p, 'Event')[0].offers).toEqual({ '@type': 'Offer', price: 0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: 'https://magasin.exemple/baromatch-android' });
  });

  test('la semaine : le bloc du soir, les jours, le nombre de vrais bars de chaque match', () => {
    const p = pageDe('/matchs/');
    expect(p.indexable).toBe(true);
    const ceSoir = p.contenu.split('id="titre-ce-soir">')[1].split('</section>')[0];
    expect(ceSoir).toMatch(/^Aujourd’hui, vendredi 23 octobre<\/h2>/);
    expect(ceSoir).toContain('<a href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a>');
    expect(ceSoir).toContain('1 bar à Lyon');
    expect(p.contenu).toContain('<h2 id="jour-2026-10-25">Dimanche 25 octobre</h2>');
    // Sous le titre du jour, la ligne ne répète pas la date : l’heure seule, la date complète dans datetime.
    expect(p.contenu).toMatch(/PSG – OL<\/a> · <time datetime="2026-10-25T20:45:00\+01:00">20:45<\/time> · Ligue 1 · <span class="regarder-compte"><a href="\/regarder-le-match\/lyon\/">1 bar à Lyon<\/a>, <a href="\/regarder-le-match\/paris\/">1 bar à Paris<\/a><\/span>/);
    expect(p.contenu).toMatch(/Lille – Lens<\/a>[^\n]*Pas encore de bar/);
    // Sept jours : le jeudi 29 en est le dernier, le vendredi 30 n’y est pas.
    expect(p.contenu).not.toContain('jour-2026-10-30');
    expect(p.titre).toBe('Où regarder le match ce soir et cette semaine — Baromatch');
    expect(p.contenu).toContain('<p class="regarder-retour"><a href="/regarder-le-match/">Toutes les villes</a></p>');
  });

  test('la semaine : « Aujourd’hui » avant 17 h, « Ce soir » ensuite, « Fini pour ce soir » quand tout est joué', async () => {
    const blocA = async (instant) => (await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: Date.parse(instant), racine, contenu }))
      .pages.find((x) => x.chemin === '/matchs/').contenu.split('id="titre-ce-soir">')[1].split('</section>')[0];
    expect(await blocA('2026-10-23T14:59:00Z')).toMatch(/^Aujourd’hui, vendredi 23 octobre<\/h2>/);
    const soir = await blocA('2026-10-23T15:00:00Z');
    expect(soir).toMatch(/^Ce soir, vendredi 23 octobre<\/h2>/);
    expect(soir).toContain('Brest – Nice');
    // Brest – Nice, à 20:45, est joué depuis plus de trois heures à 23:46 : fini pour ce soir, la suite au lendemain.
    const fini = await blocA('2026-10-23T21:46:00Z');
    expect(fini).toMatch(/^Fini pour ce soir<\/h2>/);
    expect(fini).not.toContain('Brest');
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
      if (p.type === 'bar' || p.type === 'ville') expect(fil.itemListElement[1], p.chemin).toMatchObject({ position: 2, name: 'Les villes', item: 'https://baromatch.fr/regarder-le-match/' });
      expect(fil.itemListElement.at(-1).item, p.chemin).toBe(`https://baromatch.fr${p.chemin}`);
      const principal = donneesStructurees(p)[0];
      expect(principal.publisher, p.chemin).toEqual({ '@id': 'https://baromatch.fr/#organisation' });
      expect(principal.url, p.chemin).toBe(`https://baromatch.fr${p.chemin}`);
    }
  });

  test('la copie enregistrée de ce soir : zéro vrai bar, donc chaque page en noindex', async () => {
    const capture = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: ENREGISTREMENT, racine, contenu });
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
    const { image: _image, ...sansImage } = evenement;
    expect(erreurs(sansImage)).toBe('');
    expect(erreurs({ ...evenement, image: ['/img/og-image.jpg'] })).toMatch(/image qui n’est pas une adresse absolue/);
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
    const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu });
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
  const passer = (sortie, maintenant, options = {}) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu, ...options });
  const scenarioSans = (dossier, retirer) => {
    const brut = JSON.parse(readFileSync(SCENARIO, 'utf8'));
    const fichier = path.join(dossier, 'scenario-modifie.json');
    writeFileSync(fichier, JSON.stringify(retirer(brut)));
    return `scenario:${fichier}`;
  };

  test('l’adresse de page d’un bar est stable : gardée s’il change de nom, jamais redonnée, « -2 » exclu', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    expect(etatDe(sortie).adresses['le-zinc-des-amis-paris-11']).toBe('b-zinc');
    // Le Zinc change de nom ; un autre bar prend son ancien nom, à la même adresse.
    const source = scenarioSans(sortie, (brut) => ({
      ...brut,
      bars: [...brut.bars.map((b) => (b.id === 'b-zinc' ? { ...b, name: 'Le Zinc Rénové' } : b)),
        { id: 'b-zzz', name: 'Le Zinc des Amis', address: '12 Rue Oberkampf, 75011 Paris', isActive: true }],
    }));
    const avecZzz = { ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-zzz'] };
    const resultat = await passer(sortie, '2026-10-21T09:00:00Z', { source, contenu: avecZzz });
    const nomDe = (chemin) => resultat.fichiers.find((f) => f.chemin === chemin)?.bar?.nom;
    expect(nomDe('/bar/le-zinc-des-amis-paris-11/')).toBe('Le Zinc Rénové');
    expect(nomDe('/bar/le-zinc-des-amis-paris-11-2/')).toBe('Le Zinc des Amis');
    expect(resultat.fichiers.some((f) => f.chemin.startsWith('/bar/le-zinc-renove'))).toBe(false);
    expect(etatDe(sortie).adresses).toMatchObject({ 'le-zinc-des-amis-paris-11': 'b-zinc', 'le-zinc-des-amis-paris-11-2': 'b-zzz' });
    // L’exclusion du bar en « -2 » (par son identifiant) retire ce bar-là, et seulement lui : sa page ne dit plus son nom.
    await passer(sortie, '2026-10-21T10:00:00Z', { source, contenu: { ...avecZzz, exclus: ['b-zzz'] } });
    expect(lire(sortie, 'bar/le-zinc-des-amis-paris-11-2/index.html')).not.toContain('Le Zinc des Amis');
    expect(lire(sortie, 'bar/le-zinc-des-amis-paris-11/index.html')).toContain('Le Zinc Rénové');
    expect(etatDe(sortie).adresses['le-zinc-des-amis-paris-11-2']).toBeUndefined();
    // Sans état, deux bars du même nom : le second prend « -2 », et l’exclure par cette adresse garde le premier.
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.bars.push({ id: 'b-zzz', name: 'Le Zinc des Amis', address: '14 Rue Oberkampf, 75011 Paris', isActive: true });
    const deux = preparer(brut, { maintenant: VENDREDI, ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-zzz'], exclus: ['b-zzz'] });
    expect(deux.bars.filter((b) => b.nom === 'Le Zinc des Amis').map((b) => [b.id, b.slug])).toEqual([['b-zinc', 'le-zinc-des-amis-paris-11']]);
  });

  test('reporté, annulé, prolongations, marque.json et état illisible', async () => {
    // Le jour de Paris lu morceau par morceau, jamais par le format d’une langue.
    expect(readFileSync(path.join(racine, 'generateur', 'heure.mjs'), 'utf8')).not.toContain('en-CA');
    expect(jourDeParis(Date.parse('2026-10-24T22:30:00Z'))).toBe('2026-10-25');

    // Reporté ou annulé : l’Event le dit, la page aussi ; lisible si des bars l’annonçaient, mais hors du plan du site.
    const sortie = dossierVide();
    const source = scenarioSans(sortie, (brut) => ({
      ...brut,
      matches: brut.matches.map((m) => (m.id === 'm-psg-ol' ? { ...m, status: 'POSTPONED' } : m.id.startsWith('m-psg-barca') ? { ...m, status: 'CANCELLED' } : m)),
    }));
    const resultat = await passer(sortie, '2026-10-23T08:00:00Z', { source });
    const ol = resultat.fichiers.find((f) => f.chemin === '/matchs/psg-ol-2026-10-25/');
    expect(ol.contenu).toContain('<strong>Match reporté.</strong>');
    expect(ol.indexable).toBe(true);
    expect(ol.contenu).not.toContain('content="noindex"');
    expect(ol.jsonld.filter((x) => x['@type'] === 'Event').map((x) => x.eventStatus)).toEqual(['https://schema.org/EventPostponed', 'https://schema.org/EventPostponed']);
    const barca = resultat.fichiers.find((f) => f.chemin.startsWith('/matchs/psg-barca-'));
    expect(barca.contenu).toContain('<strong>Match annulé.</strong>');
    expect(barca.jsonld.find((x) => x['@type'] === 'Event').eventStatus).toBe('https://schema.org/EventCancelled');
    expect(plan(sortie)).not.toContain('/matchs/psg-ol-2026-10-25/');
    expect(plan(sortie)).not.toContain(barca.chemin);
    expect(plan(sortie)).toContain('/bar/le-zinc-des-amis-paris-11/');

    // Un match est passé trois heures après le coup d’envoi (20 h 45 à Paris), pas deux : prolongations, tirs au but.
    const pageA = async (instant) => (await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: Date.parse(instant), racine, contenu })).pages.find((p) => p.chemin === '/matchs/psg-ol-2026-10-25/');
    expect((await pageA('2026-10-25T22:30:00Z')).indexable).toBe(true);
    expect(await pageA('2026-10-25T22:50:00Z')).toBeUndefined();

    // L’appli dite ouverte sans lien de magasin : une erreur claire, rien n’est fabriqué.
    const sansLien = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: '', iphone: '' } } };
    await expect(construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: sansLien })).rejects.toThrow(/marque\.json : « appli\.ouverte » est vrai, mais aucun lien de magasin/);

    // Un état illisible arrête tout, sans remise à zéro.
    for (const abime of ['', '{"pages": ', '[]']) {
      writeFileSync(path.join(sortie, 'regarder-le-match/etat.json'), abime);
      await expect(passer(sortie, '2026-10-23T09:00:00Z', { source }), JSON.stringify(abime)).rejects.toThrow(/etat\.json est illisible.*rien n’est écrit/);
      expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(abime);
    }
  });

  test('les bornes : un nom de club ou de bar très long est coupé proprement, et « onair=1 » dans un nom n’est pas un attribut', async () => {
    const sortie = dossierVide();
    const longBar = 'Le Grand Comptoir Lumineux des Supporters du Faubourg Saint-Antoine, et de Bercy';
    expect(longBar).toHaveLength(80);
    const source = scenarioSans(sortie, (brut) => ({
      ...brut,
      matches: [...brut.matches, {
        id: 'm-long', startAt: '2026-10-27T19:00:00.000Z', league: 'Premier League',
        homeTeam: 'Wolverhampton Wanderers FC', awayTeam: 'Brighton & Hove Albion FC',
        homeClub: { slug: 'wolverhampton-x', canonicalName: 'Wolverhampton Wanderers FC' }, awayClub: { slug: 'brighton-x', canonicalName: 'Brighton & Hove Albion FC' },
      }],
      bars: [...brut.bars,
        { id: 'b-long', name: longBar, address: '30 Rue de Lappe, 75011 Paris', isActive: true },
        { id: 'b-spot', name: 'Le Spot onair=1', address: '31 Rue de Lappe, 75011 Paris', isActive: true }],
      matchNights: [...brut.matchNights,
        { id: 'n-long', status: 'OPEN', bar: { id: 'b-long' }, match: { id: 'm-long' }, offer: null },
        { id: 'n-spot', status: 'OPEN', bar: { id: 'b-spot' }, match: { id: 'm-long' }, offer: null }],
    }));
    const resultat = await passer(sortie, '2026-10-23T08:00:00Z', { source, contenu: { ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-long', 'b-spot'] } });
    expect(resultat.avertissements.filter((a) => a.startsWith('Page refusée'))).toEqual([]);
    const pageDe = (debut) => resultat.fichiers.find((f) => f.chemin.startsWith(debut) && f.chemin.endsWith('/'));
    for (const p of [pageDe('/matchs/wolverhampton-wanderers-brighton-hove-albion-'), pageDe('/bar/le-grand-comptoir'), pageDe('/bar/le-spot-onair-1')]) {
      expect(p, 'page publiée').toBeTruthy();
      expect(p.titre.length, p.titre).toBeLessThanOrEqual(60);
      expect(p.description.length, p.description).toBeLessThanOrEqual(160);
      expect(controlerLaPage(p)).toEqual([]);
    }
    expect(pageDe('/matchs/wolverhampton').titre).toMatch(/[^\s,:]…$/);
    // Un vrai attribut d’évènement reste refusé, même dans une page par ailleurs juste.
    const spot = pageDe('/bar/le-spot-onair-1');
    expect(controlerLaPage({ ...spot, contenu: spot.contenu.replace('<h1 ', '<h1 onclick="x()" ') }).join()).toMatch(/attribut d’évènement/);
    expect(controlerLaPage({ ...spot, contenu: spot.contenu.replace('<h1 ', '<h1 data-x=\'a onair=1\' ') })).toEqual([]);
  });

  test('une page refusée garde sa version précédente sans arrêter le passage ; une erreur du gabarit commun l’arrête', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const fichier = 'bar/au-bon-coin-lyon-2/index.html';
    const avant = { page: lire(sortie, fichier), badge: lire(sortie, 'bar/au-bon-coin-lyon-2/badge.svg'), etat: etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/'] };
    // Un texte faux sur les seules pages des bars sans soirée : elles sont refusées, les autres passent.
    const faux = structuredClone(contenu);
    faux.textes.bar.sansSoiree = 'Pas de soirée annoncée pour l’instant !';
    const resultat = await passer(sortie, '2026-10-23T10:00:00Z', { contenu: faux });
    expect(resultat.avertissements.some((a) => a.startsWith('Page refusée, sa version précédente reste en ligne : /bar/au-bon-coin-lyon-2/'))).toBe(true);
    expect(lire(sortie, fichier)).toBe(avant.page);
    expect(lire(sortie, 'bar/au-bon-coin-lyon-2/badge.svg')).toBe(avant.badge);
    expect(etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/']).toEqual(avant.etat);
    expect(plan(sortie)).toContain('/bar/au-bon-coin-lyon-2/</loc>');
    expect(resultat.supprimees).toEqual([]);
    // Le fil d’Ariane de chaque page faux : toutes refusées, rien n’est écrit.
    const gabarit = structuredClone(contenu);
    gabarit.textes.fil.accueil = 'Accueil !';
    const etatAvant = lire(sortie, 'regarder-le-match/etat.json');
    await expect(passer(sortie, '2026-10-23T12:00:00Z', { contenu: gabarit })).rejects.toThrow(/Pages refusées, rien n’est écrit/);
    expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(etatAvant);
  });

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
    expect(page).toContain(insecables('Le prochain match de Lens : <a href="/matchs/lille-lens-2026-10-26/">Lille – Lens</a>'));
    expect(page).not.toMatch(/regarder-carte|Zinc/);
    expect(plan(sortie)).not.toContain('om-lens');
    const apres = etatDe(sortie).pages['/matchs/om-lens-2026-10-22/'];
    expect(apres).toMatchObject({ indexable: false, change: '2026-10-23' });
    // Une page qui n’a pas changé garde sa date ; le plan du site donne celle de son dernier vrai changement.
    expect(etatDe(sortie).pages['/matchs/psg-ol-2026-10-25/'].change).toBe('2026-10-21');
    expect(plan(sortie)).toContain('<loc>https://baromatch.fr/matchs/psg-ol-2026-10-25/</loc><lastmod>2026-10-21</lastmod>');
    expect(resultat.changees).not.toContain('https://baromatch.fr/matchs/psg-ol-2026-10-25/');
    expect(resultat.changees).toContain('https://baromatch.fr/matchs/');
    // IndexNow apprend aussi qu’une adresse indexable ne l’est plus.
    expect(resultat.changees).toContain('https://baromatch.fr/matchs/om-lens-2026-10-22/');

    // Le même passage refait n’écrit rien.
    expect((await passer(sortie, '2026-10-23T08:00:00Z')).ecrits).toEqual([]);

    // 30 jours après son coup d’envoi, la page disparaît, et l’état l’oublie.
    await passer(sortie, '2026-11-22T08:00:00Z');
    expect(existsSync(path.join(sortie, 'matchs/om-lens-2026-10-22'))).toBe(false);
    expect(etatDe(sortie).pages['/matchs/om-lens-2026-10-22/']).toBeUndefined();
    expect(existsSync(path.join(sortie, 'matchs/psg-ol-2026-10-25/index.html'))).toBe(true);
  });

  test('un bar qui sort (disparu des données, retiré de la liste des bars publiés, exclu) : sans son nom, en noindex, vers sa ville, puis disparaît', async () => {
    const verifierLaSortie = (dossier, quand) => {
      const page = lire(dossier, 'bar/le-zinc-des-amis-paris-11/index.html');
      expect(page).toContain('<meta name="robots" content="noindex">');
      expect(page).toContain('<h1 class="regarder-titre">Ce bar n’est plus sur Baromatch.</h1>');
      expect(page).toContain('<a href="/regarder-le-match/paris/">Où regarder le match à Paris</a>');
      // Ni son nom, ni son adresse, ni sa position.
      expect(page).not.toMatch(/Zinc des Amis|Oberkampf|75011|BarOrPub|GeoCoordinates|latitude/);
      expect(plan(dossier)).not.toContain('le-zinc-des-amis');
      // L’état ne garde que son identifiant, sa ville et la date de sa sortie ; le badge redevient le badge générique.
      expect(etatDe(dossier).pages['/bar/le-zinc-des-amis-paris-11/'].memoire).toEqual({ id: 'b-zinc', ville: { cle: 'paris', nom: 'Paris' }, disparu: quand });
      const etat = lire(dossier, 'regarder-le-match/etat.json');
      expect(etat).not.toContain('Zinc des Amis');
      expect(etat).not.toContain('Oberkampf');
      const badge = lire(dossier, 'bar/le-zinc-des-amis-paris-11/badge.svg');
      expect(badge).not.toMatch(/Zinc|On diffuse|PSG/);
      expect(badge).toContain('<tspan fill="#FFB13D">baromatch.fr</tspan>');
      // Et il n’apparaît plus nulle part ailleurs : ni carte, ni décompte, ni donnée structurée.
      for (const fichier of ['regarder-le-match/paris/index.html', 'matchs/psg-ol-2026-10-25/index.html', 'matchs/index.html']) {
        expect(lire(dossier, fichier), fichier).not.toContain('Zinc');
      }
    };

    // Disparu des données.
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    // Même publié, un bar n’a dans l’état ni son nom ni son adresse.
    expect(lire(sortie, 'regarder-le-match/etat.json')).not.toContain('Oberkampf');
    const sansZinc = scenarioSans(sortie, (brut) => ({ ...brut, bars: brut.bars.filter((b) => b.id !== 'b-zinc') }));
    const resultat = await construire({ source: sansZinc, sortie, maintenant: Date.parse('2026-10-23T08:00:00Z'), racine, contenu });
    verifierLaSortie(sortie, '2026-10-23T08:00:00.000Z');
    // IndexNow apprend que l’adresse n’est plus indexable.
    expect(resultat.changees).toContain('https://baromatch.fr/bar/le-zinc-des-amis-paris-11/');
    await construire({ source: sansZinc, sortie, maintenant: Date.parse('2026-11-23T08:00:00Z'), racine, contenu });
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11'))).toBe(false);

    // Retiré de la liste des bars publiés, ou mis dans la liste d’exclusion : pareil.
    for (const sansLui of [{ publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') }, { exclus: ['b-zinc'] }]) {
      const dossier = dossierVide();
      await passer(dossier, '2026-10-21T08:00:00Z');
      await passer(dossier, '2026-10-22T08:00:00Z', { contenu: { ...contenu, ...sansLui } });
      verifierLaSortie(dossier, '2026-10-22T08:00:00.000Z');
    }
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

  test('la prudence : une liste de bars ou de soirées vide, ou la moitié des bars ou des matchs à venir perdus, n’écrit rien', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const etatAvant = lire(sortie, 'regarder-le-match/etat.json');
    const garder = ['b-zinc', 'b-comptoir'];
    const cas = [
      [(brut) => ({ ...brut, bars: [] }), /la liste des bars est vide, alors que 5 bars sont publiés/],
      [(brut) => ({ ...brut, matchNights: [] }), /la liste des soirées est vide/],
      [(brut) => ({ ...brut, bars: brut.bars.filter((b) => garder.includes(b.id) || !/^b-(gones|coin|rennes)$/.test(b.id)) }), /3 des 5 bars publiés ne sont plus dans la liste des bars/],
      [(brut) => ({ ...brut, matches: brut.matches.slice(0, 2) }), /des \d+ matchs à venir publiés ne sont plus dans la liste des matchs/],
    ];
    for (const [modifier, message] of cas) {
      const source = scenarioSans(sortie, modifier);
      await expect(passer(sortie, '2026-10-23T09:00:00Z', { source })).rejects.toThrow(message);
      await expect(passer(sortie, '2026-10-23T09:00:00Z', { source })).rejects.toThrow(/rien n’est écrit.*--accepter-les-suppressions/s);
      expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(etatAvant);
    }
    // Deux bars publiés, un qui part : rien ne bloque (sous le seuil). Et la case cochée accepte une liste tronquée.
    const deuxBars = { pages: {
      '/bar/a-paris-11/': { type: 'bar', memoire: { id: 'a' } }, '/bar/b-paris-11/': { type: 'bar', memoire: { id: 'b' } },
    } };
    expect(verifierLesListes({ precedent: deuxBars, donnees: { bars: [{ id: 'a' }], ecartes: [], matchs: [], recus: { bars: 1, soirees: 1 } }, maintenant: VENDREDI })).toEqual([]);
    await passer(sortie, '2026-10-23T09:00:00Z', { source: scenarioSans(sortie, (brut) => ({ ...brut, bars: [] })), accepterLesSuppressions: true });
    expect(lire(sortie, 'regarder-le-match/etat.json')).not.toBe(etatAvant);
  });

  test('le badge vivant : la prochaine soirée, ou « On diffuse le match », jamais « Réserve ta place » tant que l’appli est fermée', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const badge = (slug) => lire(sortie, `bar/${slug}/badge.svg`);
    const texte = (svg) => [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    // Toujours la date, jamais « Ce soir » : une image fixe ne sait pas quel jour on la regarde.
    expect(texte(badge('la-cave-des-gones-lyon-2'))).toEqual(['Ven. 23 oct. · 20:45', 'Brest – Nice · sur Baromatch']);
    expect(texte(badge('le-zinc-des-amis-paris-11'))).toEqual(['Sam. 24 oct. · 21:00', 'PSG – Barça · sur Baromatch']);
    // L’aperçu sur la page du bar dit ce que le badge affiche.
    expect(lire(sortie, 'bar/la-cave-des-gones-lyon-2/index.html')).toContain(insecables('alt="Aperçu du badge : ven. 23 oct. · 20:45, Brest – Nice, sur Baromatch"'));
    expect(texte(badge('au-bon-coin-lyon-2'))).toEqual(['On diffuse le match', 'sur Baromatch']);
    const svg = badge('le-zinc-des-amis-paris-11');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="360" height="72" viewBox="0 0 360 72" role="img" aria-labelledby="titre-badge">/);
    expect(svg).toContain('<title id="titre-badge">Le Zinc des Amis sur Baromatch : sam. 24 oct. · 21:00, PSG – Barça</title>');
    expect(svg).toContain('<rect x="0.5" y="0.5" width="359" height="71" rx="35.5" fill="#0A0B10" stroke="#FFFFFF" stroke-opacity="0.14"/>');
    expect(svg).toContain('fill="#F7F7F9"');
    expect(svg).toContain('<tspan fill="#FFB13D">sur Baromatch</tspan>');
    expect(svg).toContain('font-family="\'Bricolage Grotesque\', system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif"');
    expect(svg).toContain('stop-color="#FFB13D"');
    for (const slug of ['la-cave-des-gones-lyon-2', 'le-zinc-des-amis-paris-11', 'au-bon-coin-lyon-2']) {
      expect(badge(slug)).not.toMatch(/Réserve|Pinte|offre|<script|href=|Ce soir|Aujourd/i);
    }
    // L’appli ouverte : la dernière ligne devient « Réserve ta place sur Baromatch ».
    const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
    await passer(sortie, '2026-10-23T08:00:00Z', { contenu: ouverte });
    expect(texte(badge('la-cave-des-gones-lyon-2'))).toEqual(['Ven. 23 oct. · 20:45 · Brest – Nice', 'Réserve ta place sur Baromatch']);
    expect(texte(badge('au-bon-coin-lyon-2'))).toEqual(['On diffuse le match', 'Réserve ta place sur Baromatch']);

    // Le code à coller : le badge et un lien vers la page du bar, au nom du bar, sans paramètre de suivi.
    const page = lire(sortie, 'bar/au-bon-coin-lyon-2/index.html');
    const code = page.match(/<textarea[^>]*readonly[^>]*>([^<]*)<\/textarea>/)[1];
    expect(code).toBe(echapper('<a href="https://baromatch.fr/bar/au-bon-coin-lyon-2/" title="Au Bon Coin sur Baromatch"><img src="https://baromatch.fr/bar/au-bon-coin-lyon-2/badge.svg" width="360" height="72" alt="Au Bon Coin sur Baromatch"></a>'));
    expect(page).toContain(insecables('<summary>Tu tiens ce bar ? Ton badge</summary>'));
  });

  test('la copie enregistrée de ce soir, écrite : tout en noindex, le plan du site inchangé', async () => {
    const sortie = dossierVide();
    const resultat = await construire({ source: `capture:${CAPTURE}`, sortie, maintenant: ENREGISTREMENT, racine, contenu });
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
    // Lancée à la main depuis une autre branche, elle ne fait rien, et elle part toujours de main : jamais une autre
    // branche envoyée sur main. Lu dans son seul travail, et dans son étape de récupération du dépôt.
    const travaux = action.split('\njobs:\n')[1];
    expect([...travaux.matchAll(/^ {2}[a-z-]+:$/gm)]).toHaveLength(1);
    expect(travaux).toMatch(/^ {2}generer:\n(?: {4}#.*\n)* {4}if: github\.ref == 'refs\/heads\/main'\n/);
    expect(travaux).toMatch(/ {6}- uses: actions\/checkout@v7\n {8}with:\n {10}ref: main\n/);
    // Des actions à leur étiquette de version (vérifiées le 16 octobre 2026), Node 22, rien à installer.
    expect([...action.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1])).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
    expect(action).toContain('node-version: 22');
    expect(action).not.toMatch(/npm (ci|install)/);
    // Le générateur contre les listes publiques ; seuls les chemins de la liste blanche sont enregistrés.
    expect(action).toContain('node generateur/construire.mjs --source=api --changees="$RUNNER_TEMP/changees.txt" $option');
    expect(action).toContain('for chemin in matchs regarder-le-match bar sitemap.xml; do');
    expect(action).toContain("grep -vqE '^(matchs|regarder-le-match|bar)/|^sitemap\\.xml$'");
    expect(action).toContain('git pull -q --rebase origin main');
    // Le jeton n’est pas gardé dans la configuration de git (le générateur tourne sans lui) : seule l’étape qui envoie
    // le reçoit pour git, le temps de l’envoi, comme actions/checkout le fait lui-même ; la demande de publication à
    // Pages le reçoit aussi (elle appelle l’API de GitHub, pas git).
    expect(action).toMatch(/ {6}- uses: actions\/checkout@v7\n {8}with:\n {10}ref: main\n {10}fetch-depth: 0\n(?: {10}#.*\n)* {10}persist-credentials: false\n/);
    const etapes = action.split('\n      - ');
    const avecLeJeton = etapes.filter((etape) => etape.includes('github.token')).map((etape) => etape.split('\n')[0]);
    expect(avecLeJeton).toEqual(['name: Enregistrer et envoyer les pages qui ont changé', 'name: Demander la publication à GitHub Pages']);
    expect(action).toContain('git -c "http.https://github.com/.extraheader=$entete" push -q origin HEAD:main');
    expect(action).not.toMatch(/git push|remote set-url/);
    // La publication demandée après l’envoi ; IndexNow n’arrête jamais l’Action.
    expect(action).toMatch(/node generateur\/publier\.mjs pages\n/);
    expect(action).toMatch(/continue-on-error: true\n        run: node generateur\/publier\.mjs indexnow "\$RUNNER_TEMP\/changees\.txt"\n/);
  });

  test('la publication : redemandée si la dernière n’est pas celle de main, suivie à son adresse, puis seulement IndexNow', async () => {
    const DEPOT = 'proprietaire/site';
    const LATEST = `https://api.github.com/repos/${DEPOT}/pages/builds/latest`;
    const SUIVIE = `https://api.github.com/repos/${DEPOT}/pages/builds/4242`;
    // Un faux GitHub : chaque adresse répond la suite de réponses donnée, la dernière ensuite.
    const fauxGitHub = (reponses) => {
      const appels = [];
      const appeler = async (adresse, options = {}) => {
        appels.push(`${options.method ?? 'GET'} ${adresse}`);
        const liste = reponses[`${options.method ?? 'GET'} ${adresse}`] ?? [];
        const corps = liste.length > 1 ? liste.shift() : liste[0];
        return { ok: Boolean(corps), status: corps ? 200 : 404, json: async () => corps, text: async () => '' };
      };
      return { appels, appeler };
    };
    const commun = { depot: DEPOT, jeton: 'x', attendre: async () => {}, journal: () => {} };
    const demande = { [`POST https://api.github.com/repos/${DEPOT}/pages/builds`]: [{ url: SUIVIE, status: 'queued' }] };

    // Rien d’envoyé, la dernière publication est celle de main : rien à faire.
    let gh = fauxGitHub({ [`GET ${LATEST}`]: [{ status: 'built', commit: 'aaa' }] });
    expect(await publierLesPages({ ...commun, ...gh, commit: 'aaa', envoye: false })).toBe('deja');
    expect(gh.appels).toEqual([`GET ${LATEST}`]);
    // Rien d’envoyé, mais la dernière publication est plus ancienne : redemandée, puis suivie à l’adresse renvoyée.
    gh = fauxGitHub({ [`GET ${LATEST}`]: [{ status: 'errored', commit: 'vieux' }], ...demande, [`GET ${SUIVIE}`]: [{ status: 'building', commit: 'aaa' }, { status: 'built', commit: 'aaa' }] });
    expect(await publierLesPages({ ...commun, ...gh, commit: 'aaa', envoye: false })).toBe('publie');
    expect(gh.appels).toEqual([`GET ${LATEST}`, `POST https://api.github.com/repos/${DEPOT}/pages/builds`, `GET ${SUIVIE}`, `GET ${SUIVIE}`]);
    // Envoyé : demandée tout de suite. Si l’adresse suivie est « latest », l’ancienne publication (déjà finie) ne
    // compte pas : seule celle du dernier commit.
    gh = fauxGitHub({ [`POST https://api.github.com/repos/${DEPOT}/pages/builds`]: [{ url: LATEST, status: 'queued' }], [`GET ${LATEST}`]: [{ status: 'built', commit: 'vieux' }, { status: 'built', commit: 'bbb' }] });
    expect(await publierLesPages({ ...commun, ...gh, commit: 'bbb', envoye: true })).toBe('publie');
    expect(gh.appels.filter((a) => a.startsWith('GET'))).toHaveLength(2);
    // En erreur : une erreur. Jamais finie : « en cours », sans IndexNow.
    gh = fauxGitHub({ ...demande, [`GET ${SUIVIE}`]: [{ status: 'errored', commit: 'ccc', error: { message: 'raté' } }] });
    await expect(publierLesPages({ ...commun, ...gh, commit: 'ccc', envoye: true })).rejects.toThrow(/raté/);
    gh = fauxGitHub({ ...demande, [`GET ${SUIVIE}`]: [{ status: 'building', commit: 'ccc' }] });
    expect(await publierLesPages({ ...commun, ...gh, commit: 'ccc', envoye: true, attenteMax: 60_000 })).toBe('en cours');

    // L’Action : la publication est demandée même sans envoi, avec le dernier commit de main ; IndexNow attend une
    // publication réussie.
    const etape = action.split('- name: Demander la publication à GitHub Pages\n')[1].split('\n\n')[0];
    expect(etape).not.toMatch(/^ {8}if:/m);
    expect(etape).toContain('ENVOYE: ${{ steps.envoi.outputs.envoye }}');
    expect(etape).toContain('export COMMIT="$(git ls-remote origin refs/heads/main | cut -f1)"');
    expect(action).toContain("if: steps.envoi.outputs.envoye == 'oui' && steps.publication.outputs.publie == 'oui'\n        continue-on-error: true\n        run: node generateur/publier.mjs indexnow");
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
