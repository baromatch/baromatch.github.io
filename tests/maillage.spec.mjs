// Le maillage des pages générées, sur deux sites construits de bout en bout : la capture enregistrée de l’appli (des
// matchs, aucun bar publié : la réalité d’aujourd’hui) et le scénario inventé (de vrais bars dans trois villes : celle
// de demain), puis ce même scénario repassé trois jours plus tard (des matchs passés). Les règles valent pour toute page
// que le générateur écrit (elles lisent son état, etat.json : les pages en anglais, agenda/ et les affiches comprises), y
// compris celles qu’il écrira plus tard :
// - aucun lien interne vers une page ou une ancre qui n’existe pas ;
// - chaque page générée se rejoint par des liens depuis l’accueil, sauf celles qui ne restent que pour les anciens liens
//   (un match passé, en français comme en anglais, un bar parti, une page neutre), en noindex ;
// - un match et ses bars se lient dans les deux sens, comme un bar et sa ville, une ville et ses matchs ; chaque ville
//   mène à « Ce soir » ; la semaine mène à chaque match à venir qui a sa page ; l’index des villes, à chaque ville ;
// - le plan du site et IndexNow ne donnent que des pages indexables (et chaque page indexable est dans le plan, sauf
//   un match reporté ou annulé).
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import {
  CAPTURE, MAINTENANT_DE_LA_CAPTURE, MAINTENANT_DU_SCENARIO, PUBLIES_DU_SCENARIO, SCENARIO, construireLeSiteDExemple, contenuDuScenario,
} from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { DUREE_MATCH_MS, JOUR_MS } from '../generateur/donnees.mjs';
import { estPermis, fichierDuChemin } from '../generateur/etat.mjs';

const ORIGINE = 'https://baromatch.fr';

const SITES = [
  { nom: 'la capture (aucun bar publié)', options: { source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, contenu: chargerLeContenu(racine) } },
  { nom: 'le scénario (de vrais bars)', options: { maintenant: MAINTENANT_DU_SCENARIO } },
  // Deux bars inventés de plus à Paris, et chaque vrai bar annonce chaque match : plus de 40 soirées à Paris, plus que
  // la page de la ville n’en liste.
  {
    nom: 'le scénario chargé (plus de 20 soirées par ville)',
    options: { maintenant: MAINTENANT_DU_SCENARIO, contenu: { ...contenuDuScenario(), publies: [...PUBLIES_DU_SCENARIO, 'b-charge-1', 'b-charge-2'] } },
    charger: (scenario) => {
      scenario.bars.push(
        { id: 'b-charge-1', name: 'Le Café des Halles', address: '4 Rue Rambuteau, 75003 Paris', lat: 48.8614, lng: 2.3497, isActive: true, features: {} },
        { id: 'b-charge-2', name: 'La Buvette du Canal', address: '9 Rue de Lancry, 75010 Paris', lat: 48.8702, lng: 2.3603, isActive: true, features: {} },
      );
      const bars = ['b-zinc', 'b-comptoir', 'b-gones', 'b-coin', 'b-rennes', 'b-charge-1', 'b-charge-2'];
      const deja = new Set(scenario.matchNights.map((n) => `${n.bar.id}|${n.match.id}`));
      for (const match of scenario.matches) {
        for (const bar of bars) {
          if (!deja.has(`${bar}|${match.id}`)) scenario.matchNights.push({ id: `n-${bar}-${match.id}`, status: 'OPEN', bar: { id: bar }, match: { id: match.id }, offer: null });
        }
      }
      return scenario;
    },
  },
  // Le scénario, puis un second passage dans le même dossier trois jours plus tard : des pages de matchs passés (« Ce
  // match est passé », « This match has been played »), en noindex, que plus rien ne cherche à rejoindre.
  { nom: 'le scénario, trois jours plus tard (des matchs passés)', options: { maintenant: MAINTENANT_DU_SCENARIO }, ensuite: MAINTENANT_DU_SCENARIO + 3 * JOUR_MS },
];

const decoder = (texte) => texte.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '\'');

// Les liens <a href> d’une page (pas ceux du code du badge, écrit dans une zone de texte), en chemins du site :
// « /matchs/x/ », avec leur ancre à part. Les liens vers l’extérieur, les courriels et les tablées (/t/…) sont laissés.
const liensDe = (html) => [...html.replace(/<textarea[\s\S]*?<\/textarea>/g, '').matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)]
  .map((m) => decoder(m[1]))
  .filter((href) => (href.startsWith('/') && !href.startsWith('//')) || href.startsWith(`${ORIGINE}/`))
  .map((href) => new URL(href, `${ORIGINE}/`))
  .filter((url) => !url.pathname.startsWith('/t/'))
  .map((url) => ({ chemin: decodeURIComponent(url.pathname), ancre: decodeURIComponent(url.hash.slice(1)) }));

// Toutes les pages HTML d’un dossier, par chemin servi (« /matchs/x/ », « /cgu.html »).
const pagesDu = (dossier) => {
  const pages = new Map();
  const parcourir = (relatif) => {
    for (const nom of readdirSync(path.join(dossier, relatif))) {
      const enfant = path.posix.join(relatif, nom);
      if (statSync(path.join(dossier, enfant)).isDirectory()) parcourir(enfant);
      else if (nom.endsWith('.html')) pages.set(`/${enfant.replace(/(^|\/)index\.html$/, '$1')}`, readFileSync(path.join(dossier, enfant), 'utf8'));
    }
  };
  parcourir('');
  return pages;
};

for (const site of SITES) {
  test.describe(site.nom, () => {
    // L’heure du dernier passage ; avant : l’état du passage d’avant, s’il y en a un.
    const maintenant = site.ensuite ?? site.options.maintenant;
    let avant = null;
    let dossier;
    let resultat;
    let pages;
    let etat;
    let generees;
    const liensDeLaPage = (chemin) => new Set(liensDe(pages.get(chemin)).map((l) => l.chemin));
    const indexable = (html) => !/<meta name="robots" content="noindex">/.test(html);

    test.beforeAll(async () => {
      dossier = mkdtempSync(path.join(tmpdir(), 'maillage-'));
      const options = { ...site.options, rendu: null };
      if (site.charger) {
        options.source = `scenario:${path.join(mkdtempSync(path.join(tmpdir(), 'maillage-scenario-')), 'scenario.json')}`;
        writeFileSync(options.source.slice('scenario:'.length), JSON.stringify(site.charger(JSON.parse(readFileSync(SCENARIO, 'utf8')))));
      }
      resultat = await construireLeSiteDExemple(dossier, options);
      if (site.ensuite) {
        avant = resultat.etat;
        resultat = await construire({
          source: options.source ?? `scenario:${SCENARIO}`, sortie: dossier, maintenant: site.ensuite, racine, contenu: options.contenu ?? contenuDuScenario(), rendu: null,
        });
      }
      pages = pagesDu(dossier);
      etat = resultat.etat;
      generees = Object.entries(etat.pages).filter(([chemin]) => chemin.endsWith('/')).map(([chemin, p]) => ({ chemin, ...p }));
    });
    test.afterAll(() => {
      if (dossier) rmSync(dossier, { recursive: true, force: true });
    });

    // Une page qui ne reste que pour les anciens liens : un match passé (ou qui n’est plus au programme), en français
    // comme en anglais, un bar parti, une page neutre. Elle dit noindex, et rien ne la cherche à la rejoindre.
    const pourLesAnciensLiens = (p) => p.repli || (p.type === 'bar' && p.memoire?.disparu)
      || (['match', 'match-en'].includes(p.type) && (Date.parse(p.memoire?.debut ?? p.date) + DUREE_MATCH_MS <= maintenant || !pages.get(p.chemin).includes('id="titre-bars"')));

    test('les pages en anglais, agenda/ et les affiches sont parmi les pages vérifiées', () => {
      const sortes = new Set(generees.map((p) => p.type));
      const avecDesBars = generees.some((p) => p.type === 'bar' && !p.memoire?.disparu);
      for (const sorte of ['agenda', 'affiche', 'guide-en', 'match-en', ...(avecDesBars ? ['affiche-bar'] : [])]) expect(sortes.has(sorte), sorte).toBe(true);
      expect(generees.filter((p) => pourLesAnciensLiens(p) && p.indexable).map((p) => p.chemin)).toEqual([]);
    });

    test('aucun lien d’une page générée vers une page ou une ancre absente', () => {
      expect(generees.length).toBeGreaterThan(5);
      const casses = [];
      for (const { chemin } of generees) {
        for (const lien of liensDe(pages.get(chemin))) {
          const relatif = fichierDuChemin(lien.chemin);
          // Une page que le générateur écrit doit être dans ce site ; une page fixe, dans ce site ou dans le dépôt.
          const fichier = [path.join(dossier, relatif), ...(estPermis(relatif) ? [] : [path.join(racine, relatif)])].find((f) => existsSync(f));
          if (!fichier) casses.push(`${chemin} → ${lien.chemin}`);
          else if (lien.ancre && fichier.endsWith('.html') && !readFileSync(fichier, 'utf8').includes(`id="${lien.ancre}"`)) casses.push(`${chemin} → ${lien.chemin}#${lien.ancre}`);
        }
      }
      expect(casses).toEqual([]);
    });

    test('chaque page générée se rejoint depuis l’accueil, de lien en lien', () => {
      const vues = new Set(['/']);
      const file = ['/'];
      while (file.length) {
        const chemin = file.shift();
        if (!pages.has(chemin)) continue;
        for (const suivant of liensDeLaPage(chemin)) {
          if (!vues.has(suivant)) {
            vues.add(suivant);
            file.push(suivant);
          }
        }
      }
      expect(generees.filter((p) => !pourLesAnciensLiens(p) && !vues.has(p.chemin)).map((p) => p.chemin)).toEqual([]);
    });

    test('un match et ses bars, un bar et sa ville, une ville et ses matchs : liés dans les deux sens', () => {
      const barParId = new Map(generees.filter((p) => p.type === 'bar' && p.memoire?.id && !p.memoire.disparu).map((p) => [p.memoire.id, p]));
      const villeDuBar = (bar) => `/regarder-le-match/${bar.memoire.ville.cle}/`;
      const matchs = generees.filter((p) => p.type === 'match' && !pourLesAnciensLiens(p));
      const manques = [];
      const exiger = (de, vers) => { if (!liensDeLaPage(de).has(vers)) manques.push(`${de} → ${vers}`); };
      for (const match of matchs) {
        for (const id of match.bars) {
          const bar = barParId.get(id);
          exiger(match.chemin, bar.chemin);
          exiger(match.chemin, villeDuBar(bar));
          exiger(bar.chemin, match.chemin);
        }
      }
      for (const bar of barParId.values()) {
        exiger(bar.chemin, villeDuBar(bar));
        exiger(villeDuBar(bar), bar.chemin);
      }
      for (const ville of generees.filter((p) => p.type === 'ville')) {
        exiger(ville.chemin, '/ce-soir/');
        exiger('/regarder-le-match/', ville.chemin);
        for (const match of matchs.filter((m) => m.bars.some((id) => ville.bars.includes(id)))) exiger(ville.chemin, match.chemin);
      }
      expect(manques).toEqual([]);
    });

    test('la semaine mène à chaque match à venir qui a sa page', () => {
      const aVenir = generees.filter((p) => p.type === 'match' && Date.parse(p.memoire.debut) + DUREE_MATCH_MS > maintenant
        && pages.get(p.chemin).includes('id="titre-bars"'));
      expect(aVenir.length).toBeGreaterThan(0);
      const semaine = liensDeLaPage('/matchs/');
      expect(aVenir.filter((p) => !semaine.has(p.chemin)).map((p) => p.chemin)).toEqual([]);
    });

    test('le plan du site et IndexNow : seulement des pages indexables, et chaque page indexable dans le plan', () => {
      const plan = [...readFileSync(path.join(dossier, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
      const sansFichier = plan.filter((chemin) => !pages.has(chemin));
      expect(sansFichier).toEqual([]);
      expect(plan.filter((chemin) => !indexable(pages.get(chemin)))).toEqual([]);
      const indexables = generees.filter((p) => p.indexable && !p.horsPlan).map((p) => p.chemin);
      expect(indexables.filter((chemin) => !plan.includes(chemin))).toEqual([]);
      for (const p of generees) expect(indexable(pages.get(p.chemin)), p.chemin).toBe(Boolean(p.indexable));
      // IndexNow ne reçoit que les pages indexables, et celles qui l’étaient au passage d’avant (pour que les moteurs les
      // relisent) ; au premier passage, toutes les pages indexables.
      const changees = resultat.changees.map((adresse) => new URL(adresse).pathname);
      expect(changees.filter((chemin) => !etat.pages[chemin]?.indexable && !avant?.pages[chemin]?.indexable)).toEqual([]);
      if (!avant) expect(generees.filter((p) => p.indexable).map((p) => p.chemin).filter((chemin) => !changees.includes(chemin))).toEqual([]);
    });
  });
}
