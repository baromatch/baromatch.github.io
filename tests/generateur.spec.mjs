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
