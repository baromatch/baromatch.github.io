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
import { heureDeParis, isoDeParis, jourDeParis, quandEnLettres } from '../generateur/heure.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { fabriquerLesPages, SEUILS } from '../generateur/pages.mjs';
import { blocsDe, chargerLeVocabulaire, validerLaPage, validerUnBloc } from '../generateur/validateur.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { insecables, lireLeCadre, offre as offreAffichee } from '../generateur/gabarits.mjs';
import { echapper } from '../generateur/texte.mjs';
import { auBar } from '../generateur/jsonld.mjs';
import { construire, verifierLesListes } from '../generateur/construire.mjs';
import { ecrireUnFichier, estPermis } from '../generateur/etat.mjs';
import { anonymiser, reduire } from '../generateur/outils/reduire-capture.mjs';
import { adressesCitees, raisonDeNePasGarder } from '../generateur/refus.mjs';
import { prevenirIndexNow, publierLesPages, reglagesIndexNow, requeteIndexNow } from '../generateur/publier.mjs';
import { TEXTES_EN } from '../generateur/anglais.mjs';

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
      // Les noms d’essai courants, même collés à un chiffre, à « _ » ou à une majuscule.
      'Bar de démonstration': essai,
      'Bar d’essai Baromatch': essai,
      'Bar Test1': essai,
      bar_test: essai,
      Demo2: essai,
      'QA2 Bar': essai,
      TestBar: essai,
      'Bar recette': essai,
      // Un vrai bar écarté à tort (un bar de rugby) : moins grave qu’un faux bar publié, réintégré par la liste
      // « forcer », et signalé dans le journal parce qu’il est dans la liste des bars publiés.
      'L’Essai': essai,
    });
    // Aucune soirée d’un faux bar : le match de Lille, diffusé seulement par deux bars de démo, n’a pas de bar.
    const faux = new Set(donnees.ecartes.map((e) => e.id));
    expect(donnees.soirees.filter((s) => faux.has(s.bar.id))).toEqual([]);
    expect(donnees.matchs.find((m) => m.slug === 'lille-lens-2026-10-26').soirees).toEqual([]);

    // Un mot d’essai entier, sans accents ni capitales, dans le nom, l’adresse ou l’identifiant ; dans un nom ou une
    // adresse, aussi collé à une majuscule, à un chiffre ou à « _ » ; jamais dans un autre mot (« Le Démon »,
    // « Le Testament », « L’Aquarium ») ; la liste d’exclusion, par identifiant ; isDemo, qui n’existe pas encore dans
    // les données, est déjà lu.
    const vide = new Set();
    const rue = '1 rue de Paris, 75001 Paris';
    expect(raisonDEcarter({ name: 'Le Comptoir', address: '1 rue des Tèsts, 75001 Paris' }, vide)).toBe(essai);
    expect(raisonDEcarter({ name: 'Bar Qa', address: rue }, vide)).toBe(essai);
    for (const name of ['Bar staging', 'Sandbox Pub', 'Le Bar fictif', 'Comptoir factice', 'Démonstration', 'bar_qa', 'DEMOBar', 'QABar', 'Démos du soir', 'Bar2Test3']) {
      expect(raisonDEcarter({ name, address: rue }, vide), name).toBe(essai);
    }
    for (const name of ['Le Démon', 'Le Testament', 'Le Contest', 'La Démocratie', 'Testarossa', 'L’Aquarium', 'Les Essaims']) {
      expect(raisonDEcarter({ id: 'b-9', name, address: rue }, vide), name).toBeNull();
    }
    // Un identifiant est opaque : un mot d’essai n’y compte qu’entre deux séparateurs, suivi ou non de chiffres.
    for (const id of ['bar-arrivee-qa-exemple', 'b-demo', 'test_bar_2', 'seed.demo1', 'QA-7']) {
      expect(raisonDEcarter({ id, name: 'Le Comptoir', address: rue }, vide), id).toBe(essai);
    }
    for (const id of ['cmg4x8qa0000test5demo2k1p', 'clx7testq8a0k3', 'b-qatar', 'bar-testament-2']) {
      expect(raisonDEcarter({ id, name: 'Le Comptoir', address: rue }, vide), id).toBeNull();
    }
    expect(raisonDEcarter({ name: 'Le Quai', address: '1 quai de la Gare, 75013 Paris' }, vide)).toBeNull();
    expect(raisonDEcarter({ id: 'b-t1', name: 'L’Essai', address: rue }, vide, new Set(['b-t1']))).toBeNull();
    expect(raisonDEcarter({ id: 'b-1', name: 'Le Quai', address: '1 quai, 75013 Paris' }, new Set(['b-1']))).toBe('liste d’exclusion');
    const force = preparer(await lireLaSource(`scenario:${SCENARIO}`), { maintenant: VENDREDI, ...contenu, forcer: ['b-t1'] });
    expect(force.bars.map((b) => b.nom)).toContain('L’Essai');
    expect(force.bars.map((b) => b.nom)).not.toContain('TestBar');
    // Un bar de la liste des bars publiés écarté comme bar d’essai : toujours dit dans le journal, avec son seul
    // identifiant, le mot et la façon de le remettre ; plus rien une fois réintégré.
    const avertissementDe = (id, mot, ou) => `Bar ${id} écarté alors qu’il est dans la liste des bars publiés : « ${mot} » dans ${ou} le fait passer pour un bar d’essai. Si c’est un vrai bar, écris son identifiant dans « forcer » (generateur/bars-exclus.json).`;
    expect(donnees.avertissements).toEqual(expect.arrayContaining([avertissementDe('b-t1', 'essai', 'son nom'), avertissementDe('b-demo', 'demo', 'son nom'), avertissementDe('b-x7', 'test', 'son nom')]));
    expect(donnees.avertissements.filter((a) => a.includes('bar d’essai'))).toHaveLength(3);
    expect(donnees.avertissements.join('\n')).not.toContain('L’Essai');
    expect(force.avertissements.filter((a) => a.startsWith('Bar b-t1 '))).toEqual([]);
    // La liste « forcer » existe dans bars-exclus.json, vide, et son mode d’emploi est écrit à côté.
    const fichierExclus = JSON.parse(readFileSync(path.join(racine, 'generateur', 'bars-exclus.json'), 'utf8'));
    expect(fichierExclus.forcer).toEqual([]);
    expect(fichierExclus._lisezMoi).toContain('L’Essai');
    expect(fichierExclus._lisezMoi).toContain('mot entier');
    expect(fichierExclus._lisezMoi).toContain('journal');
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

  test('un club sans lettre latine : l’adresse du match prend son identifiant, jamais « --2026-10-26 », et aucun faux doublon', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const PSG = { slug: 'paris-saint-germain', canonicalName: 'Paris Saint-Germain' };
    brut.matches.push(
      { id: 'cmshakhtar01', startAt: '2026-10-26T17:45:00.000Z', league: 'Ligue des champions', homeTeam: 'Шахтар Донецьк', awayTeam: 'Динамо Київ', homeClub: null, awayClub: null },
      { id: 'cmzenit02', startAt: '2026-10-26T17:45:00.000Z', league: 'Premier League russe', homeTeam: 'Зенит', awayTeam: 'Спартак', homeClub: null, awayClub: null },
      { id: 'cmpsg03', startAt: '2026-10-29T20:00:00.000Z', league: 'Ligue des champions', homeTeam: 'Шахтар Донецьк', awayTeam: 'Paris Saint-Germain', homeClub: null, awayClub: PSG },
    );
    const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu });
    const parId = (id) => donnees.matchs.find((m) => m.ids.includes(id));
    // Deux matchs à la même heure entre clubs sans lettre latine : deux matchs, pas un doublon.
    expect(parId('cmshakhtar01')).not.toBe(parId('cmzenit02'));
    expect(['cmshakhtar01', 'cmzenit02', 'cmpsg03'].map((id) => parId(id).slug)).toEqual(['match-cmshakhtar01-2026-10-26', 'match-cmzenit02-2026-10-26', 'match-cmpsg03-2026-10-29']);
    for (const m of donnees.matchs) expect(m.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    // Le nom s’affiche tel quel, et le club se reconnaît d’un match à l’autre.
    expect(parId('cmshakhtar01').domicile.court).toBe('Шахтар Донецьк');
    expect(parId('cmshakhtar01').domicile.cle).toBe(parId('cmpsg03').domicile.cle);
    expect(parId('cmshakhtar01').domicile.cle).not.toBe(parId('cmzenit02').domicile.cle);
    // Un club que l’appli nomme en lettres latines garde l’adresse faite de ce nom.
    expect(clubDe(indexerLesClubs(contenu.clubs), { slug: 'shakhtar-donetsk', canonicalName: 'Шахтар Донецьк' }).cle).toBe('shakhtar-donetsk');
    // Les pages : à leur adresse, contrôlées, et le prochain match du club mène à la sienne.
    const site = await construireEnMemoire({ brut, maintenant: VENDREDI, racine, contenu });
    expect(site.refusees.map((p) => p.chemin)).toEqual([]);
    const page = site.pages.find((p) => p.chemin === '/matchs/match-cmshakhtar01-2026-10-26/');
    expect(page.contenu).toContain('<p class="regarder-affiche">Шахтар Донецьк – Динамо Київ</p>');
    expect(page.contenu).toContain('<a href="/matchs/match-cmpsg03-2026-10-29/">Шахтар Донецьк – PSG</a>');
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
    expect(offre('Le Comptoir du Canal', 'psg-barca-2026-10-24')).toEqual({ titre: 'Menu burger et frites maison', prixCentimes: 1500, jusqua: Date.parse('2026-10-24T18:00:00.000Z') });
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
    expect(donnees.avertissements.filter((a) => a.startsWith('Offre'))).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« happy hour »), ce que le site ne publie pas']);
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
    // Les mots de l’appli, lus comme elle (les cas de ses propres tests) : seul « sans alcool » y échappe.
    const casDeLAppli = [
      ['Pinte 5 €', 'Pinte'], ['La pinte à 5 €', 'pinte'], ['2 DEMIS achetés, le 3e offert', 'DEMIS'], ['Bière pression 4 €', 'Bière'],
      ['biere a 4 euros', 'biere'], ['Verre de vin rouge', 'vin'], ['Rosé bien frais', 'Rosé'], ['Coupe de champagne si Paris gagne', 'champagne'],
      ['Cocktails à 8 €', 'Cocktails'], ['Shot offert à chaque but', 'Shot'], ['Whisky coca', 'Whisky'], ['Gin tonic 9 €', 'Gin'],
      ['Apéro jusqu’au coup d’envoi', 'Apéro'], ['Planche apéritive et 2 apéritifs', 'apéritive'], ['Bière sans alcool 4 €', null],
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
    const remises = ['Burger -20 %', '-50% sur la carte', '50 % sur les planches', '30 % de réduction', 'Tout à 50 % pendant le match', 'Frites à moitié prix', 'Tarif réduit pendant le match',
      'Réduction sur le menu', 'Remise de 2 € sur les planches', '-3 € sur le menu', 'Nachos offerts', 'Planche offerte avec le menu', 'Café gratuit',
      '3 pour 2 sur les softs', 'Softs à volonté', 'Planches illimitées', 'Promo sur les burgers', 'Menu à 10 € au lieu de 15 €', 'Happyhour',
      'Un soft par but du PSG'];
    for (const titre of remises) expect(offreInterdite(titre), titre).not.toBeNull();
    for (const titre of ['Menu burger et boisson fraîche', 'Planche à partager', 'Burger du match · frites maison', 'Demi-finale : planche du soir', 'Menu pour 2 à 25 €', 'Burger 100 % maison']) {
      expect(offreInterdite(titre), titre).toBeNull();
    }
    const remise = offreDu('Burger -20 %');
    expect(remise.offre).toEqual({ dansLAppli: true });
    expect(remise.avertissements).toContain('Offre de « Le Comptoir du Canal » non affichée : elle parle d’une remise ou d’une gratuité (« -20 % »), ce que le site ne publie pas');
    expect(offreDu('Burger, et le score en direct').avertissements).toContain('Offre de « Le Comptoir du Canal » non affichée : elle parle du score (« score »), ce que le site ne publie pas');
    // Le nom d’un bar n’est écarté que si la remise ou la gratuité touche une boisson : « Le Réduit » reste un bar.
    for (const nom of ['Le Réduit', 'Le Cadeau', 'La Cave à Bières', 'Le 1664', 'Les Promos', 'Le 100 % Bière']) expect(nomInterdit(nom), nom).toBeNull();
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

  test('l’ordre annoncé (« Comment on choisit les bars ») : la ville, l’arrondissement, puis le nom, quel que soit l’ordre reçu', async () => {
    // Au Bon Coin et La Cave des Gones, tous deux à Lyon 2e, diffusent PSG – OL ; les soirées arrivent à l’envers.
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.matchNights.push({ id: 'n-coin-psg-ol', status: 'OPEN', bar: { id: 'b-coin' }, match: { id: 'm-psg-ol' }, offer: null });
    const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu });
    for (const m of donnees.matchs) m.soirees.reverse();
    for (const b of donnees.bars) b.soirees.reverse();
    donnees.bars.reverse();
    const { pages } = fabriquerLesPages({ donnees, contenu, cadre: lireLeCadre(racine) });
    const nomsDe = (chemin) => [...pages.find((p) => p.chemin === chemin).contenu.matchAll(/<h[345] class="regarder-carte__nom"><a href="\/bar\/[^"]+">([^<]+)<\/a>/g)].map((m) => m[1]);
    // Lyon avant Paris ; à Paris, le 10e avant le 11e (la page de la ville) ; à Lyon 2e, « Au Bon Coin » avant « La Cave des Gones ».
    expect(nomsDe('/matchs/psg-ol-2026-10-25/')).toEqual(['Au Bon Coin', 'La Cave des Gones', 'Le Zinc des Amis']);
    expect(nomsDe('/regarder-le-match/lyon/')).toEqual(['Au Bon Coin', 'La Cave des Gones']);
    expect(nomsDe('/regarder-le-match/paris/')).toEqual(['Le Comptoir du Canal', 'Le Zinc des Amis']);
  });

  test('l’ordre annoncé, aussi dans « Les prochaines soirées » d’une ville : l’heure, puis la ville, l’arrondissement et le nom', async () => {
    // À la Lucarne (Paris 11e) diffuse PSG – Barça, comme le Comptoir (10e) et le Zinc (11e) : son nom passe devant le
    // leur dans l’alphabet, son arrondissement après le 10e.
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.bars.push({ id: 'b-lucarne', name: 'À la Lucarne', address: '3 Rue de Lappe, 75011 Paris', isActive: true });
    brut.matchNights.push({ id: 'n-lucarne-barca', status: 'OPEN', bar: { id: 'b-lucarne' }, match: { id: 'm-psg-barca-fr' }, offer: null });
    const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-lucarne'] });
    for (const b of donnees.bars) b.soirees.reverse();
    donnees.bars.reverse();
    const { pages } = fabriquerLesPages({ donnees, contenu, cadre: lireLeCadre(racine) });
    const paris = pages.find((p) => p.chemin === '/regarder-le-match/paris/').contenu;
    const soirees = paris.split('id="titre-soirees"')[1].split('</section>')[0];
    const lignes = [...soirees.matchAll(/<li>(?:<a href="[^"]+">)?([^<]+)(?:<\/a>)? · <time[^>]*>[^<]*<\/time> · <a href="\/bar\/[^"]+">([^<]+)<\/a>, ([^<]+)<\/li>/g)].map((m) => `${m[1]} · ${m[2]}, ${m[3]}`);
    expect(lignes).toEqual([
      'PSG – Barça · Le Comptoir du Canal, Paris 10e',
      'PSG – Barça · À la Lucarne, Paris 11e',
      'PSG – Barça · Le Zinc des Amis, Paris 11e',
      'PSG – OL · Le Zinc des Amis, Paris 11e',
      'Le Havre – PSG · Le Comptoir du Canal, Paris 10e',
    ]);
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
    // L’appli fermée : la réponse renvoie au formulaire de la liste d’attente, sur la page même, plus à l’accueil.
    expect(contenu.marque.appli.ouverte).toBe(false);
    expect(contenu.textes.ville.appliFermee).not.toMatch(/accueil/);
    expect(contenu.textes.ville.appliFermee).toContain('laisse ton adresse dans le formulaire de cette page');
    expect(paris.contenu).toContain('<form class="attente" id="attente"');
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
      // Son titre ne promet pas de bars : la question de la page, son h1.
      expect(p.titre).toMatch(/^Où regarder le match à (Marseille|Lille) — Baromatch$/);
      expect(robotsDe(p)).toBe('noindex');
      expect(p.contenu).toMatch(/Aucun bar de (Marseille|Lille) n’est encore sur Baromatch\./);
      expect(deType(p, 'FAQPage')[0].mainEntity[0].acceptedAnswer.text).toMatch(/^Pas encore de bar à (Marseille|Lille) sur Baromatch\. L’appli, elle, est en test/);
      expect(deType(p, 'ItemList')).toEqual([]);
    }
  });

  test('un match sans vrai bar : noindex, et le lien « Tu tiens un bar ? » vers Pour les bars', () => {
    const p = pageDe('/matchs/lille-lens-2026-10-26/');
    expect(p.indexable).toBe(false);
    // Son titre, son h1, son aperçu et le texte envoyé sur WhatsApp ne promettent aucun bar : « où le regarder ».
    expect(p.titre).toBe('Lille – Lens, lundi 26 octobre : où le regarder — Baromatch');
    expect(p.contenu).toContain(insecables('<h1 class="regarder-titre">Lille – Lens : où le regarder</h1>'));
    expect(p.contenu).toContain(`<meta property="og:title" content="${insecables(p.titre)}">`);
    expect(p.contenu).toContain(`https://wa.me/?text=${encodeURIComponent(`${p.titre} https://baromatch.fr${p.chemin}`)}`);
    expect(`${p.titre} ${p.contenu.match(/<h1[^>]*>([^<]*)/)[1]}`).not.toMatch(/bars? qui|diffus/);
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
    expect(match.contenu).toContain(`https://wa.me/?text=${encodeURIComponent(`${match.titre} https://baromatch.fr${match.chemin}`)}`);
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
    expect(soiree).toContain('Menu burger et frites maison · 15\u00A0€ · jusqu’à 20:00');
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
    // Le titre de la page dit ce que dit son h1 (la semaine, pas « ce soir », qui a sa page), entre 15 et 60 caractères.
    expect(p.titre).toBe('Les matchs de la semaine et où les voir — Baromatch');
    expect(p.titre).toBe(`${contenu.textes.semaine.titre} — Baromatch`);
    expect(p.contenu).toContain(`<h1 class="regarder-titre">${contenu.textes.semaine.titre}</h1>`);
    expect(p.titre.length).toBeGreaterThanOrEqual(15);
    expect(p.titre.length).toBeLessThanOrEqual(60);
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

  test('un match reporté ou annulé le dit partout où il est listé : la semaine, la ville, le bar, les prochains matchs, en anglais aussi', async () => {
    // PSG – OL (dimanche 25, le Zinc) reporté ; Le Havre – PSG (vendredi 30, le Comptoir) annulé.
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    brut.matches = brut.matches.map((m) => (m.id === 'm-psg-ol' ? { ...m, status: 'POSTPONED' } : m.id === 'm-lehavre-psg' ? { ...m, status: 'CANCELLED' } : m));
    const enMemoire = (instant, anciens) => construireEnMemoire({ brut: structuredClone(brut), maintenant: Date.parse(instant), racine, contenu, anciens });
    const autre = await enMemoire('2026-10-23T08:00:00Z');
    const page = (chemin) => autre.pages.find((p) => p.chemin === chemin).contenu;
    const ligneDe = (html, debut) => html.split('\n').find((l) => l.includes(debut));
    const reporte = '<strong>Match reporté</strong>';
    const annule = '<strong>Match annulé</strong>';
    // La semaine : le statut à la place des bars, ce jour-là comme la semaine d’après.
    expect(ligneDe(page('/matchs/'), '>PSG – OL</a>')).toContain(` · ${reporte}</li>`);
    expect(ligneDe(page('/matchs/'), '>PSG – OL</a>')).not.toContain('regarder-compte');
    expect(ligneDe(page('/matchs/'), '>Le Havre – PSG</a>')).toContain(` · ${annule}</li>`);
    expect(ligneDe(page('/matchs/'), '>PSG – Barça</a>')).not.toMatch(/Match reporté|Match annulé/);
    // « Les prochaines soirées à Paris » : chaque soirée du match.
    const soirees = page('/regarder-le-match/paris/').split('id="titre-soirees"')[1].split('</section>')[0];
    expect(ligneDe(soirees, '>PSG – OL</a>')).toMatch(new RegExp(`</time> · ${reporte} · <a href="/bar/le-zinc-des-amis-paris-11/#soiree-psg-ol-2026-10-25">`));
    expect(ligneDe(soirees, '>Le Havre – PSG</a>')).toContain(`</time> · ${annule} · <a href="/bar/le-comptoir-du-canal-paris-10/`);
    // La page du bar : la soirée, sous son jour et sa compétition.
    expect(page('/bar/le-zinc-des-amis-paris-11/')).toContain(`<p class="regarder-carte__lieu"><time datetime="2026-10-25T20:45:00+01:00">dimanche 25 octobre · 20:45</time> · Ligue 1 · ${reporte}</p>`);
    expect(page('/bar/le-comptoir-du-canal-paris-10/')).toContain(`· Ligue 1 · ${annule}</p>`);
    // « PSG et Barça : leurs prochains matchs », et en anglais « What’s next ».
    const prochains = page('/matchs/psg-barca-2026-10-24/').split('id="titre-prochains"')[1].split('</section>')[0];
    expect(ligneDe(prochains, '>PSG – OL</a>')).toContain(` · Ligue 1 · ${reporte}</li>`);
    expect(ligneDe(prochains, '>Le Havre – PSG</a>')).toContain(` · Ligue 1 · ${annule}</li>`);
    const enAnglais = page('/en/matches/psg-barca-2026-10-24/').split('id="titre-prochains"')[1].split('</section>')[0];
    expect(ligneDe(enAnglais, 'Paris Saint-Germain v Olympique Lyonnais')).toContain(' · Ligue 1 · <strong>Match postponed</strong></li>');
    expect(ligneDe(enAnglais, 'Le Havre AC v Paris Saint-Germain')).toContain(' · Ligue 1 · <strong>Match cancelled</strong></li>');
    // Le lundi, PSG – Barça est passé : « le prochain match » de sa page le dit aussi, en français et en anglais.
    const lundi = await enMemoire('2026-10-26T08:00:00Z', {
      matchs: autre.pages.filter((p) => p.type === 'match').map((p) => ({ ...p.memoire, debut: Date.parse(p.memoire.debut) })), bars: [], adresses: {},
    });
    const passe = lundi.pages.find((p) => p.chemin === '/matchs/psg-barca-2026-10-24/').contenu;
    expect(passe).toContain(`<a href="/matchs/le-havre-psg-2026-10-30/">Le Havre – PSG</a>, <time datetime="2026-10-30T19:00:00+01:00">vendredi 30 octobre · 19:00</time> · ${annule}.</p>`);
    const passeEnAnglais = lundi.pages.find((p) => p.chemin === '/en/matches/psg-barca-2026-10-24/').contenu;
    expect(passeEnAnglais).toContain('Le Havre AC v Paris Saint-Germain</a>, <time datetime="2026-10-30T19:00:00+01:00">Fri 30 Oct, 7:00 pm (Paris time)</time> · <strong>Match cancelled</strong>.</p>');
    // Chaque page passe toujours le contrôle.
    expect([...autre.refusees, ...lundi.refusees]).toEqual([]);
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
      // Une page en anglais (anglais.mjs) part de « Baromatch » : l’accueil est en français.
      expect(fil.itemListElement[0], p.chemin).toMatchObject({ position: 1, name: p.langue === 'en' ? 'Baromatch' : 'Accueil', item: 'https://baromatch.fr/' });
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
    // Aucun titre de match ni de ville ne promet de bars, en français comme en anglais, même coupé (des noms longs).
    const sansBar = capture.pages.filter((p) => ['match', 'match-en', 'ville'].includes(p.type));
    expect(sansBar.length).toBeGreaterThan(40);
    for (const p of sansBar) {
      expect(`${p.titre} · ${p.contenu.match(/<h1[^>]*>([^<]*)/)[1]}`, p.chemin).not.toMatch(/(?<!\p{L})bars?(?!\p{L})|diffus/iu);
      expect(p.titre.length, p.chemin).toBeLessThanOrEqual(60);
    }
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
  // Les fichiers écrits par le générateur (matchs/ et l’affiche de la semaine, regarder-le-match/, bar/ et les affiches des
  // bars, ce-soir/, en/, agenda/), relatifs au dossier.
  const fichiersGeneres = (sortie, dossier = '') => (dossier ? readdirSync(path.join(sortie, dossier)) : ['matchs', 'regarder-le-match', 'bar', 'ce-soir', 'en', 'agenda'].filter((d) => existsSync(path.join(sortie, d))))
    .flatMap((nom) => {
      const relatif = dossier ? path.posix.join(dossier, nom) : nom;
      return statSync(path.join(sortie, relatif)).isDirectory() ? fichiersGeneres(sortie, relatif) : [relatif];
    });
  // Chaque lien (et chaque adresse des données structurées) d’une page écrite vers une page générée qui n’existe pas.
  const liensVersDesPagesAbsentes = (sortie) => fichiersGeneres(sortie).filter((f) => f.endsWith('.html'))
    .flatMap((f) => [...lire(sortie, f).matchAll(/(?:href="|"https:\/\/baromatch\.fr)(\/(?:matchs|regarder-le-match|bar|ce-soir|en|agenda)\/(?:[a-z0-9-]+\/)*)/g)]
      .map((m) => m[1]).filter((chemin) => !existsSync(path.join(sortie, chemin, 'index.html'))).map((chemin) => `${f} → ${chemin}`));

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

  test('un bar qui n’est plus publié : l’adresse de sa page (qui porte son nom) quitte l’état public au plus tard avec sa page', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    expect(etatDe(sortie).adresses['le-zinc-des-amis-paris-11']).toBe('b-zinc');
    // Retiré de la liste des bars publiés : son nom quitte les adresses données ; seule sa page « n’est plus sur
    // Baromatch » garde son adresse, le temps qu’elle existe (30 jours).
    const sansZinc = { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') };
    await passer(sortie, '2026-10-22T08:00:00Z', { contenu: sansZinc });
    expect(etatDe(sortie).adresses['le-zinc-des-amis-paris-11']).toBeUndefined();
    expect(Object.keys(etatDe(sortie).pages).filter((chemin) => chemin.includes('zinc'))).toEqual(['/bar/le-zinc-des-amis-paris-11/', '/bar/le-zinc-des-amis-paris-11/badge.svg']);
    // 30 jours après sa sortie, sa page disparaît, et avec elle le dernier mot de son nom dans l’état.
    await passer(sortie, '2026-11-22T08:00:00Z', { contenu: sansZinc });
    expect(existsSync(path.join(sortie, 'bar/le-zinc-des-amis-paris-11'))).toBe(false);
    expect(lire(sortie, 'regarder-le-match/etat.json')).not.toMatch(/zinc/i);

    // Pendant ces 30 jours, un autre bar du même nom ne prend pas son adresse : la page du premier l’occupe encore.
    const autre = dossierVide();
    await passer(autre, '2026-10-21T08:00:00Z');
    await passer(autre, '2026-10-22T08:00:00Z', { contenu: sansZinc });
    const homonyme = scenarioSans(autre, (brut) => ({ ...brut, bars: [...brut.bars, { id: 'b-zzz', name: 'Le Zinc des Amis', address: '14 Rue Oberkampf, 75011 Paris', isActive: true }] }));
    await passer(autre, '2026-10-23T08:00:00Z', { source: homonyme, contenu: { ...sansZinc, publies: [...sansZinc.publies, 'b-zzz'] } });
    expect(etatDe(autre).adresses).toMatchObject({ 'le-zinc-des-amis-paris-11-2': 'b-zzz' });
    expect(lire(autre, 'bar/le-zinc-des-amis-paris-11/index.html')).toContain('Ce bar n’est plus sur Baromatch.');

    // Le mode d’emploi le dit, dans les deux listes publiques.
    const publies = JSON.parse(readFileSync(path.join(racine, 'generateur', 'bars-publies.json'), 'utf8'))._lisezMoi;
    const exclus = JSON.parse(readFileSync(path.join(racine, 'generateur', 'bars-exclus.json'), 'utf8'))._lisezMoi;
    for (const texte of [publies, exclus]) {
      expect(texte).toContain('demande à ne plus apparaître');
      expect(texte).toContain('30 jours');
      expect(texte).toContain('etat.json');
    }
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

  test('une page refusée garde sa version précédente 24 heures au plus sans arrêter le passage ; une erreur du gabarit commun l’arrête', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const fichier = 'bar/au-bon-coin-lyon-2/index.html';
    const avant = { page: lire(sortie, fichier), badge: lire(sortie, 'bar/au-bon-coin-lyon-2/badge.svg'), etat: etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/'] };
    // L’état dit quels bars chaque page nomme : ici, le bar lui-même.
    expect(avant.etat.bars).toEqual(['b-coin']);
    // Un texte faux sur les seules pages des bars sans soirée : elles sont refusées, les autres passent.
    const faux = structuredClone(contenu);
    faux.textes.bar.sansSoiree = 'Pas de soirée annoncée pour l’instant !';
    const resultat = await passer(sortie, '2026-10-23T10:00:00Z', { contenu: faux });
    expect(resultat.avertissements.some((a) => a.startsWith('Page refusée, sa version précédente reste en ligne : /bar/au-bon-coin-lyon-2/'))).toBe(true);
    expect(lire(sortie, fichier)).toBe(avant.page);
    expect(lire(sortie, 'bar/au-bon-coin-lyon-2/badge.svg')).toBe(avant.badge);
    expect(etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/']).toEqual({ ...avant.etat, gardeeDepuis: '2026-10-23T10:00:00.000Z' });
    expect(plan(sortie)).toContain('/bar/au-bon-coin-lyon-2/</loc>');
    expect(resultat.supprimees).toEqual([]);
    // Toujours refusée le lendemain matin : gardée, depuis la même heure.
    await passer(sortie, '2026-10-24T09:00:00Z', { contenu: faux });
    expect(lire(sortie, fichier)).toBe(avant.page);
    expect(etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/'].gardeeDepuis).toBe('2026-10-23T10:00:00.000Z');
    // 24 heures après : elle vieillit, une page neutre la remplace (noindex, hors du plan du site, badge générique).
    const lendemain = await passer(sortie, '2026-10-24T10:00:00Z', { contenu: faux });
    expect(lendemain.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, remplacée par une page neutre : \/bar\/au-bon-coin-lyon-2\/ .* sa version précédente ne reste pas : elle est gardée depuis plus de 24 heures$/));
    const neutre = lire(sortie, fichier);
    expect(neutre).toContain('<h1 class="regarder-titre">Cette page se met à jour</h1>');
    expect(neutre).toContain('<meta name="robots" content="noindex">');
    expect(neutre).not.toContain('Bon Coin');
    expect(lire(sortie, 'bar/au-bon-coin-lyon-2/badge.svg')).not.toContain('Bon Coin');
    expect(plan(sortie)).not.toContain('/bar/au-bon-coin-lyon-2/');
    expect(etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/']).toMatchObject({ repli: true, indexable: false, bars: [], memoire: { id: 'b-coin' } });
    expect(lendemain.changees).toContain('https://baromatch.fr/bar/au-bon-coin-lyon-2/');
    // Le texte réparé, la vraie page revient.
    await passer(sortie, '2026-10-24T13:00:00Z');
    expect(lire(sortie, fichier)).toContain('<h1 class="regarder-titre">Au Bon Coin</h1>');
    expect(etatDe(sortie).pages['/bar/au-bon-coin-lyon-2/'].repli).toBeUndefined();
    // Le fil d’Ariane de chaque page faux : toutes refusées, rien n’est écrit.
    const gabarit = structuredClone(contenu);
    gabarit.textes.fil.accueil = 'Accueil !';
    const etatAvant = lire(sortie, 'regarder-le-match/etat.json');
    await expect(passer(sortie, '2026-10-24T14:00:00Z', { contenu: gabarit })).rejects.toThrow(/Pages refusées, rien n’est écrit/);
    expect(lire(sortie, 'regarder-le-match/etat.json')).toBe(etatAvant);
  });

  test('une page refusée qui nomme un bar retiré ne reste pas : une page neutre la remplace, et aucun lien ne mène à une page absente', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-21T08:00:00Z');
    expect(lire(sortie, 'matchs/psg-ol-2026-10-25/index.html')).toContain('Le Zinc des Amis');
    // Le Zinc retire son accord, au passage même où un texte faux fait refuser chaque page de match à venir.
    const faux = structuredClone(contenu);
    faux.publies = PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc');
    faux.textes.match.titreBars = 'Les bars qui le diffusent !';
    const resultat = await passer(sortie, '2026-10-21T09:00:00Z', { contenu: faux });
    // La page qui nommait le Zinc : la page neutre, sans son nom.
    const page = lire(sortie, 'matchs/psg-ol-2026-10-25/index.html');
    expect(page).not.toContain('Zinc');
    expect(page).toContain('<h1 class="regarder-titre">Cette page se met à jour</h1>');
    expect(page).toContain('<a href="/matchs/">Les matchs de la semaine</a>');
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(resultat.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, remplacée par une page neutre : \/matchs\/psg-ol-2026-10-25\/ .* sa version précédente ne reste pas : elle nomme un bar qui n’est plus publié \(b-zinc\)$/));
    // Celle qui ne nommait que des bars encore publiés garde sa version précédente.
    expect(resultat.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, sa version précédente reste en ligne : \/matchs\/brest-nice-2026-10-23\//));
    // Son nom n’est plus nulle part : ni une page, ni un badge, ni l’état ; et chaque lien mène à une page qui existe.
    expect(fichiersGeneres(sortie).filter((f) => lire(sortie, f).includes('Zinc des Amis'))).toEqual([]);
    expect(liensVersDesPagesAbsentes(sortie)).toEqual([]);
    // La page neutre garde la mémoire du match : le texte réparé, sa vraie page revient.
    await passer(sortie, '2026-10-21T10:00:00Z', { contenu: { ...contenu, publies: faux.publies } });
    const revenue = lire(sortie, 'matchs/psg-ol-2026-10-25/index.html');
    expect(revenue).toContain('La Cave des Gones');
    expect(revenue).not.toContain('Zinc');
  });

  test('« Ce soir », une page en anglais, refusées au passage où un bar qu’elles nomment est retiré : leur version précédente ne reste pas', async () => {
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    // « Ce soir » nomme La Cave des Gones (Brest – Nice), /en/ le Zinc et le Comptoir ; l’état le dit.
    expect(lire(sortie, 'ce-soir/index.html')).toContain('La Cave des Gones');
    expect(etatDe(sortie).pages['/ce-soir/'].bars).toEqual(['b-gones']);
    expect(lire(sortie, 'en/index.html')).toContain('Le Zinc des Amis');
    expect(etatDe(sortie).pages['/en/'].bars.sort()).toEqual(['b-comptoir', 'b-zinc']);
    // Les autres pages qui ne nomment aucun bar le disent aussi : la semaine, l’agenda, l’affiche de la semaine.
    for (const chemin of ['/matchs/', '/agenda/', '/matchs/affiche/']) expect(etatDe(sortie).pages[chemin].bars, chemin).toEqual([]);
    expect(etatDe(sortie).pages['/bar/la-cave-des-gones-lyon-2/affiche/'].bars).toEqual(['b-gones']);
    // La Cave des Gones et le Zinc retirent leur accord, au passage même où un texte faux fait refuser « Ce soir » et le
    // guide de Paris en anglais.
    const faux = structuredClone(contenu);
    faux.publies = PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-gones' && id !== 'b-zinc');
    faux.textes.ceSoir.fil = 'Ce soir !';
    faux.anglais = { ...structuredClone(TEXTES_EN), paris: { ...TEXTES_EN.paris, chapeau: `${TEXTES_EN.paris.chapeau} !` } };
    const resultat = await passer(sortie, '2026-10-23T09:00:00Z', { contenu: faux });
    for (const [chemin, bar] of [['/ce-soir/', 'b-gones'], ['/en/', 'b-zinc']]) {
      expect(resultat.avertissements, chemin).toContainEqual(expect.stringMatching(new RegExp(`^Page refusée, remplacée par une page neutre : ${chemin} .* elle nomme un bar qui n’est plus publié \\([^)]*${bar}[^)]*\\)$`)));
    }
    for (const fichier of ['ce-soir/index.html', 'en/index.html']) {
      expect(lire(sortie, fichier), fichier).toContain('<h1 class="regarder-titre">Cette page se met à jour</h1>');
      expect(lire(sortie, fichier), fichier).toContain('<meta name="robots" content="noindex">');
    }
    // Leurs noms ne sont plus nulle part (pages, affiches, agendas, en anglais) ; chaque lien mène à une page qui existe.
    expect(fichiersGeneres(sortie).filter((f) => /La Cave des Gones|Le Zinc des Amis/.test(lire(sortie, f)))).toEqual([]);
    expect(fichiersGeneres(sortie)).toEqual(expect.arrayContaining(['ce-soir/index.html', 'en/index.html', 'agenda/index.html', 'matchs/affiche/index.html']));
    expect(liensVersDesPagesAbsentes(sortie)).toEqual([]);
  });

  test('une page nouvelle refusée : une page neutre à son adresse, jamais un lien vers une page absente', async () => {
    const sortie = dossierVide();
    const faux = structuredClone(contenu);
    faux.textes.match.titreBars = 'Les bars qui le diffusent !';
    const resultat = await passer(sortie, '2026-10-23T08:00:00Z', { contenu: faux });
    expect(liensVersDesPagesAbsentes(sortie)).toEqual([]);
    expect(lire(sortie, 'matchs/psg-ol-2026-10-25/index.html')).toContain('<h1 class="regarder-titre">Cette page se met à jour</h1>');
    expect(resultat.avertissements).toContainEqual(expect.stringMatching(/^Page refusée, remplacée par une page neutre : \/matchs\/psg-ol-2026-10-25\/ .* sa version précédente ne reste pas : elle n’a pas de version précédente$/));
    // Le passage normal, lui non plus, n’a aucun lien vers une page absente.
    const normal = dossierVide();
    await passer(normal, '2026-10-23T08:00:00Z');
    expect(liensVersDesPagesAbsentes(normal)).toEqual([]);
  });

  test('une version précédente reste seulement si l’état dit quels bars elle nomme, tous publiés, et si chaque page qu’elle cite existe', () => {
    const html = '<a href="/matchs/psg-ol-2026-10-25/">PSG – OL</a> <a href="/bar/le-zinc-des-amis-paris-11/#soiree-x">Zinc</a> "url":"https://baromatch.fr/regarder-le-match/paris/"';
    expect(adressesCitees(html)).toEqual(['/matchs/psg-ol-2026-10-25/', '/bar/le-zinc-des-amis-paris-11/', '/regarder-le-match/paris/']);
    const existantes = new Set(adressesCitees(html));
    const maintenant = Date.parse('2026-10-23T08:00:00Z');
    const sure = { avant: { type: 'match', bars: ['b-zinc'] }, html, publies: new Set(['b-zinc']), existantes, maintenant };
    expect(raisonDeNePasGarder(sure)).toBeNull();
    expect(raisonDeNePasGarder({ ...sure, avant: { type: 'match' } })).toBe('l’état ne dit pas quels bars elle nomme');
    expect(raisonDeNePasGarder({ ...sure, publies: new Set() })).toBe('elle nomme un bar qui n’est plus publié (b-zinc)');
    expect(raisonDeNePasGarder({ ...sure, existantes: new Set(['/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/']) })).toBe('elle mène à une page qui n’existe plus (/bar/le-zinc-des-amis-paris-11/)');
    expect(raisonDeNePasGarder({ ...sure, html: null })).toBe('elle n’a pas de version précédente');
    expect(raisonDeNePasGarder({ ...sure, imageManquante: true })).toBe('son image de partage n’est plus là');
    expect(raisonDeNePasGarder({ ...sure, avant: { ...sure.avant, gardeeDepuis: '2026-10-22T08:00:01Z' } })).toBeNull();
    expect(raisonDeNePasGarder({ ...sure, avant: { ...sure.avant, gardeeDepuis: '2026-10-22T08:00:00Z' } })).toBe('elle est gardée depuis plus de 24 heures');
  });

  test('une offre ordinaire ne fait refuser aucune page, et aucune offre n’est jamais dans la tête d’une page', async () => {
    const sortie = dossierVide();
    // Le Burger Club propose « Burger » : son nom est dans les titres de ses pages ; les autres offres deviennent uniques.
    const source = scenarioSans(sortie, (brut) => ({
      ...brut,
      bars: [...brut.bars, { id: 'b-burger', name: 'Le Burger Club', address: '30 Rue de Lappe, 75011 Paris', isActive: true }],
      matchNights: [...brut.matchNights.map((n, i) => (n.offer ? { ...n, offer: { ...n.offer, title: `Planche Zorglub ${i}`, hasAlcohol: false } } : n)),
        { id: 'n-burger', status: 'OPEN', bar: { id: 'b-burger' }, match: { id: 'm-psg-ol' }, offer: { title: 'Burger', priceCents: 1200, until: null, hasAlcohol: false } }],
    }));
    const resultat = await passer(sortie, '2026-10-23T08:00:00Z', { source, contenu: { ...contenu, publies: [...PUBLIES_DU_SCENARIO, 'b-burger'] } });
    expect(resultat.avertissements.filter((a) => a.startsWith('Page refusée'))).toEqual([]);
    for (const fichier of ['bar/le-burger-club-paris-11/index.html', 'matchs/psg-ol-2026-10-25/index.html', 'regarder-le-match/paris/index.html']) {
      expect(lire(sortie, fichier), fichier).toContain('Le Burger Club');
    }
    expect(lire(sortie, 'bar/le-burger-club-paris-11/index.html')).toContain('</span> Burger · 12 €</p>');
    // Par construction, aucune offre dans la tête d’une page (titre, description, aperçus, données structurées).
    expect(lire(sortie, 'bar/le-comptoir-du-canal-paris-10/index.html')).toContain('Planche Zorglub');
    for (const f of resultat.fichiers.filter((x) => x.chemin.endsWith('/'))) expect(f.contenu.split('<body>')[0], f.chemin).not.toContain('Zorglub');
    expect(liensVersDesPagesAbsentes(sortie)).toEqual([]);
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

  test('un seul vrai bar publié, une semaine de passages : « Ce soir », agenda/ et les guides en anglais n’entrent ni ne sortent de l’index', async () => {
    // Le Zinc des Amis (Paris 11e), seul publié : il montre PSG – Barça (Ligue des champions, samedi 24) et PSG – OL
    // (dimanche 25), rien d’autre. Aucun match de Premier League dans le scénario.
    const sortie = dossierVide();
    const unBar = { ...contenu, publies: ['b-zinc'] };
    const guides = ['/ce-soir/', '/agenda/', '/en/', '/en/champions-league/', '/en/premier-league/'];
    const attendu = { '/ce-soir/': true, '/agenda/': true, '/en/': true, '/en/champions-league/': true, '/en/premier-league/': false };
    const drapeaux = () => Object.fromEntries(guides.map((chemin) => [chemin, etatDe(sortie).pages[chemin].indexable]));
    const ceSoir = () => lire(sortie, 'ce-soir/index.html');
    const passages = [
      // Vendredi 23, 10 h : ce soir, Brest – Nice, sans bar ; samedi et dimanche, le Zinc.
      ['2026-10-23T08:00:00Z', () => {
        expect(ceSoir()).toContain('Pas encore de bar sur Baromatch pour les matchs d’aujourd’hui.');
        expect(ceSoir()).toContain('<h2 id="titre-soirs">Les prochains soirs au bar</h2>\n  <h3 class="regarder-jour">Samedi 24 octobre</h3>');
        expect(ceSoir()).toContain('Ligue des champions · <a href="/bar/le-zinc-des-amis-paris-11/#soiree-psg-barca-2026-10-24">Le Zinc des Amis</a> (Paris 11e)</li>');
        expect(ceSoir()).toContain('<h3 class="regarder-jour">Dimanche 25 octobre</h3>');
      }],
      // Samedi 24, 20 h : ce soir, le Zinc montre PSG – Barça.
      ['2026-10-24T18:00:00Z', () => {
        expect(ceSoir()).toContain('<h2 id="titre-bars">Ce soir, dans un bar</h2>');
        expect(ceSoir()).not.toContain('id="titre-soirs"');
      }],
      // Lundi 26, mercredi 28, vendredi 30 : plus aucune soirée annoncée. Rien n’est promis.
      ['2026-10-26T08:00:00Z'], ['2026-10-28T19:00:00Z'], ['2026-10-30T08:00:00Z', () => {
        expect(ceSoir()).toContain('Pas encore de bar sur Baromatch pour les matchs d’aujourd’hui.');
        expect(ceSoir()).not.toMatch(/Zinc|regarder-carte__nom|id="titre-soirs"/);
        expect(lire(sortie, 'en/champions-league/index.html')).toContain('For now, no Paris bar on Baromatch has listed an upcoming European match.');
        expect(lire(sortie, 'en/champions-league/index.html')).not.toContain('<meta name="robots" content="noindex">');
      }],
    ];
    for (const [quand, verifier] of passages) {
      await passer(sortie, quand, { contenu: unBar, rendu: null });
      expect(drapeaux(), quand).toEqual(attendu);
      for (const chemin of guides) expect(plan(sortie).includes(`<loc>https://baromatch.fr${chemin}</loc>`), `${chemin} ${quand}`).toBe(attendu[chemin]);
      verifier?.();
    }
    // Le guide de la Ligue des champions garde le coup d’envoi du dernier match qu’un bar de Paris a montré : 30 jours
    // après, il sort de l’index ; /en/, « Ce soir » et agenda/ restent (le Zinc est toujours publié).
    expect(etatDe(sortie).pages['/en/champions-league/'].memoire).toEqual({ derniereSoiree: '2026-10-24T19:00:00.000Z' });
    await passer(sortie, '2026-11-23T18:00:00Z', { contenu: unBar, rendu: null });
    expect(drapeaux()).toEqual(attendu);
    await passer(sortie, '2026-11-23T20:00:00Z', { contenu: unBar, rendu: null });
    expect(drapeaux()).toEqual({ ...attendu, '/en/champions-league/': false });
    // Sans aucun vrai bar publié : tout en noindex.
    await passer(sortie, '2026-11-24T08:00:00Z', { contenu: { ...contenu, publies: [] }, rendu: null, accepterLesSuppressions: true });
    expect(drapeaux()).toEqual(Object.fromEntries(guides.map((chemin) => [chemin, false])));
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

  test('la liste blanche : rien d’autre que matchs/, regarder-le-match/, bar/, ce-soir/, en/, agenda/ et sitemap.xml n’est touché', async () => {
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
    expect(crees.sort()).toEqual(['agenda', 'bar', 'ce-soir', 'en', 'matchs', 'regarder-le-match', 'sitemap.xml']);
    const tous = ['agenda', 'bar', 'ce-soir', 'en', 'matchs', 'regarder-le-match'].flatMap((d) => fichiers(d));
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
    // quarante pages de matchs de septembre arrivées au bout de leurs 30 jours) s’arrête et le dit.
    const sortie = dossierVide();
    await passer(sortie, '2026-10-23T08:00:00Z');
    const etat = etatDe(sortie);
    for (let i = 1; i <= 40; i += 1) {
      const slug = `vieux-match-${i}-2026-09-01`;
      etat.pages[`/matchs/${slug}/`] = { type: 'match', cle: slug, date: '2026-09-01T18:00:00.000Z', empreinte: 'x', change: '2026-09-01', indexable: false,
        memoire: { slug, ids: [slug], debut: '2026-09-01T18:00:00.000Z', heureConfirmee: true, competition: 'Ligue 1', domicile: { cle: 'a', court: 'A', nom: 'A' }, exterieur: { cle: 'b', court: 'B', nom: 'B' } } };
    }
    writeFileSync(path.join(sortie, 'regarder-le-match/etat.json'), JSON.stringify(etat));
    const etatAvant = lire(sortie, 'regarder-le-match/etat.json');
    // Les pages du scénario : 21 en français (8 matchs, la semaine, 5 villes et leur index, 5 bars, « Ce soir »),
    // la page agenda/, 6 affiches à imprimer (celle de la semaine, une par vrai bar publié) et 6 pages en anglais
    // (3 guides, 3 matchs) : 34, et les 40 vieux matchs, 74 (30 vieux matchs n’en feraient plus la moitié).
    await expect(passer(sortie, '2026-10-23T09:00:00Z')).rejects.toThrow(/supprimerait 40 des 74 pages publiées : rien n’est écrit/);
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

  test('la copie enregistrée de ce soir, écrite : tout en noindex sauf l’affiche de la semaine, le plan du site inchangé à part elle', async () => {
    const sortie = dossierVide();
    const resultat = await construire({ source: `capture:${CAPTURE}`, sortie, maintenant: ENREGISTREMENT, racine, contenu });
    // L’affiche de la semaine est un outil fait des vrais matchs, qui ne nomme aucun bar : indexable même sans vrai bar
    // (tests/affiche.spec.mjs). Rien d’autre.
    expect(resultat.changees).toEqual(['https://baromatch.fr/matchs/affiche/']);
    expect(Object.entries(etatDe(sortie).pages).filter(([, p]) => p.indexable).map(([chemin]) => chemin)).toEqual(['/matchs/affiche/']);
    const sansLAffiche = plan(sortie).split('\n').filter((l) => !l.includes('<loc>https://baromatch.fr/matchs/affiche/</loc>')).join('\n');
    expect(sansLAffiche).toBe(readFileSync(path.join(racine, 'sitemap.xml'), 'utf8').replace(/\r\n/g, '\n'));
    expect(plan(sortie)).toContain('<loc>https://baromatch.fr/matchs/affiche/</loc>');
    expect(existsSync(path.join(sortie, 'bar'))).toBe(false);
  });
});

// ---------- L’Action et IndexNow ----------

test.describe('l’Action « Pages des matchs » et IndexNow', () => {
  const action = readFileSync(path.join(racine, '.github', 'workflows', 'pages-des-matchs.yml'), 'utf8').replace(/\r\n/g, '\n');

  test('l’Action : quand elle tourne, ce qu’elle peut, et qu’elle ne fait qu’un passage à la fois', () => {
    // Toutes les 3 heures, et juste après minuit à Paris, en heure d’été comme d’hiver : « Ce soir » passe au nouveau
    // jour quelques minutes après minuit, pas vers 1 h ou 2 h.
    const planifies = [...action.matchAll(/^ {4}- cron: '([^']+)'$/gm)].map((m) => m[1]);
    expect(planifies).toEqual(['17 */3 * * *', '5 22 * * *', '5 23 * * *']);
    expect(action.split('\n  workflow_dispatch:')[0].split('\n  schedule:\n')[1].split('\n').filter((l) => !l.trim().startsWith('#'))).toEqual([
      "    - cron: '17 */3 * * *'", "    - cron: '5 22 * * *'", "    - cron: '5 23 * * *'",
    ]);
    const quotidiens = planifies.filter((c) => /^\d+ \d+ \* \* \*$/.test(c)).map((c) => c.split(' ').map(Number));
    for (const jour of ['2026-07-01', '2026-10-24', '2026-10-26', '2027-01-15']) {
      const heures = quotidiens.map(([minute, heure]) => heureDeParis(Date.UTC(...jour.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)), heure, minute)));
      expect(heures, jour).toContain('00:05');
    }
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
    // Des actions à leur étiquette de version (vérifiées le 16 octobre 2026), Node 22 ; une seule installation, celle de
    // generateur/images : le rendu des images de partage et l’encodeur des QR codes des affiches, à leur version exacte
    // (npm ci, sans script d’installation), avant le générateur.
    expect([...action.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1])).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
    expect(action).toContain('node-version: 22');
    expect([...action.matchAll(/npm [^\n]*/g)].map((m) => m[0])).toEqual(['npm ci --ignore-scripts --no-audit --no-fund']);
    expect(action).toMatch(/\n {6}- name: Installer le rendu des images de partage\n {8}working-directory: generateur\/images\n {8}run: npm ci --ignore-scripts --no-audit --no-fund\n\n {6}- name: Construire et contrôler les pages\n/);
    expect(Object.keys(JSON.parse(readFileSync(path.join(racine, 'generateur/images/package.json'), 'utf8')).dependencies)).toEqual(['@resvg/resvg-js', 'qrcode-generator']);
    // Le générateur contre les listes publiques, les images exigées, lancé une seule fois (jamais dans l’étape qui a le
    // jeton : plus bas) ; seuls les chemins de la liste blanche sont enregistrés.
    expect(action.split('node generateur/construire.mjs --source=api --images=exiger --changees="$RUNNER_TEMP/changees.txt" $option')).toHaveLength(2);
    expect(action.match(/node generateur\/construire\.mjs[^\n]*/g)).toHaveLength(1);
    expect(action).toContain('for chemin in matchs regarder-le-match bar ce-soir en agenda sitemap.xml; do');
    expect(action).toContain("grep -vqE '^(matchs|regarder-le-match|bar|ce-soir|en|agenda)/|^sitemap\\.xml$'");
    expect(action).toContain('git pull -q --rebase --autostash origin main');
    // Le jeton n’est pas gardé dans la configuration de git (le générateur tourne sans lui) : seule l’étape qui envoie
    // le reçoit pour git, le temps de l’envoi, comme actions/checkout le fait lui-même ; la demande de publication à
    // Pages le reçoit aussi (elle appelle l’API de GitHub, pas git).
    expect(action).toMatch(/ {6}- uses: actions\/checkout@v7\n {8}with:\n {10}ref: main\n {10}fetch-depth: 0\n(?: {10}#.*\n)* {10}persist-credentials: false\n/);
    const etapes = action.split('\n      - ');
    const avecLeJeton = etapes.filter((etape) => etape.includes('github.token')).map((etape) => etape.split('\n')[0]);
    expect(avecLeJeton).toEqual(['name: Enregistrer et envoyer les pages qui ont changé', 'name: Demander la publication à GitHub Pages']);
    // Le générateur, qui lit des données venues de dehors, et la mesure d’audience qui le précède
    // (generateur/mesure.mjs) ne tournent jamais dans une étape qui reçoit le jeton : retiré de leur environnement, il
    // resterait lisible (/proc). Chacun est lancé une fois, dans l’étape sans jeton ; un envoi refusé ne les relance pas
    // (tests/actions.spec.mjs lance l’étape d’envoi elle-même).
    const lancements = etapes.flatMap((etape) => etape.split('\n').map((ligne) => ligne.trim())
      .filter((ligne) => !ligne.startsWith('#') && /generateur\/(?:construire|mesure)\.mjs/.test(ligne)).map((ligne) => ({ ligne, jeton: etape.includes('JETON_GITHUB') })));
    expect(lancements.map((l) => [l.ligne.match(/generateur\/(\w+)\.mjs/)[1], l.jeton])).toEqual([['mesure', false], ['construire', false]]);
    expect(action).not.toContain('env -u');
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
