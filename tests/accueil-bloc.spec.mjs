// L’accueil : le générateur (generateur/accueil.mjs) n’écrit que son bloc, entre ses deux repères, et rien d’autre
// d’index.html. Ce qu’on vérifie : les repères, le contrôle du bloc (ni style en ligne, ni script qui s’exécute, ni « ! »,
// ni mot interdit), l’écriture qui refuse un accueil changé hors du bloc, un passage complet du générateur sur le scénario
// inventé, et un bloc qui ne se fait pas sans arrêter les pages des matchs.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  accueilAvecLaSemaine, controlerLaSemaine, ecrireLAccueil, preparerLAccueil, REPERES,
} from '../generateur/accueil.mjs';
import { racine } from './outils/environnement.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO } from './outils/site-genere.mjs';

const ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8');

test.describe('le bloc, entre ses repères', () => {
  test('les deux repères sont dans index.html, une fois chacun, et le bloc qui y est passe son contrôle', () => {
    expect(ACCUEIL.split(REPERES.debut)).toHaveLength(2);
    expect(ACCUEIL.split(REPERES.fin)).toHaveLength(2);
    const dedans = ACCUEIL.split(REPERES.debut)[1].split(REPERES.fin)[0];
    expect(controlerLaSemaine(dedans)).toEqual([]);
    // Le bloc est le moment de 19:30, « Choisis ton match » : sous son titre (écrit à la main), avant le moment de 20:15.
    expect(ACCUEIL.indexOf(REPERES.debut)).toBeGreaterThan(ACCUEIL.indexOf('id="titre-choisis"'));
    expect(ACCUEIL.indexOf(REPERES.fin)).toBeLessThan(ACCUEIL.indexOf('data-heure="2015"'));
    // Le programme du soir (« Le guide du soir ») est sur la page « Ce soir », pas sur l’accueil.
    expect(ACCUEIL).not.toContain('class="paris"');
  });

  test('le bloc passe son contrôle : ni style en ligne, ni script, ni « ! », ni mot interdit, ni titre (le titre du moment est écrit à la main)', () => {
    expect(controlerLaSemaine('<p class="chapo">Ce soir : 4 matchs.</p>')).toEqual([]);
    expect(controlerLaSemaine('<p style="color:red">x</p>')).toEqual(['un style en ligne']);
    expect(controlerLaSemaine('<p>Quel match !</p>')).toEqual(['un point d’exclamation']);
    expect(controlerLaSemaine('<p>Happy hour</p>')).toEqual(['un mot que le site ne publie pas : « Happy hour »']);
    expect(controlerLaSemaine('<a href="#" onclick="x()">x</a><script>x</script>')).toEqual(['un script', 'un attribut d’évènement']);
    expect(controlerLaSemaine('<script type="text/javascript">x()</script>')).toEqual(['un script']);
    expect(controlerLaSemaine('<h2>Titre</h2>')).toEqual(['aucun titre : le titre « Choisis ton match » est écrit à la main']);
  });

  test('accueilAvecLaSemaine remplace ce qui est entre les repères, et seulement cela ; des repères absents ou doublés arrêtent tout', () => {
    const page = `<p>Avant</p>\n${REPERES.debut}\n<p>Ancien</p>\n${REPERES.fin}\n<p>Après</p>`;
    expect(accueilAvecLaSemaine(page, '<p>Nouveau</p>')).toBe(`<p>Avant</p>\n${REPERES.debut}\n<p>Nouveau</p>\n${REPERES.fin}\n<p>Après</p>`);
    for (const casse of ['<p>Sans repères</p>', `${REPERES.fin}${REPERES.debut}`, `${REPERES.debut}${REPERES.debut}${REPERES.fin}`, `${REPERES.debut}${REPERES.fin}${REPERES.fin}`]) {
      expect(() => accueilAvecLaSemaine(casse, '<p>x</p>'), casse).toThrow(/les repères/);
    }
  });

  test('ecrireLAccueil refuse un accueil changé hors du bloc', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-'));
    try {
      const avant = `<p>Avant</p>\n${REPERES.debut}\n<p>Ancien</p>\n${REPERES.fin}\n<p>Après</p>`;
      writeFileSync(path.join(dossier, 'index.html'), avant);
      expect(() => ecrireLAccueil(dossier, { avant, apres: avant.replace('Après', 'Autre chose') })).toThrow(/ne change que le bloc/);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(avant);
      const prepare = preparerLAccueil({ racine: dossier, sortie: dossier, bloc: '<p>Nouveau</p>' });
      ecrireLAccueil(dossier, prepare);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(avant.replace('<p>Ancien</p>', '<p>Nouveau</p>'));
      // Le même bloc une seconde fois : rien à écrire.
      expect(preparerLAccueil({ racine: dossier, sortie: dossier, bloc: '<p>Nouveau</p>' })).toBeNull();
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

test.describe('un passage du générateur', () => {
  test('écrit le bloc dans l’accueil, ne touche à rien d’autre, et ne le réécrit pas inchangé', async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-passage-'));
    try {
      const premier = await construireLeSiteDExemple(dossier, { rendu: null, qr: null });
      expect(premier.accueil.ecrit).toBe(true);
      const ecrit = readFileSync(path.join(dossier, 'index.html'), 'utf8');
      const hors = (html) => html.slice(0, html.indexOf(REPERES.debut)) + html.slice(html.indexOf(REPERES.fin));
      expect(hors(ecrit)).toBe(hors(ACCUEIL));
      expect(ecrit).toContain(premier.accueil.bloc);
      expect(premier.accueil.bloc).toMatch(/<ul class="soir">\s*<li><a class="match" href="\/matchs\//);
      expect(premier.accueil.bloc).toContain('<a class="sept" href="/matchs/">');
      // Chaque lien du bloc mène à un fichier que ce même passage a écrit, et chaque ancre à un id de la page visée.
      const liensDuBloc = [...premier.accueil.bloc.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((l) => !l.startsWith('/confidentialite'));
      expect(liensDuBloc.length).toBeGreaterThan(1);
      for (const lien of liensDuBloc) {
        const [chemin, ancre] = lien.split('#');
        const fichier = path.join(dossier, chemin.endsWith('/') ? `${chemin}index.html` : chemin);
        expect(existsSync(fichier), lien).toBe(true);
        if (ancre && fichier.endsWith('.html')) expect(readFileSync(fichier, 'utf8'), lien).toContain(`id="${ancre}"`);
      }
      const { construire } = await import('../generateur/construire.mjs');
      const second = await construire({
        source: `scenario:${path.join(racine, 'tests', 'donnees', 'scenario.json')}`, sortie: dossier, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario(), rendu: null, qr: null,
      });
      expect(second.accueil.ecrit).toBe(false);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(ecrit);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('des textes sans le bloc « accueil » : l’accueil reste comme il est, le journal le dit, les pages des matchs s’écrivent', async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-sans-textes-'));
    try {
      const contenu = contenuDuScenario();
      const sansAccueil = { ...contenu.textes };
      delete sansAccueil.accueil;
      const journal = [];
      const resultat = await construireLeSiteDExemple(dossier, { rendu: null, qr: null, contenu: { ...contenu, textes: sansAccueil }, journal: (ligne) => journal.push(ligne) });
      expect(resultat.accueil.ecrit).toBe(false);
      expect(resultat.avertissements.filter((a) => a.startsWith('accueil :'))).toHaveLength(1);
      expect(resultat.avertissements.find((a) => a.startsWith('accueil :'))).toMatch(/l’accueil reste comme il est$/);
      expect(journal.some((ligne) => ligne.startsWith('avertissement : accueil :'))).toBe(true);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(ACCUEIL);
      expect(resultat.ecrits).toContain('/matchs/');
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
