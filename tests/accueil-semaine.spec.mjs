// L’accueil, l’utile d’abord : « Les matchs de la semaine » (generateur/accueil.mjs), écrits par le générateur dans
// index.html, entre leurs deux repères. Ce qu’on vérifie : les sept jours et leurs cartes, les matchs qu’un bar publié
// diffuse en tête de leur jour (leur carte change d’elle-même), une carte sans bar qui ne promet rien et propose ce qui
// existe (l’agenda du match), la phrase vraie en tête tant qu’aucun bar n’est publié ; que le générateur ne touche à
// rien d’autre de l’accueil ; que la barre des jours marche au clavier et sans JavaScript ; que les mots « Aujourd’hui »
// et « Demain » ne mentent pas un autre jour ; et le contraste de chaque petit texte, mesuré tel qu’il est peint, sur
// les fonds clairs de l’accueil (4,5:1 au moins, partout).
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  accueilAvecLaSemaine, blocDeLaSemaine, controlerLaSemaine, disque, ecrireLAccueil, preparerLAccueil, REPERES,
} from '../generateur/accueil.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO } from './outils/site-genere.mjs';
import { decrireLesCouples, mesurerLesTextes, textesTropFaibles } from './outils/textes-peints.mjs';

const CONTENU = chargerLeContenu(racine);
const { textes, couleurs } = CONTENU;
const ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8');
const H = 3_600_000;

// Un match comme les données préparées le donnent (donnees.mjs) : le strict nécessaire au bloc.
const club = (cle, court) => ({ cle, court, nom: court });
const unMatch = ({ slug, debut, domicile, exterieur, competition = 'Ligue 1', soirees = [], statut = null, heureConfirmee = true }) => ({
  slug, ids: [slug], debut: Date.parse(debut), heureConfirmee, statut, competition, domicile, exterieur, soirees,
});
const soiree = (ville) => ({ bar: { ville: { nom: ville } } });
// Jeudi 29 octobre 2026, 10 h à Paris.
const JEUDI = Date.parse('2026-10-29T09:00:00Z');
const MATCHS = [
  unMatch({ slug: 'fiorentina-atalanta-2026-10-29', debut: '2026-10-29T19:45:00Z', domicile: club('fiorentina', 'Fiorentina'), exterieur: club('atalanta', 'Atalanta'), competition: 'Serie A' }),
  unMatch({ slug: 'troyes-le-mans-2026-10-31', debut: '2026-10-31T19:45:00Z', domicile: club('troyes', 'Troyes'), exterieur: club('le-mans', 'Le Mans') }),
  unMatch({ slug: 'nice-rennes-2026-10-31', debut: '2026-10-31T16:15:00Z', domicile: club('nice', 'Nice'), exterieur: club('rennes', 'Rennes') }),
  unMatch({ slug: 'ol-angers-2026-10-31', debut: '2026-10-31T19:45:00Z', domicile: club('ol', 'OL'), exterieur: club('angers', 'Angers'), soirees: [soiree('Paris'), soiree('Paris')] }),
  unMatch({ slug: 'bayern-dortmund-2026-10-31', debut: '2026-10-31T17:30:00Z', domicile: club('bayern', 'Bayern'), exterieur: club('dortmund', 'Dortmund'), competition: 'Bundesliga', soirees: [soiree('Paris')], statut: 'reporte' }),
  unMatch({ slug: 'match-inconnu-2026-11-02', debut: '2026-11-02T20:00:00Z', domicile: club('sturm-graz', 'Sturm Graz'), exterieur: club('club-1a2b3c4d', 'Шахтар'), competition: 'Ligue Europa', heureConfirmee: false }),
  // Hier (fini depuis longtemps), et dans neuf jours : ni l’un ni l’autre dans la semaine.
  unMatch({ slug: 'psg-ol-2026-10-28', debut: '2026-10-28T19:45:00Z', domicile: club('psg', 'PSG'), exterieur: club('ol', 'OL') }),
  unMatch({ slug: 'lens-om-2026-11-08', debut: '2026-11-08T19:45:00Z', domicile: club('lens', 'Lens'), exterieur: club('om', 'OM') }),
];
const bloc = ({ matchs = MATCHS, bars = [], maintenant = JEUDI } = {}) => blocDeLaSemaine({ donnees: { matchs, bars }, textes, couleurs, maintenant });
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/[ \n]+/g, ' ').trim();
const jourDe = (html, jour) => html.split(`<div class="semaine__jour" data-jour="${jour}">`)[1].split('</div>')[0];
const cartesDe = (html, jour) => jourDe(html, jour).split('<li class="').slice(1);

test.describe('le bloc, du générateur', () => {
  test('sept jours de Paris : « Aujourd’hui », « Demain », puis la date courte ; le premier jour qui a un match est choisi', () => {
    const html = bloc();
    const dates = [...html.matchAll(/<input type="radio" name="semaine-jour" value="([^"]+)"( checked)?><span><b data-date="([^"]+)">([^<]+)<\/b><small>([^<]+)<\/small>/g)]
      .map(([, valeur, choisi, court, nom, compte]) => ({ valeur, choisi: Boolean(choisi), court, nom, compte }));
    expect(dates).toEqual([
      { valeur: '2026-10-29', choisi: true, court: 'jeu. 29', nom: 'Aujourd’hui', compte: '1 match' },
      { valeur: '2026-10-30', choisi: false, court: 'ven. 30', nom: 'Demain', compte: 'aucun match' },
      { valeur: '2026-10-31', choisi: false, court: 'sam. 31', nom: 'sam. 31', compte: '4 matchs' },
      { valeur: '2026-11-01', choisi: false, court: 'dim. 1', nom: 'dim. 1', compte: 'aucun match' },
      { valeur: '2026-11-02', choisi: false, court: 'lun. 2', nom: 'lun. 2', compte: '1 match' },
      { valeur: '2026-11-03', choisi: false, court: 'mar. 3', nom: 'mar. 3', compte: 'aucun match' },
      { valeur: '2026-11-04', choisi: false, court: 'mer. 4', nom: 'mer. 4', compte: 'aucun match' },
    ]);
    expect(html).toContain('data-aujourdhui="2026-10-29"');
    // Un jour sans match le dit, sans carte vide.
    expect(jourDe(html, '2026-10-30')).toContain(`<p class="semaine__rien">${textes.accueil.rienCeJour}</p>`);
    // Le jour de la barre, en toutes lettres pour le lecteur d’écran.
    expect(jourDe(html, '2026-10-29')).toContain('<h3 class="visuellement-cache" data-date="Jeudi 29 octobre">Aujourd’hui, jeudi 29 octobre</h3>');
    expect(jourDe(html, '2026-10-31')).toContain('<h3 class="visuellement-cache">Samedi 31 octobre</h3>');
    // Les matchs finis d’hier et ceux d’après les sept jours n’y sont pas.
    expect(html).not.toContain('psg-ol-2026-10-28');
    expect(html).not.toContain('lens-om-2026-11-08');
    // Ce soir à 23 h, le match du jour, fini, s’en va : samedi devient le premier jour choisi.
    const tard = bloc({ maintenant: Date.parse('2026-10-29T22:50:00Z') });
    expect(tard).toContain('value="2026-10-31" checked');
    expect(tard).toContain('<b data-date="jeu. 29">Aujourd’hui</b><small>aucun match</small>');
  });

  test('un match qu’un bar publié diffuse passe en tête de son jour, et sa carte le dit ; reporté, il ne passe pas devant', () => {
    const cartes = cartesDe(bloc({ bars: [{ id: 'b1' }] }), '2026-10-31');
    const lu = cartes.map((c) => ({ classe: c.split('"')[0], match: c.match(/href="\/matchs\/([^/]+)\//)[1], bas: texteDe(c.split('<p class="carte-match__bas">')[1]) }));
    expect(lu).toEqual([
      { classe: 'carte-match carte-match--bars', match: 'ol-angers-2026-10-31', bas: '2 bars à Paris Voir les bars \u00a0: OL – Angers' },
      { classe: 'carte-match', match: 'nice-rennes-2026-10-31', bas: 'Pas encore de bar Dans mon agenda \u00a0: Nice – Rennes' },
      { classe: 'carte-match', match: 'bayern-dortmund-2026-10-31', bas: 'Match reporté' },
      { classe: 'carte-match', match: 'troyes-le-mans-2026-10-31', bas: 'Pas encore de bar Dans mon agenda \u00a0: Troyes – Le Mans' },
    ]);
    // « Voir les bars » mène aux bars de la page du match ; l’agenda, au fichier du match ; le nom, à sa page.
    expect(cartes[0]).toContain('<a class="carte-match__voir" href="/matchs/ol-angers-2026-10-31/#titre-bars">');
    expect(cartes[1]).toContain('<a class="carte-match__agenda" href="/matchs/nice-rennes-2026-10-31/match.ics" type="text/calendar">');
    expect(cartes[1]).toContain('<a class="carte-match__clubs" href="/matchs/nice-rennes-2026-10-31/">');
    // Un match reporté n’a ni agenda ni « Voir les bars ».
    expect(cartes[2]).not.toMatch(/match\.ics|carte-match__voir/);
    // L’heure à Paris, avec sa date complète pour les machines ; une heure pas encore fixée ne s’affiche pas.
    expect(cartes[0]).toContain('<time datetime="2026-10-31T20:45:00+01:00">20:45</time>');
    expect(jourDe(bloc(), '2026-11-02')).toContain('>heure à confirmer</time>');
    // Des bars dans plusieurs villes : le nombre seul.
    const ailleurs = MATCHS.map((m) => (m.slug === 'ol-angers-2026-10-31' ? { ...m, soirees: [soiree('Paris'), soiree('Lyon'), soiree('Lyon')] } : m));
    expect(texteDe(cartesDe(bloc({ matchs: ailleurs, bars: [{ id: 'b1' }] }), '2026-10-31')[0])).toContain('3 bars Voir les bars');
  });

  test('aucun bar publié : la phrase vraie en tête, qui mène à la liste d’attente ; avec des bars, une autre phrase', () => {
    // Sans bar publié, aucune soirée (donnees.mjs ne garde que celles des bars publiés).
    const sans = bloc({ matchs: MATCHS.map((m) => ({ ...m, soirees: [] })) });
    expect(sans).toContain(`<p class="semaine__chapo">${textes.accueil.sansBar} <a href="#attente">${textes.accueil.sansBarLien}</a></p>`);
    expect(textes.accueil.sansBar).toMatch(/^Baromatch cherche ses premiers bars à Paris\./);
    expect(sans).not.toContain('carte-match__voir');
    // La phrase le dit une fois : aucune carte ne répète « Pas encore de bar » (comme la semaine, /matchs/). Une carte
    // garde l’agenda de son match, ou rien (un match déjà commencé n’a plus de fichier d’agenda : pas de ligne vide).
    expect(sans).not.toContain(textes.accueil.pasDeBar);
    expect(cartesDe(sans, '2026-10-31').map((c) => texteDe(c.split('<p class="carte-match__bas">')[1] ?? ''))).toEqual([
      'Dans mon agenda \u00a0: Nice – Rennes', 'Match reporté', 'Dans mon agenda \u00a0: OL – Angers', 'Dans mon agenda \u00a0: Troyes – Le Mans',
    ]);
    const commence = bloc({ matchs: MATCHS.map((m) => ({ ...m, soirees: [] })), maintenant: Date.parse('2026-10-29T20:00:00Z') });
    expect(jourDe(commence, '2026-10-29')).not.toContain('carte-match__bas');
    const avec = bloc({ bars: [{ id: 'b1' }] });
    expect(avec).toContain(`<p class="semaine__chapo">${textes.accueil.avecBars}</p>`);
    expect(avec).not.toContain(textes.accueil.sansBar);
    // Aucun match annoncé : le bloc le dit, sans barre de jours.
    const vide = bloc({ matchs: [] });
    expect(vide).toContain(`<p class="semaine__rien">${textes.accueil.rienCetteSemaine}</p>`);
    expect(vide).not.toContain('semaine__dates');
  });

  test('deux disques aux couleurs des clubs, jamais un écusson ; un club sans couleurs connues reste neutre', () => {
    expect(disque(['#004170', '#DA291C', 0.75])).toBe('<svg class="disque" viewBox="0 0 2 2" aria-hidden="true" focusable="false"><circle cx="1" cy="1" r="1" fill="#DA291C"/><path d="M1 1V0A1 1 0 1 1 0.000 1.000z" fill="#004170"/></svg>');
    expect(disque(['#FFFFFF', '#111111'])).toContain('<path d="M1 1V0A1 1 0 0 1 1.000 2.000z" fill="#FFFFFF"/>');
    const neutre = '<svg class="disque disque--neutre" viewBox="0 0 2 2" aria-hidden="true" focusable="false"><circle cx="1" cy="1" r="1"/></svg>';
    for (const douteuses of [undefined, [], ['rouge', '#FFFFFF'], ['#FFF', '#000000'], ['#004170', '#DA291C', 0.95], ['#004170', '"/><script>']]) {
      expect(disque(douteuses), JSON.stringify(douteuses)).toBe(neutre);
    }
    const inconnu = jourDe(bloc(), '2026-11-02');
    expect(inconnu.match(/disque--neutre/g)).toHaveLength(2);
    // Chaque couleur de couleurs.json est une vraie couleur, à une part permise ; chaque club de clubs.json qui en a une.
    for (const [cle, valeur] of Object.entries(couleurs).filter(([c]) => !c.startsWith('_'))) {
      expect(disque(valeur), cle).not.toContain('disque--neutre');
    }
    // Aucune image, aucun nom de fichier : le disque est dessiné.
    expect(bloc({ bars: [{ id: 'b1' }] })).not.toMatch(/<img|\.(?:png|svg|webp)"/);
  });

  test('le bloc passe son contrôle : ni style en ligne, ni script, ni « ! », ni mot interdit, et un seul titre h2', () => {
    for (const html of [bloc(), bloc({ bars: [{ id: 'b1' }] }), bloc({ matchs: [] })]) expect(controlerLaSemaine(html)).toEqual([]);
    expect(controlerLaSemaine('<h2>Titre</h2><p style="color:red">x</p>')).toEqual(['un style en ligne']);
    expect(controlerLaSemaine('<h2>Titre</h2><p>Quel match !</p>')).toEqual(['un point d’exclamation']);
    expect(controlerLaSemaine('<h2>Titre</h2><p>Happy hour</p>')).toEqual(['un mot que le site ne publie pas : « Happy hour »']);
    expect(controlerLaSemaine('<h2>Titre</h2><a href="#" onclick="x()">x</a><script>x</script>')).toEqual(['un script', 'un attribut d’évènement']);
    expect(controlerLaSemaine('<p>Sans titre</p>')).toEqual(['un seul titre h2 attendu']);
  });
});

test.describe('l’accueil : le générateur n’écrit que le bloc', () => {
  test('les deux repères sont dans index.html, une fois chacun, et le bloc qui y est passe son contrôle', () => {
    expect(ACCUEIL.split(REPERES.debut)).toHaveLength(2);
    expect(ACCUEIL.split(REPERES.fin)).toHaveLength(2);
    const dedans = ACCUEIL.split(REPERES.debut)[1].split(REPERES.fin)[0];
    expect(controlerLaSemaine(dedans)).toEqual([]);
    // Le bloc est dans l’ouverture, juste avant le film : au téléphone, les matchs viennent après la liste d’attente.
    const ouverture = ACCUEIL.split('<section class="ouverture')[1].split('\n  </section>')[0];
    expect(ouverture.indexOf(REPERES.debut)).toBeGreaterThan(ouverture.indexOf('</form>'));
    expect(ouverture.indexOf(REPERES.fin)).toBeLessThan(ouverture.indexOf('<figure class="film">'));
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

  test('un passage du générateur écrit le bloc dans l’accueil, ne touche à rien d’autre, et ne le réécrit pas inchangé', async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-passage-'));
    try {
      const premier = await construireLeSiteDExemple(dossier, { rendu: null, qr: null });
      expect(premier.accueil.ecrit).toBe(true);
      const ecrit = readFileSync(path.join(dossier, 'index.html'), 'utf8');
      const hors = (html) => html.slice(0, html.indexOf(REPERES.debut)) + html.slice(html.indexOf(REPERES.fin));
      expect(hors(ecrit)).toBe(hors(ACCUEIL));
      expect(ecrit).toContain(premier.accueil.bloc);
      // Le scénario a des bars publiés : leurs matchs ont « Voir les bars ».
      expect(premier.accueil.bloc).toContain('carte-match--bars');
      expect(premier.accueil.bloc).toContain('data-aujourdhui="2026-10-23"');
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
});

// ---------- Dans le navigateur ----------

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

test.describe('la barre des jours, dans le navigateur (le scénario, vendredi 23 octobre)', () => {
  const site = {};
  test.beforeAll(async () => {
    site.dossier = mkdtempSync(path.join(tmpdir(), 'accueil-navigateur-'));
    await construireLeSiteDExemple(site.dossier, { rendu: null, qr: null });
    site.serveur = await demarrerServeur(await portLibre(), -1, { dossier: site.dossier });
  });
  test.afterAll(async () => {
    await site.serveur?.arreter();
    rmSync(site.dossier, { recursive: true, force: true });
  });
  const ouvrir = async (page, { quand = MAINTENANT_DU_SCENARIO + 2 * H, largeur = 390 } = {}) => {
    await page.clock.setFixedTime(new Date(quand));
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.goto(`${site.serveur.adresse}/`);
    return page.locator('#semaine');
  };
  const visibles = (semaine) => semaine.locator('.carte-match:visible .carte-match__clubs');

  for (const javaScript of [true, false]) {
    test(`${javaScript ? 'avec' : 'sans'} JavaScript : un jour choisi montre ses matchs, et seulement eux`, async ({ browser }) => {
      const contexte = await browser.newContext({ javaScriptEnabled: javaScript });
      const page = await contexte.newPage();
      try {
        const semaine = await ouvrir(page);
        await expect(semaine.getByRole('radio', { name: /Aujourd’hui/ })).toBeChecked();
        await expect(visibles(semaine)).toHaveText(['Brest – Nice']);
        await semaine.locator('label', { hasText: 'dim. 25' }).click();
        await expect(semaine.getByRole('radio', { name: /dim\. 25/ })).toBeChecked();
        await expect(visibles(semaine)).toHaveText(['Le Havre – Auxerre', 'PSG – OL']);
        await semaine.locator('label', { hasText: 'mar. 27' }).click();
        await expect(visibles(semaine)).toHaveCount(0);
        await expect(semaine.locator('.semaine__rien:visible')).toHaveText(textes.accueil.rienCeJour);
      } finally {
        await contexte.close();
      }
    });
  }

  test('au clavier : un seul arrêt pour la barre, les flèches changent de jour, et le nom de chaque jour se lit', async ({ page }) => {
    const semaine = await ouvrir(page);
    await semaine.locator('.semaine__chapo a, .semaine__toute').last().focus();
    await page.keyboard.press('Tab');
    const aujourdhui = semaine.getByRole('radio', { name: 'Aujourd’hui 1 match' });
    await expect(aujourdhui).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(semaine.getByRole('radio', { name: 'Demain 1 match' })).toBeChecked();
    await expect(visibles(semaine)).toHaveText(['PSG – Barça']);
    await expect(semaine.getByRole('group', { name: textes.accueil.jours })).toBeVisible();
    // Le contour du jour qui a le focus se voit, en bleu nuit sur le clair.
    const contour = await semaine.locator('.semaine__date input:focus-visible + span').evaluate((s) => getComputedStyle(s).outlineStyle);
    expect(contour).toBe('solid');
    // Après la barre, les liens des cartes du jour choisi seulement.
    await page.keyboard.press('Tab');
    await expect(semaine.locator('.carte-match:visible .carte-match__clubs').first()).toBeFocused();
  });

  test('lu deux jours plus tard (un passage manqué) : plus d’« Aujourd’hui » ni de « Demain », les jours passés s’effacent', async ({ page }) => {
    const semaine = await ouvrir(page, { quand: Date.parse('2026-10-25T10:00:00Z') });
    await expect(semaine.locator('.semaine__date:visible b')).toHaveText(['dim. 25', 'lun. 26', 'mar. 27', 'mer. 28', 'jeu. 29']);
    await expect(semaine.getByRole('radio', { name: /dim\. 25/ })).toBeChecked();
    await expect(visibles(semaine)).toHaveText(['Le Havre – Auxerre', 'PSG – OL']);
    await expect(semaine).not.toContainText('Aujourd’hui');
    await expect(semaine).not.toContainText('Demain');
  });

  test('le jour même, rien ne bouge au chargement (CLS 0), au téléphone comme sur ordinateur', async ({ page }) => {
    for (const largeur of [390, 1280]) {
      await page.addInitScript(() => {
        window.decalages = 0;
        new PerformanceObserver((liste) => { for (const e of liste.getEntries()) if (!e.hadRecentInput) window.decalages += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      await ouvrir(page, { largeur });
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => window.decalages), `${largeur} px`).toBe(0);
    }
  });
});

// ---------- Le contraste des petits textes, peints sur le clair ----------

// La mesure (chaque élément qui porte du texte visible, hors des moments de nuit : sa couleur posée sur son vrai fond,
// et sa taille) est dans tests/outils/textes-peints.mjs : « Pour les bars » la reprend. Ici, les moments de nuit de
// l’accueil : la soirée, le pied de page, le cadre du film, et le piège à robots de la liste d’attente.
const NUIT_DE_L_ACCUEIL = '.nuit, .pied, .film__cadre, .attente__piege';

test.describe('le contraste de chaque texte sur le clair, mesuré', () => {
  for (const [nom, preparer] of [
    ['l’accueil tel qu’il est (aucun bar publié)', null],
    ['le scénario (des bars publiés, des cartes « Voir les bars »)', 'scenario'],
  ]) {
    for (const largeur of [390, 1280]) {
      test(`${nom}, à ${largeur} px : chaque texte à 4,5:1 au moins`, async ({ page }, infos) => {
        let site = null;
        try {
          if (preparer) {
            site = { dossier: mkdtempSync(path.join(tmpdir(), 'accueil-contraste-')) };
            await construireLeSiteDExemple(site.dossier, { rendu: null, qr: null });
            site.serveur = await demarrerServeur(await portLibre(), -1, { dossier: site.dossier });
            await page.clock.setFixedTime(new Date(MAINTENANT_DU_SCENARIO + 2 * H));
          }
          await page.setViewportSize({ width: largeur, height: 900 });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.goto(site ? `${site.serveur.adresse}/` : '/');
          await page.evaluate(() => document.fonts.ready);
          // Chaque jour de la barre, l’un après l’autre : toutes les cartes passent à la mesure.
          const mesures = [];
          const jours = page.locator('#semaine .semaine__date:visible');
          for (let i = 0; i < Math.max(1, await jours.count()); i += 1) {
            if (await jours.count()) await jours.nth(i).click();
            mesures.push(...await mesurerLesTextes(page, NUIT_DE_L_ACCUEIL));
          }
          expect(mesures.length).toBeGreaterThan(40);
          // Le rapport de la PR : chaque couple de couleurs des petits textes, et son contraste le plus faible.
          infos.annotations.push({ type: 'contraste', description: decrireLesCouples(mesures) });
          expect(textesTropFaibles(mesures)).toEqual([]);
        } finally {
          await site?.serveur?.arreter();
          if (site) rmSync(site.dossier, { recursive: true, force: true });
        }
      });
    }
  }
});
