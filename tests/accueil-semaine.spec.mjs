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
import { echapper, insecables } from '../generateur/texte.mjs';
import { racine } from './outils/environnement.mjs';
import { auJourDeLAccueil } from './outils/horloge.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import {
  construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, PUBLIES_DU_SCENARIO, SCENARIO,
} from './outils/site-genere.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

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
    const dates = [...html.matchAll(/<input type="radio" name="semaine-jour" value="([^"]+)"( checked)?><span><b data-date="([^"]+)">([^<]+)<\/b><small>(.*?)<\/small>/g)]
      .map(([, valeur, choisi, court, nom, compte]) => ({ valeur, choisi: Boolean(choisi), court, nom, compte }));
    expect(dates).toEqual([
      { valeur: '2026-10-29', choisi: true, court: 'jeu. 29', nom: 'Aujourd’hui', compte: '1 match' },
      { valeur: '2026-10-30', choisi: false, court: 'ven. 30', nom: 'Demain', compte: 'aucun match' },
      // OL – Angers a des bars : le point, et leur nombre pour le lecteur d’écran.
      { valeur: '2026-10-31', choisi: false, court: 'sam. 31', nom: 'sam. 31', compte: '<span class="semaine__point" aria-hidden="true"></span>4 matchs<span class="visuellement-cache">, dont 1 avec des bars</span>' },
      { valeur: '2026-11-01', choisi: false, court: 'dim. 1', nom: 'dim. 1', compte: 'aucun match' },
      { valeur: '2026-11-02', choisi: false, court: 'lun. 2', nom: 'lun. 2', compte: '1 match' },
      { valeur: '2026-11-03', choisi: false, court: 'mar. 3', nom: 'mar. 3', compte: 'aucun match' },
      { valeur: '2026-11-04', choisi: false, court: 'mer. 4', nom: 'mer. 4', compte: 'aucun match' },
    ]);
    expect(html).toContain('data-aujourdhui="2026-10-29"');
    // Un jour sans match le dit, sans carte vide.
    expect(jourDe(html, '2026-10-30')).toContain(`<p class="semaine__rien">${textes.accueil.rienCeJour}</p>`);
    // Le jour de la barre, en toutes lettres pour le lecteur d’écran.
    expect(jourDe(html, '2026-10-29')).toContain('<h3 class="semaine__titre-jour" data-date="Jeudi 29 octobre">Aujourd’hui, jeudi 29 octobre</h3>');
    expect(jourDe(html, '2026-10-31')).toContain('<h3 class="semaine__titre-jour">Samedi 31 octobre</h3>');
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
    // Strictement vraie, pour les deux visiteurs : le fan (ce qu’il trouve d’abord, puis la vérité : aucun bar encore,
    // puis la liste d’attente, avec les mots de son formulaire) et le bar. Avec des bars : ce que le fan y gagne.
    expect(textes.accueil.sansBar).toBe('Les matchs des sept prochains jours, à l’heure de Paris, chacun avec sa page. Aucun bar ne les annonce encore sur Baromatch.');
    expect(textes.accueil.avecBars).toBe('Les matchs des sept prochains jours, à l’heure de Paris. Ceux que tu peux voir dans un bar passent en premier.');
    expect(textes.accueil.sansBarLien).toBe(ACCUEIL.match(/<label class="attente__etiquette" for="attente-mail">([^<]+)<\/label>/)[1]);
    expect(textes.accueil.sansBarLien).toBe('Préviens-moi quand Baromatch arrive');
    expect(textes.accueil.sansBarProposer).toBe('Tu tiens un bar\u00a0? Propose-le');
    expect(sans).toContain(`<p class="semaine__chapo">${textes.accueil.sansBar}</p>\n<p class="semaine__liens"><a href="#attente">${textes.accueil.sansBarLien}</a><a href="/pour-les-bars.html#proposer">${textes.accueil.sansBarProposer}</a></p>`);
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
    expect(avec).not.toContain('semaine__liens');
    // Aucun match annoncé : le bloc le dit, sans barre de jours.
    const vide = bloc({ matchs: [] });
    expect(vide).toContain(`<p class="semaine__rien">${textes.accueil.rienCetteSemaine}</p>`);
    expect(vide).not.toContain('semaine__dates');
  });

  test('un jour qui a des matchs avec des bars le montre sur sa puce : un point, et « dont N avec des bars » pour le lecteur d’écran', () => {
    const html = bloc({ bars: [{ id: 'b1' }] });
    const puce = (jour) => html.split(`value="${jour}"`)[1].split('</label>')[0];
    // Samedi : OL – Angers a deux bars ; Bayern – Dortmund, reporté, ne compte pas.
    expect(puce('2026-10-31')).toContain('<small><span class="semaine__point" aria-hidden="true"></span>4 matchs<span class="visuellement-cache">, dont 1 avec des bars</span></small>');
    expect(puce('2026-10-29')).toContain('<small>1 match</small>');
    expect(puce('2026-10-30')).toContain(`<small>${textes.accueil.aucunMatch}</small>`);
    // Le jour choisi reste le premier qui a un match, même sans bar.
    expect(html).toContain('value="2026-10-29" checked');
    expect(html).not.toContain('value="2026-10-31" checked');
    const deux = MATCHS.map((m) => (m.slug === 'nice-rennes-2026-10-31' ? { ...m, soirees: [soiree('Paris')] } : m));
    expect(bloc({ matchs: deux, bars: [{ id: 'b1' }] })).toContain('4 matchs<span class="visuellement-cache">, dont 2 avec des bars</span>');
  });

  test('des bars publiés, aucun le jour choisi : sous la phrase, une ligne nomme le prochain match dans un bar (sa date, son heure, ses bars) avec « Voir les bars » ; sans bar publié, ou quand le jour choisi a le sien, aucune', () => {
    const avec = bloc({ bars: [{ id: 'b1' }] });
    // Jeudi 29 n’a que Fiorentina – Atalanta, sans bar : la ligne nomme OL – Angers, samedi.
    expect(avec).toContain(`<p class="semaine__chapo">${textes.accueil.avecBars}</p>\n<p class="semaine__prochain" data-jour="2026-10-31">Le prochain match dans un bar\u00a0: OL – Angers, <time datetime="2026-10-31T20:45:00+01:00">samedi 31 octobre · 20:45</time>, 2 bars à Paris. <a class="semaine__voir" href="/matchs/ol-angers-2026-10-31/#titre-bars">Voir les bars<span class="visuellement-cache">\u00a0: OL – Angers</span></a></p>`);
    expect(avec.match(/semaine__prochain/g)).toHaveLength(1);
    expect(controlerLaSemaine(avec)).toEqual([]);
    // Demain, il est dit par sa date, jamais « demain » : la ligne reste vraie lue un autre jour. 1 bar, au singulier
    // (la règle des cartes) ; des bars dans plusieurs villes, le nombre seul.
    const demain = [...MATCHS, unMatch({ slug: 'brest-lens-2026-10-30', debut: '2026-10-30T19:00:00Z', domicile: club('brest', 'Brest'), exterieur: club('lens', 'Lens'), soirees: [soiree('Paris')] })];
    const ligne = bloc({ matchs: demain, bars: [{ id: 'b1' }] }).match(/<p class="semaine__prochain"[^]*?<\/p>/)[0];
    expect(ligne).toContain('data-jour="2026-10-30">Le prochain match dans un bar\u00a0: Brest – Lens, <time datetime="2026-10-30T20:00:00+01:00">vendredi 30 octobre · 20:00</time>, 1 bar à Paris.');
    expect(ligne).not.toMatch(/demain|aujourd/i);
    const ailleurs = MATCHS.map((m) => (m.slug === 'ol-angers-2026-10-31' ? { ...m, soirees: [soiree('Paris'), soiree('Lyon'), soiree('Lyon')] } : m));
    expect(bloc({ matchs: ailleurs, bars: [{ id: 'b1' }] })).toContain('samedi 31 octobre · 20:45</time>, 3 bars. <a class="semaine__voir"');
    // Sans bar publié : aucune ligne. Le jour choisi a déjà son match dans un bar : aucune. Seul un match reporté a des
    // bars : aucune.
    expect(bloc()).not.toContain('semaine__prochain');
    const deja = MATCHS.map((m) => (m.slug === 'fiorentina-atalanta-2026-10-29' ? { ...m, soirees: [soiree('Paris')] } : m));
    expect(bloc({ matchs: deja, bars: [{ id: 'b1' }] })).not.toContain('semaine__prochain');
    const reporte = MATCHS.map((m) => (m.slug === 'ol-angers-2026-10-31' ? { ...m, soirees: [] } : m));
    expect(bloc({ matchs: reporte, bars: [{ id: 'b1' }] })).not.toContain('semaine__prochain');
  });

  test('le scénario (des bars inventés) : la ligne du prochain match dans un bar le 26 octobre (lundi sans bar, vendredi avec), aucune le 23 (le jour choisi a le sien), ni sans bar publié', async () => {
    const blocDuScenario = async (maintenant, publies = PUBLIES_DU_SCENARIO) => {
      const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant, racine, contenu: { ...contenuDuScenario(), publies } });
      return blocDeLaSemaine({ donnees: site.donnees, textes: site.contenu.textes, couleurs: site.contenu.couleurs, maintenant });
    };
    const lundi = Date.parse('2026-10-26T08:00:00Z');
    expect(await blocDuScenario(lundi)).toContain('<p class="semaine__prochain" data-jour="2026-10-30">Le prochain match dans un bar\u00a0: Le Havre – PSG, <time datetime="2026-10-30T19:00:00+01:00">vendredi 30 octobre · 19:00</time>, 1 bar à Paris. <a class="semaine__voir" href="/matchs/le-havre-psg-2026-10-30/#titre-bars">');
    expect(await blocDuScenario(lundi, [])).not.toContain('semaine__prochain');
    expect(await blocDuScenario(MAINTENANT_DU_SCENARIO)).not.toContain('semaine__prochain');
  });

  test('un long jour : toutes ses cartes dans la page, et au-delà de 4 matchs, un lien vers ce jour dans la semaine', () => {
    const encore = (n, jour) => Array.from({ length: n }, (_, i) => unMatch({
      slug: `club-${i}-autre-${i}-${jour}`, debut: `${jour}T${String(10 + i).padStart(2, '0')}:00:00Z`, domicile: club(`club-${i}`, `Club ${i}`), exterieur: club(`autre-${i}`, `Autre ${i}`),
    }));
    // Samedi, 4 matchs : pas de lien.
    expect(jourDe(bloc(), '2026-10-31')).not.toContain('semaine__tous');
    const html = bloc({ matchs: [...MATCHS, ...encore(3, '2026-10-31'), ...encore(4, '2026-10-29'), ...encore(5, '2026-10-30')], bars: [{ id: 'b1' }] });
    expect(cartesDe(html, '2026-10-31')).toHaveLength(7);
    expect(cartesDe(html, '2026-10-31')[0]).toContain('ol-angers-2026-10-31');
    expect(jourDe(html, '2026-10-31')).toContain('</ul>\n<p class="semaine__tous"><a href="/matchs/#jour-2026-10-31">Tous les matchs de samedi 31 octobre</a></p>');
    // Aujourd’hui : la semaine l’ouvre sous « titre-ce-soir » ; lu un autre jour, le lien dit sa date.
    expect(jourDe(html, '2026-10-29')).toContain('<p class="semaine__tous"><a href="/matchs/#titre-ce-soir" data-date="Tous les matchs de jeudi 29 octobre">Tous les matchs d’aujourd’hui</a></p>');
    expect(jourDe(html, '2026-10-30')).toContain('<p class="semaine__tous"><a href="/matchs/#jour-2026-10-30" data-date="Tous les matchs de vendredi 30 octobre">Tous les matchs de demain</a></p>');
    expect(controlerLaSemaine(html)).toEqual([]);
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
    // Sa phrase de tête est celle de textes.json, telle que le générateur l’écrit : une phrase changée change aussi le bloc
    // enregistré (le reste du bloc vient des données du passage ; l’Action le réécrit dans les 3 heures).
    const phrases = [textes.accueil.sansBar, textes.accueil.avecBars].map((phrase) => insecables(`<p class="semaine__chapo">${echapper(phrase)}</p>`));
    expect(phrases).toContain(dedans.match(/<p class="semaine__chapo">[^<]*<\/p>/)?.[0]);
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
      // Le lien d’un long jour vise une ancre de la semaine : « titre-ce-soir » pour aujourd’hui, « jour-AAAA-MM-JJ »
      // pour chaque autre jour qui a des matchs (samedi et dimanche, dans le scénario).
      const laSemaine = readFileSync(path.join(dossier, 'matchs', 'index.html'), 'utf8');
      for (const ancre of ['titre-ce-soir', 'jour-2026-10-24', 'jour-2026-10-25']) expect(laSemaine).toContain(`<h2 id="${ancre}">`);
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

test.describe('l’accueil : un bloc qui ne se fait pas n’arrête pas les pages des matchs', () => {
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
      expect(readFileSync(path.join(dossier, 'matchs', 'index.html'), 'utf8')).toContain('<h2 id="titre-ce-soir">');
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
    await semaine.locator('.semaine__liens a, .semaine__toute').last().focus();
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

  // L’ambre seulement pour l’action (le propriétaire) : le point d’un jour qui a des bars, et celui de « 1 bar à Paris »,
  // ne sont pas des actions. De la couleur de leur texte, ils grandissent avec lui, et se voient en couleurs forcées
  // (un fond y est repeint : sans réglage, le point disparaissait).
  test('les bars publiés : sur chaque jour, aucun fond ambre hors d’un lien ou d’un bouton ; les points sont de la couleur de leur texte, grandissent avec lui et se voient en couleurs forcées', async ({ page }) => {
    const semaine = await ouvrir(page);
    const ambreHorsAction = () => page.evaluate(() => {
      const trouves = [];
      for (const e of document.querySelectorAll('main *')) {
        if (e.closest('.nuit') || !e.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(e, pseudo);
          if (pseudo && style.content === 'none') continue;
          if (style.backgroundColor === 'rgb(255, 177, 61)' && !e.closest('a, button')) trouves.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}${pseudo ?? ''}`);
        }
      }
      return trouves;
    });
    const jours = semaine.locator('.semaine__date');
    await expect(semaine.locator('.semaine__point')).toHaveCount(3);
    for (let i = 0; i < await jours.count(); i += 1) {
      await jours.nth(i).click();
      expect(await ambreHorsAction(), await jours.nth(i).innerText()).toEqual([]);
    }
    // De la couleur du texte : gris sur un jour, crème sur le jour choisi (le bleu nuit y serait invisible).
    await semaine.locator('label', { hasText: 'Aujourd’hui' }).click();
    const couleurs = await semaine.locator('.semaine__point').evaluateAll((points) => points.map((p) => [getComputedStyle(p).backgroundColor, getComputedStyle(p).color]));
    for (const [fond, texte] of couleurs) expect(fond).toBe(texte);
    expect(new Set(couleurs.map(([fond]) => fond)).size).toBe(2);
    const pastille = () => semaine.locator('.carte-match__bars:visible').first().evaluate((b) => ({ fond: getComputedStyle(b, '::before').backgroundColor, texte: getComputedStyle(b).color, largeur: parseFloat(getComputedStyle(b, '::before').width) }));
    expect((await pastille()).fond).toBe((await pastille()).texte);
    // À sa taille : le texte à 200 %, le point fait deux fois plus.
    const point = () => semaine.locator('.semaine__point').first().evaluate((p) => p.getBoundingClientRect().width);
    const [avant, avantPastille] = [await point(), (await pastille()).largeur];
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await point()).toBeGreaterThanOrEqual(avant * 1.9);
    expect((await pastille()).largeur).toBeGreaterThanOrEqual(avantPastille * 1.9);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    // En couleurs forcées : le point et la pastille gardent une couleur pleine, autre que le fond qui les porte.
    await page.emulateMedia({ forcedColors: 'active' });
    const forces = await page.evaluate(() => {
      const fond = (e) => getComputedStyle(e).backgroundColor;
      return [
        ...[...document.querySelectorAll('.semaine__point')].map((p) => [fond(p), fond(p.closest('label').querySelector('span'))]),
        ...[...document.querySelectorAll('.carte-match__bars')].filter((b) => b.checkVisibility()).map((b) => [getComputedStyle(b, '::before').backgroundColor, fond(b.closest('.carte-match'))]),
      ];
    });
    expect(forces.length).toBeGreaterThan(3);
    for (const [point, dessous] of forces) {
      expect(point).not.toBe(dessous);
      expect(point).not.toMatch(/rgba\(.*, 0\)$|transparent/);
    }
  });

  test('lu deux jours plus tard (un passage manqué) : plus d’« Aujourd’hui » ni de « Demain », les jours passés s’effacent ; un jour choisi passé laisse la place au premier jour restant qui a des matchs', async ({ page }) => {
    const semaine = await ouvrir(page, { quand: Date.parse('2026-10-25T10:00:00Z') });
    await expect(semaine.locator('.semaine__date:visible b')).toHaveText(['dim. 25', 'lun. 26', 'mar. 27', 'mer. 28', 'jeu. 29']);
    await expect(semaine.getByRole('radio', { name: /dim\. 25/ })).toBeChecked();
    await expect(visibles(semaine)).toHaveText(['Le Havre – Auxerre', 'PSG – OL']);
    await expect(semaine).not.toContainText('Aujourd’hui');
    await expect(semaine).not.toContainText('Demain');
    // Lu le mardi 27, un jour sans match : comme le générateur ce jour-là, le premier jour restant qui a des matchs est
    // choisi (mercredi 28), pas un panneau « Pas de match annoncé ». Mardi reste dans la barre.
    const mardi = await ouvrir(page, { quand: Date.parse('2026-10-27T10:00:00Z') });
    await expect(mardi.getByRole('radio', { name: /mer\. 28/ })).toBeChecked();
    await expect(mardi.getByRole('radio', { name: /mar\. 27/ })).not.toBeChecked();
    await expect(mardi.locator('.semaine__date:visible b')).toHaveText(['mar. 27', 'mer. 28', 'jeu. 29']);
    await expect(visibles(mardi)).toHaveText(['OM – Nice']);
    // Lu le jeudi 29, le dernier jour : plus aucun jour restant n’a de match, ce jour-là est choisi, et le dit.
    const jeudi = await ouvrir(page, { quand: Date.parse('2026-10-29T10:00:00Z') });
    await expect(jeudi.getByRole('radio', { name: /jeu\. 29/ })).toBeChecked();
    await expect(jeudi.locator('.semaine__rien:visible')).toHaveText(textes.accueil.rienCeJour);
  });

  test('lu sept ou huit jours plus tard (le générateur arrêté) : aucun jour passé ne reste, la barre et ses cartes s’en vont', async ({ page }) => {
    for (const jour of ['2026-10-30', '2026-10-31']) {
      const semaine = await ouvrir(page, { quand: Date.parse(`${jour}T10:00:00Z`) });
      await expect(semaine.locator('.semaine__jours'), jour).toBeHidden();
      await expect(semaine.locator('.carte-match:visible'), jour).toHaveCount(0);
      await expect(semaine.locator('.semaine__date:visible'), jour).toHaveCount(0);
      // Le titre, la phrase et « Toute la semaine » restent : la semaine, elle, est refaite à chaque passage.
      await expect(semaine.getByRole('heading', { level: 2, name: textes.accueil.titre })).toBeVisible();
      await expect(semaine.locator('.semaine__chapo')).toBeVisible();
      await expect(semaine.getByRole('link', { name: textes.accueil.toute })).toBeVisible();
    }
    // Le jour de Paris se lit en parties (année, mois, jour), pas dans la forme d’une langue.
    expect(readFileSync(path.join(racine, 'main.js'), 'utf8')).not.toContain('fr-CA');
  });

  test('sans :has() (un navigateur ancien) : pas de barre des jours, mais chaque jour sous son titre, visible ; avec :has(), le titre est pour le lecteur d’écran', async ({ page }) => {
    // Les deux branches sont dans la feuille de style.
    const feuille = readFileSync(path.join(racine, 'styles.css'), 'utf8');
    const branche = (debut) => feuille.split(debut)[1].split('\n}\n')[0];
    expect(branche('@supports selector(:has(*)) {')).toMatch(/\.semaine__titre-jour \{[^}]*clip: rect\(0 0 0 0\)/);
    expect(branche('@supports not selector(:has(*)) {')).toMatch(/\.semaine__dates \{ display: none; \}/);
    // Avec :has() : la barre, un seul jour, et son titre pour le lecteur d’écran seulement.
    let semaine = await ouvrir(page);
    await expect(semaine.locator('.semaine__dates')).toBeVisible();
    await expect(semaine.locator('.semaine__jour:visible')).toHaveCount(1);
    const titre = semaine.getByRole('heading', { level: 3, name: 'Aujourd’hui, vendredi 23 octobre' });
    await expect(titre).toHaveCount(1);
    expect((await titre.boundingBox()).height).toBeLessThanOrEqual(1);
    // Un navigateur sans :has() : la feuille, telle qu’il la lit (la condition « :has() » fausse).
    await page.route('**/styles.css', async (route) => {
      const reponse = await route.fetch();
      await route.fulfill({ response: reponse, body: (await reponse.text()).replaceAll('selector(:has(*))', 'selector(:pas-de-has(*))') });
    });
    semaine = await ouvrir(page);
    await expect(semaine.locator('.semaine__dates')).toBeHidden();
    await expect(semaine.locator('.semaine__jour:visible')).toHaveCount(7);
    await expect(semaine.locator('.semaine__titre-jour:visible')).toHaveText([
      'Aujourd’hui, vendredi 23 octobre', 'Demain, samedi 24 octobre', 'Dimanche 25 octobre', 'Lundi 26 octobre', 'Mardi 27 octobre', 'Mercredi 28 octobre', 'Jeudi 29 octobre',
    ]);
    for (const t of await semaine.locator('.semaine__titre-jour').all()) expect((await t.boundingBox()).height).toBeGreaterThan(16);
  });

  test('le jour même, rien ne bouge au chargement (CLS 0), au téléphone comme sur ordinateur', async ({ page }) => {
    // Seuls les décalages de la page elle-même : sans la police. Arrivée après le premier rendu (une machine chargée),
    // elle remplace celle de secours (font-display: swap) et ce changement compte comme un décalage, qui existe déjà en
    // ligne et dépend du hasard de la machine. Il aura sa propre correction (les mesures de la police de secours) et son
    // propre test.
    await page.route('**/fonts/bricolage-grotesque.woff2', (route) => route.abort());
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

test.describe('le prochain match dans un bar, dans le navigateur (le scénario du lundi 26 octobre)', () => {
  const LUNDI = Date.parse('2026-10-26T08:00:00Z');
  const site = {};
  test.beforeAll(async () => {
    site.dossier = mkdtempSync(path.join(tmpdir(), 'accueil-prochain-'));
    await construireLeSiteDExemple(site.dossier, { maintenant: LUNDI, rendu: null, qr: null });
    site.serveur = await demarrerServeur(await portLibre(), -1, { dossier: site.dossier });
  });
  test.afterAll(async () => {
    await site.serveur?.arreter();
    rmSync(site.dossier, { recursive: true, force: true });
  });

  for (const [appareil, largeur] of [['un iPhone', 390], ['un Pixel', 412]]) {
    test(`sur ${appareil} (${largeur} px), sans rien toucher : la ligne se voit sous la phrase, et « Voir les bars » mène aux bars du match`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(LUNDI + 2 * H));
      await page.setViewportSize({ width: largeur, height: 844 });
      await page.goto(`${site.serveur.adresse}/`);
      const semaine = page.locator('#semaine');
      // Le jour choisi, lundi, n’a que Lille – Lens, sans bar.
      await expect(semaine.getByRole('radio', { name: /Aujourd’hui/ })).toBeChecked();
      await expect(semaine.locator('.carte-match--bars:visible')).toHaveCount(0);
      const ligne = semaine.locator('.semaine__prochain');
      await expect(ligne).toBeVisible();
      await expect(ligne).toHaveText('Le prochain match dans un bar\u00a0: Le Havre – PSG, vendredi 30 octobre · 19:00, 1 bar à Paris. Voir les bars\u00a0: Le Havre – PSG');
      // Juste sous la phrase, avant la barre des jours.
      expect(await ligne.evaluate((p) => p.previousElementSibling.className)).toBe('semaine__chapo');
      const voir = ligne.getByRole('link', { name: /^Voir les bars\s*:\s*Le Havre – PSG$/ });
      expect((await voir.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await voir.click();
      await expect(page).toHaveURL(/\/matchs\/le-havre-psg-2026-10-30\/#titre-bars$/);
      await expect(page.locator('#titre-bars')).toBeInViewport();
    });
  }

  test('lue un autre jour : la ligne reste jusqu’au jour de son match (vendredi 30), et s’efface le lendemain', async ({ page }) => {
    for (const [jour, visible] of [['2026-10-30', true], ['2026-10-31', false]]) {
      await page.clock.setFixedTime(new Date(`${jour}T10:00:00Z`));
      await page.goto(`${site.serveur.adresse}/`);
      if (visible) await expect(page.locator('.semaine__prochain'), jour).toBeVisible();
      else await expect(page.locator('.semaine__prochain'), jour).toBeHidden();
    }
  });
});

test.describe('un long jour, dans le navigateur', () => {
  // L’accueil avec un bloc d’essai : samedi 31 octobre a 8 matchs, dont un avec des bars.
  const encore = Array.from({ length: 4 }, (_, i) => unMatch({
    slug: `club-${i}-autre-${i}-2026-10-31`, debut: `2026-10-31T${String(10 + i).padStart(2, '0')}:00:00Z`, domicile: club(`club-${i}`, `Club ${i}`), exterieur: club(`autre-${i}`, `Autre ${i}`),
  }));
  const essai = accueilAvecLaSemaine(ACCUEIL, bloc({ matchs: [...MATCHS, ...encore], bars: [{ id: 'b1' }] }));
  for (const [largeur, nombre] of [[390, 4], [1280, 6]]) {
    test(`à ${largeur} px : ${nombre} cartes au plus, les bars d’abord, puis « Tous les matchs de samedi 31 octobre »`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(JEUDI));
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: essai }));
      await page.goto('/');
      const semaine = page.locator('#semaine');
      // Chromium sépare d’une espace le texte caché (position absolue) : « 8 matchs , dont… ».
      const samedi = semaine.getByRole('radio', { name: /^sam\. 31 8 matchs ?, dont 1 avec des bars$/ });
      await expect(samedi).toHaveCount(1);
      await expect(semaine.locator('label', { hasText: 'sam. 31' }).locator('.semaine__point')).toBeVisible();
      await semaine.locator('label', { hasText: 'sam. 31' }).click();
      const cartes = semaine.locator('.carte-match:visible');
      await expect(cartes).toHaveCount(nombre);
      await expect(cartes.first()).toHaveClass(/carte-match--bars/);
      await expect(semaine.locator('.semaine__jour[data-jour="2026-10-31"] .carte-match')).toHaveCount(8);
      const tous = semaine.getByRole('link', { name: 'Tous les matchs de samedi 31 octobre' });
      await expect(tous).toBeVisible();
      await expect(tous).toHaveAttribute('href', '/matchs/#jour-2026-10-31');
    });
  }
});

// ---------- Le contraste des petits textes, peints sur le clair ----------

// Chaque élément qui porte du texte visible, hors des moments de nuit (la soirée, le film, le pied de page) : la couleur
// de son texte posée sur son vrai fond (les fonds translucides empilés jusqu’au premier fond plein), et sa taille.
// Le texte de remplacement des champs (::placeholder) aussi. Les petits textes (moins de 24 px, ou 18,66 px en gras)
// doivent faire 4,5:1 ; ici, on l’exige de tous.
const mesurerLesTextes = (page) => page.evaluate(() => {
  const lire = (css) => { const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number); return { r, v, b, a }; };
  const poser = (dessus, dessous) => ({ r: dessus.r * dessus.a + dessous.r * (1 - dessus.a), v: dessus.v * dessus.a + dessous.v * (1 - dessus.a), b: dessus.b * dessus.a + dessous.b * (1 - dessus.a), a: 1 });
  const lum = ({ r, v, b }) => [r, v, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const rapport = (x, y) => { const [c, s] = [lum(x), lum(y)].sort((m, n) => n - m); return (c + 0.05) / (s + 0.05); };
  const fondDe = (element) => {
    const couches = [];
    for (let e = element; e; e = e.parentElement) {
      const f = lire(getComputedStyle(e).backgroundColor);
      if (f.a > 0) couches.push(f);
      if (f.a === 1) break;
    }
    return couches.reverse().reduce((dessous, dessus) => poser(dessus, dessous), { r: 255, v: 255, b: 255, a: 1 });
  };
  const hex = ({ r, v, b }) => `#${[r, v, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const mesures = [];
  const nuit = '.nuit, .pied, .film__cadre, .visuellement-cache, .lien-evitement, .attente__piege';
  for (const element of document.querySelectorAll('body *')) {
    if (element.closest(nuit) || !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const texte = [...element.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const style = getComputedStyle(element);
    const champ = element.matches('input[placeholder]') ? getComputedStyle(element, '::placeholder') : null;
    if (!texte && !champ) continue;
    const fond = fondDe(element);
    const couleur = lire((champ ?? style).color);
    const peinte = poser(couleur, fond);
    const taille = parseFloat(style.fontSize);
    mesures.push({
      quoi: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.split(' ')[0]}` : ''}${champ ? '::placeholder' : ''} « ${(texte || element.placeholder).slice(0, 28)} »`,
      rapport: Math.round(rapport(peinte, fond) * 100) / 100, texte: hex(peinte), fond: hex(fond), petit: taille < 24 && !(taille >= 18.66 && Number(style.fontWeight) >= 700), taille,
    });
  }
  return mesures;
});

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
          } else {
            // Le jour du bloc enregistré : lu une semaine plus tard, la barre et ses cartes ne seraient plus mesurées.
            await auJourDeLAccueil(page);
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
            mesures.push(...await mesurerLesTextes(page));
          }
          expect(mesures.length).toBeGreaterThan(40);
          const faibles = mesures.filter((m) => m.rapport < 4.5).map((m) => `${m.quoi} : ${m.rapport}:1 (${m.texte} sur ${m.fond}, ${m.taille} px)`);
          // Le rapport de la PR : chaque couple de couleurs des petits textes, et son contraste le plus faible.
          const couples = new Map();
          for (const m of mesures.filter((x) => x.petit)) {
            const cle = `${m.texte} sur ${m.fond}`;
            if (!couples.has(cle) || couples.get(cle).rapport > m.rapport) couples.set(cle, m);
          }
          infos.annotations.push({ type: 'contraste', description: [...couples.entries()].sort((a, b) => a[1].rapport - b[1].rapport).map(([cle, m]) => `${m.rapport}:1 ${cle} (${m.quoi})`).join(' | ') });
          expect([...new Set(faibles)]).toEqual([]);
        } finally {
          await site?.serveur?.arreter();
          if (site) rmSync(site.dossier, { recursive: true, force: true });
        }
      });
    }
  }
});

// ---------- Le jour : le survol, le focus et le pied de page ----------

// Le rapport de contraste de deux couleurs CSS (rgb ou rgba posée sur la seconde, opaque).
const rgb = (css) => { const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number); return { r, v, b, a }; };
const luminance = ({ r, v, b }) => [r, v, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (dessus, dessous) => {
  const f = rgb(dessous);
  const t = rgb(dessus);
  const peinte = { r: t.r * t.a + f.r * (1 - t.a), v: t.v * t.a + f.v * (1 - t.a), b: t.b * t.a + f.b * (1 - t.a) };
  const [c, s] = [luminance(peinte), luminance(f)].sort((m, n) => n - m);
  return Math.round(((c + 0.05) / (s + 0.05)) * 100) / 100;
};

// Ce que peint le focus de l’élément actif : son contour, ou celui de ce qui le montre (la puce d’un bouton radio
// invisible, la pilule du champ d’e-mail), et le fond plein derrière ce contour (les fonds translucides empilés).
const lireLeFocus = (page) => page.evaluate(() => {
  const actif = document.activeElement;
  if (!actif || actif === document.body) return null;
  const visible = (e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  const contoure = (e) => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; };
  const candidats = [actif, actif.nextElementSibling, ...(function* parents() { for (let e = actif.parentElement; e; e = e.parentElement) yield e; }())]
    .filter((e) => e && visible(e) && contoure(e) && (e === actif || e === actif.nextElementSibling || e.matches(':has(:focus-visible)')));
  const peint = candidats[0];
  const quoi = `${actif.tagName.toLowerCase()}${actif.className && typeof actif.className === 'string' ? `.${actif.className.split(' ')[0]}` : ''} « ${(actif.textContent || actif.getAttribute('aria-label') || actif.value || '').trim().slice(0, 30)} »`;
  // Le lecteur classique du film (mouvement réduit) : ses commandes, dans le cadre sombre du film, ont le contour du
  // navigateur, que le style de la page ne peint pas.
  if (!peint) return { quoi, contour: null, lecteur: actif.matches('video[controls]') };
  const lire = (css) => { const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number); return { r, v, b, a }; };
  const couches = [];
  for (let e = peint.parentElement; e; e = e.parentElement) {
    const f = lire(getComputedStyle(e).backgroundColor);
    if (f.a > 0) couches.push(f);
    if (f.a === 1) break;
  }
  const fond = couches.reverse().reduce((d, h) => ({ r: h.r * h.a + d.r * (1 - h.a), v: h.v * h.a + d.v * (1 - h.a), b: h.b * h.a + d.b * (1 - h.a), a: 1 }), { r: 255, v: 255, b: 255, a: 1 });
  return { quoi, contour: getComputedStyle(peint).outlineColor, fond: `rgb(${Math.round(fond.r)}, ${Math.round(fond.v)}, ${Math.round(fond.b)})` };
});

test.describe('le jour : le survol, le focus et le pied de page de l’accueil', () => {
  test('« Proposer mon bar » survolé reste lisible sur son bouton nuit (4,5:1 au moins)', async ({ page }) => {
    await page.goto('/');
    const bouton = page.locator('.bars .bouton-nuit', { hasText: 'Proposer mon bar' });
    await bouton.hover();
    const { couleur, fond } = await bouton.evaluate((b) => ({ couleur: getComputedStyle(b).color, fond: getComputedStyle(b).backgroundColor }));
    expect(contraste(couleur, fond), `${couleur} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
  });

  for (const largeur of [390, 1280]) {
    test(`au clavier, à ${largeur} px : chaque contour de focus posé sur un fond clair s’en détache à 3:1 au moins`, async ({ page }) => {
      // Le jour du bloc enregistré : la barre des jours et les cartes du jour choisi passent au clavier.
      await auJourDeLAccueil(page);
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      const arrets = [];
      for (let i = 0; i < 250; i += 1) {
        await page.keyboard.press('Tab');
        const arret = await lireLeFocus(page);
        if (!arret || (arrets.length && arret.quoi === arrets[0].quoi)) break;
        arrets.push(arret);
      }
      expect(arrets.length).toBeGreaterThan(40);
      expect(arrets.filter((a) => !a.contour && !a.lecteur).map((a) => a.quoi), 'un arrêt sans contour').toEqual([]);
      const clairs = arrets.filter((a) => a.contour && luminance(rgb(a.fond)) > 0.5);
      expect(clairs.length).toBeGreaterThan(20);
      const faibles = clairs.filter((a) => contraste(a.contour, a.fond) < 3).map((a) => `${a.quoi} : ${a.contour} sur ${a.fond}, ${contraste(a.contour, a.fond)}:1`);
      expect([...new Set(faibles)]).toEqual([]);
    });
  }

  test('le pied de page de l’accueil a les couleurs de celui des autres pages', async ({ page }) => {
    const couleurs = async (adresse) => {
      await page.goto(adresse);
      return page.evaluate(() => ['.pied', '.pied__marque span', '.pied__liens a'].map((s) => `${s} : ${getComputedStyle(document.querySelector(s)).color}`));
    };
    expect(await couleurs('/')).toEqual(await couleurs('/cgu.html'));
  });
});
