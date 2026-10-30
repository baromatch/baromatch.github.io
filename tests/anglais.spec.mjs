// Les pages en anglais (/en/), sans navigateur : lesquelles existent (Paris, la Premier League, la Ligue des champions,
// et les matchs de la Premier League, des coupes d’Europe et du PSG, rien d’autre), quand elles sont indexables (jamais
// sans vrai bar de Paris), hreflang seulement entre deux jumelles indexables, l’heure de Paris à l’anglaise, l’état de
// l’appli dit d’emblée, aucune offre ni mot de boisson, et leur vie d’un passage à l’autre (un match passé, retiré, puis
// effacé avec sa jumelle française). Le scénario inventé (des vrais bars à Paris et à Lyon) se lit le vendredi
// 23 octobre 2026 ; la copie réduite des listes publiques (aucun vrai bar) à l’heure de son enregistrement.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { sansInsignes } from './outils/insignes.mjs';
import { PIED } from './outils/pied.mjs';
import { contenuDuScenario, PUBLIES_DU_SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { lireLaSource } from '../generateur/sources.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { construire } from '../generateur/construire.mjs';
import { BOISSONS_EN_ANGLAIS, controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { estPermis, nouveauPlan } from '../generateur/etat.mjs';
import { avecLesLangues, heureALAnglaise, jourEntierALAnglaise, quandALAnglaise, TEXTES_EN } from '../generateur/anglais.mjs';
import { blocsDe } from '../generateur/validateur.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');
const ENREGISTREMENT = Date.parse('2026-10-15T19:44:29Z');
const ORIGINE = 'https://baromatch.fr';
const contenu = contenuDuScenario();
const IMAGE_DU_SITE = `${ORIGINE}/img/og-image.jpg`;

const pageDe = (site, chemin) => {
  const trouvee = site.pages.find((p) => p.chemin === chemin);
  expect(trouvee, chemin).toBeTruthy();
  return trouvee;
};
const anglaises = (site) => site.pages.filter((p) => p.langue === 'en');
const robotsDe = (p) => p.contenu.match(/<meta name="robots" content="([^"]*)">/)[1];
const meta = (html, propriete) => [...html.matchAll(new RegExp(`<meta (?:property|name)="${propriete}" content="([^"]*)">`, 'g'))].map((m) => m[1]);
// Les hreflang de la tête d’une page : [langue, adresse].
const hreflangs = (p) => [...p.contenu.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
// Le lien visible vers l’autre langue : [adresse, texte], ou null.
const lienDeLangue = (p) => {
  const lien = p.contenu.match(/<p class="regarder-langue"><a href="([^"]+)" hreflang="(?:fr|en)" lang="(?:fr|en)">([^<]+)<\/a><\/p>/);
  return lien ? [lien[1], lien[2]] : null;
};
const graphe = (p) => blocsDe(p.contenu).flatMap((bloc) => bloc['@graph']);
const paire = (fr, en) => [['fr', `${ORIGINE}${fr}`], ['en', `${ORIGINE}${en}`], ['x-default', `${ORIGINE}${fr}`]];

// Un scénario modifié, écrit à côté (la source « scenario: » lit un fichier).
const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'pages-en-anglais-'));
  dossiers.push(dossier);
  return dossier;
};
test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });
const scenarioModifie = (modifier) => {
  const fichier = path.join(dossierVide(), 'scenario.json');
  writeFileSync(fichier, JSON.stringify(modifier(JSON.parse(readFileSync(SCENARIO, 'utf8')))));
  return `scenario:${fichier}`;
};
// Un match de Premier League le samedi 24 octobre (15:00 au Royaume-Uni, 16:00 à Paris), et les bars qui le diffusent.
const avecUnMatchDePremierLeague = (bars) => scenarioModifie((brut) => ({
  ...brut,
  matches: [...brut.matches, {
    id: 'm-arsenal-chelsea', startAt: '2026-10-24T14:00:00.000Z', league: 'Premier League', homeTeam: 'Arsenal FC', awayTeam: 'Chelsea FC',
    homeClub: { slug: 'arsenal-fc', canonicalName: 'Arsenal FC' }, awayClub: { slug: 'chelsea-fc', canonicalName: 'Chelsea FC' },
  }],
  matchNights: [...brut.matchNights, ...bars.map((bar) => ({ id: `n-${bar}-pl`, status: 'OPEN', bar: { id: bar }, match: { id: 'm-arsenal-chelsea' }, offer: null }))],
}));

test.describe('le scénario : de vrais bars à Paris et à Lyon', () => {
  let site;
  test.beforeAll(async () => {
    site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu, images: true });
  });

  test('les pages en anglais : les trois guides, et un match seulement s’il est de Premier League, d’Europe ou du PSG', () => {
    expect(anglaises(site).map((p) => p.chemin).sort()).toEqual([
      '/en/', '/en/champions-league/', '/en/matches/le-havre-psg-2026-10-30/', '/en/matches/psg-barca-2026-10-24/', '/en/matches/psg-ol-2026-10-25/', '/en/premier-league/',
    ]);
    // Un match de Ligue 1 sans le PSG (Brest – Nice, Lille – Lens) a sa page en français, pas en anglais.
    for (const slug of ['brest-nice-2026-10-23', 'lille-lens-2026-10-26', 'om-nice-2026-10-28', 'le-havre-auxerre-2026-10-25']) {
      expect(site.pages.some((p) => p.chemin === `/matchs/${slug}/`), slug).toBe(true);
      expect(site.pages.some((p) => p.chemin === `/en/matches/${slug}/`), slug).toBe(false);
      expect(lienDeLangue(pageDe(site, `/matchs/${slug}/`)), slug).toBeNull();
    }
    // Aucune page refusée : chaque page en anglais passe le contrôle et la validation de ses données structurées.
    expect(site.refusees).toEqual([]);
  });

  test('chaque page : lang="en", sa tête (adresse canonique, aperçus en anglais), le fil en anglais, le pied du site en français', () => {
    for (const p of anglaises(site)) {
      expect(p.contenu.startsWith('<!doctype html>\n<html lang="en" class="jour">\n'), p.chemin).toBe(true);
      expect(p.contenu).toContain(`<link rel="canonical" href="${ORIGINE}${p.chemin}">`);
      expect(meta(p.contenu, 'og:locale'), p.chemin).toEqual(['en_GB']);
      expect(meta(p.contenu, 'og:url'), p.chemin).toEqual([`${ORIGINE}${p.chemin}`]);
      expect(meta(p.contenu, 'og:title'), p.chemin).toEqual([p.titre]);
      expect(p.contenu).toContain('<a class="lien-evitement" href="#contenu">Skip to content</a>');
      expect(p.contenu).toContain('<header class="entete page" lang="fr">');
      expect(p.contenu).toContain('<nav class="regarder-fil" aria-label="Breadcrumb">');
      const [page] = graphe(p);
      expect(page.inLanguage, p.chemin).toBe('en');
      const [fil] = graphe(p).filter((n) => n['@type'] === 'BreadcrumbList');
      expect(fil.itemListElement.slice(0, 2), p.chemin).toEqual([
        { '@type': 'ListItem', position: 1, name: 'Baromatch', item: `${ORIGINE}/` },
        { '@type': 'ListItem', position: 2, name: 'Football in Paris', item: `${ORIGINE}/en/` },
      ]);
      // Le pied de page du site, mot pour mot, dit en français (lang="fr"), sous une phrase en anglais.
      const pied = p.contenu.match(/<footer class="pied page" lang="fr">([\s\S]*?)<\/footer>/)?.[1] ?? '';
      expect(pied, p.chemin).toContain('<p class="pied__langue" lang="en">The rest of baromatch.fr is in French.</p>');
      const liens = [...pied.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, texte]) => [href, texte.replace(/&amp;/g, '&').replace(/[\s ]+/g, ' ').trim()]);
      expect(liens, p.chemin).toEqual(PIED);
    }
  });

  test('une page de match avec 2 vrais bars de Paris : indexable, et hreflang dans les deux sens avec sa jumelle', () => {
    const en = pageDe(site, '/en/matches/psg-barca-2026-10-24/');
    const fr = pageDe(site, '/matchs/psg-barca-2026-10-24/');
    expect([en.indexable, fr.indexable]).toEqual([true, true]);
    expect(robotsDe(en)).toBe('max-image-preview:large');
    expect(hreflangs(en)).toEqual(paire(fr.chemin, en.chemin));
    expect(hreflangs(fr)).toEqual(paire(fr.chemin, en.chemin));
    expect(lienDeLangue(en)).toEqual([fr.chemin, 'Version française']);
    expect(lienDeLangue(fr)).toEqual([en.chemin, 'English']);
    // Les deux vrais bars de Paris, par arrondissement, vers leur page (en français) ; aucune offre.
    expect([...en.contenu.matchAll(/<h3 class="regarder-carte__nom"><a href="([^"]+)" hreflang="fr">([^<]+)<\/a><\/h3>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['/bar/le-comptoir-du-canal-paris-10/', 'Le Comptoir du Canal'], ['/bar/le-zinc-des-amis-paris-11/', 'Le Zinc des Amis'],
    ]);
    expect(en.contenu).toContain('<p class="regarder-carte__lieu">10th arrondissement · 5 Quai de Valmy, 75010 Paris</p>');
    expect(en.contenu).toContain('<ul class="regarder-atouts"><li>3 screens</li><li>Match sound on</li><li>Terrace</li></ul>');
    expect(en.contenu).not.toMatch(/regarder-offre|burger|Une offre/i);
    expect(en.contenu).toContain('<p class="regarder-compte">2 bars in Paris</p>');
    // L’heure de Paris, à l’anglaise, et celle du Royaume-Uni ; le titre et l’affiche disent les clubs des données.
    expect(en.contenu).toContain('<p class="regarder-quand"><time datetime="2026-10-24T21:00:00+02:00">Sat 24 Oct, 9:00 pm (Paris time)</time></p>');
    expect(en.contenu).toContain('<p class="regarder-note">That’s 8:00 pm in the UK.</p>');
    expect(en.contenu).toContain('<h1 class="regarder-titre">Paris Saint-Germain v FC Barcelona: where to watch it in Paris</h1>');
    expect(en.titre).toBe('Paris Saint-Germain v FC Barcelona: where to watch in Paris');
    expect(en.description).toBe('Paris Saint-Germain v FC Barcelona, Sat 24 Oct, 9:00 pm (Paris time). 2 bars in Paris on Baromatch are showing it: the addresses, and kick-off in Paris time.');
    // Le fil passe par le guide de sa compétition.
    expect(graphe(en).find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.name)).toEqual(['Baromatch', 'Football in Paris', 'Champions League', 'Paris Saint-Germain v FC Barcelona']);
    // L’image de partage de sa jumelle, décrite en anglais.
    expect(meta(en.contenu, 'og:image')[0]).toMatch(/^https:\/\/baromatch\.fr\/matchs\/psg-barca-2026-10-24\/partage\.png\?v=[\w-]{10}$/);
    expect(meta(en.contenu, 'og:image')).toEqual(meta(fr.contenu, 'og:image'));
    expect(meta(en.contenu, 'twitter:image')).toEqual(meta(fr.contenu, 'og:image'));
    expect(meta(en.contenu, 'og:image:alt')).toEqual(['The match card: Paris Saint-Germain v FC Barcelona, Sat 24 Oct, 9:00 pm (Paris time).']);
  });

  test('un seul vrai bar de Paris : noindex, donc aucun hreflang, ni sur elle ni sur sa jumelle indexable', () => {
    const en = pageDe(site, '/en/matches/psg-ol-2026-10-25/');
    const fr = pageDe(site, '/matchs/psg-ol-2026-10-25/');
    // En français, 2 bars (Paris et Lyon) : indexable. En anglais, Paris seulement : 1 bar.
    expect([en.indexable, fr.indexable]).toEqual([false, true]);
    expect(robotsDe(en)).toBe('noindex');
    expect(hreflangs(en)).toEqual([]);
    expect(hreflangs(fr)).toEqual([]);
    // Le lien visible reste, dans les deux sens.
    expect(lienDeLangue(en)).toEqual([fr.chemin, 'Version française']);
    expect(lienDeLangue(fr)).toEqual([en.chemin, 'English']);
    // Le bar de Lyon n’est pas sur la page : la version française le montre.
    expect(en.contenu).toContain('Le Zinc des Amis');
    expect(en.contenu).not.toContain('La Cave des Gones');
    expect(en.contenu).toContain(`Bars in other French cities showing it are on the <a href="${fr.chemin}" hreflang="fr">French version of this page</a>.`);
    // Après le changement d’heure, le décalage d’hiver, et toujours une heure de moins au Royaume-Uni.
    expect(en.contenu).toContain('<time datetime="2026-10-25T20:45:00+01:00">Sun 25 Oct, 8:45 pm (Paris time)</time>');
    expect(en.contenu).toContain('That’s 7:45 pm in the UK.');
  });

  test('Paris en anglais (/en/) : indexable avec un vrai bar pour un match choisi, hreflang avec la page de Paris', () => {
    const en = pageDe(site, '/en/');
    const fr = pageDe(site, '/regarder-le-match/paris/');
    expect([en.indexable, fr.indexable]).toEqual([true, true]);
    expect(hreflangs(en)).toEqual(paire(fr.chemin, en.chemin));
    expect(hreflangs(fr)).toEqual(paire(fr.chemin, en.chemin));
    expect(lienDeLangue(fr)).toEqual(['/en/', 'English']);
    expect(en.titre).toBe('Where to watch football in Paris — Baromatch');
    expect(en.description).toBe('2 bars in Paris on Baromatch are showing Premier League, European or PSG matches soon. Kick-off in Paris time, and the addresses.');
    // Les matchs à venir, sous leur jour ; les deux vrais bars de Paris, pas ceux de Lyon ni de Rennes.
    expect(en.contenu).toContain('<h3 class="regarder-jour">Saturday 24 October</h3>');
    expect(sansInsignes(en.contenu)).toContain('<li><a class="regarder-matchs__match" href="/en/matches/psg-barca-2026-10-24/">Paris Saint-Germain v FC Barcelona</a> <span class="regarder-matchs__infos"><time datetime="2026-10-24T21:00:00+02:00">9:00 pm</time> · Champions League · <span class="regarder-compte">2 bars in Paris</span></span></li>');
    expect(en.contenu).not.toMatch(/Cave des Gones|Bon Coin|Café des Sports/);
    expect(en.barsNommes.sort()).toEqual(['b-comptoir', 'b-zinc']);
  });

  test('les guides : la Ligue des champions indexable (un vrai bar de Paris), la Premier League sans match en noindex', () => {
    const ldc = pageDe(site, '/en/champions-league/');
    expect(ldc.indexable).toBe(true);
    expect(hreflangs(ldc)).toEqual([]);
    expect(lienDeLangue(ldc)).toBeNull();
    // Une sélection, jamais « tous les matchs » ; le calendrier européen des données ne suit que des clubs français.
    expect(texteVisible(ldc.contenu)).toContain('The Champions League matches in Baromatch’s calendar for the next two weeks');
    expect(ldc.contenu).toContain('Baromatch’s calendar has a selection of Champions League matches, not every one. For now, it follows the French clubs in Europe.');
    const pl = pageDe(site, '/en/premier-league/');
    expect(pl.indexable).toBe(false);
    expect(robotsDe(pl)).toBe('noindex');
    expect(pl.contenu).toContain('No Premier League match in Baromatch’s calendar for the next two weeks.');
    // « For now », pas « yet » : vrai aussi quand un bar en a montré un, passé depuis (le guide reste alors 30 jours indexable).
    expect(pl.contenu).toContain('For now, no Paris bar on Baromatch has listed an upcoming Premier League match.');
    expect(pl.description).toBe('The Premier League matches in Baromatch’s calendar for the next two weeks, with kick-off in Paris time, one hour ahead of the UK.');
    // Les guides prennent l’image générale du site, décrite en anglais.
    for (const guide of [ldc, pl, pageDe(site, '/en/')]) {
      expect(meta(guide.contenu, 'og:image'), guide.chemin).toEqual([IMAGE_DU_SITE]);
      expect(meta(guide.contenu, 'og:image:alt'), guide.chemin).toEqual([TEXTES_EN.imageAlt]);
    }
  });

  test('ce que les pages disent : l’état de l’appli d’emblée, aucun « ! », aucun mot de boisson, aucun score, rien de promis', () => {
    for (const p of anglaises(site)) {
      const tete = p.contenu.match(/<header class="regarder-tete">[\s\S]*?<\/header>/)[0];
      expect(tete, p.chemin).toContain(`<p class="regarder-note">${TEXTES_EN.appli.fermee}</p>`);
      const texte = `${p.titre} ${p.description} ${texteVisible(p.contenu)}`;
      expect(texte, p.chemin).not.toContain('!');
      expect(texte.replace(/Le Zinc des Amis|Le Comptoir du Canal/g, ''), p.chemin).not.toMatch(BOISSONS_EN_ANGLAIS);
      expect(texte, p.chemin).not.toMatch(/\bscores?\b|\bplaces\b|every match|all (?:the )?matches|réserv/i);
      // Le bloc « Partager », en anglais.
      expect(p.contenu, p.chemin).toContain('<div class="partage" role="group" aria-label="Share this page"');
      expect(p.contenu, p.chemin).toContain('data-copie="Link copied."');
      expect(p.contenu, p.chemin).toContain('>Send on WhatsApp</a>');
      // La liste d’attente de Paris : l’adresse et la ville, rien d’autre, vers le même envoi que l’accueil.
      expect(p.contenu, p.chemin).toContain('<input type="hidden" name="ville" value="Paris">');
      expect([...p.contenu.matchAll(/<(?:input|select|textarea)[^>]* name="([^"]+)"/g)].map((m) => m[1]).sort(), p.chemin).toEqual(['_gotcha', '_subject', 'email', 'ville']);
    }
  });

  test('l’appli ouverte : son lien de magasin et « Get the app », plus de liste d’attente', async () => {
    const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
    const autre = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: ouverte });
    const p = pageDe(autre, '/en/matches/psg-barca-2026-10-24/');
    expect(p.contenu).toContain('<a class="capsule" href="https://magasin.exemple/baromatch-android">Get the app · Android</a>');
    expect(p.contenu).toContain('Good to know: the Baromatch app works in English as well as French, on Android.');
    expect(p.contenu).not.toContain('name="email"');
    expect(p.contenu).not.toContain('When the app opens');
  });
});

test.describe('d’autres jours', () => {
  test('la copie enregistrée (aucun vrai bar) : chaque page en anglais en noindex, aucun hreflang nulle part', async () => {
    const site = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: ENREGISTREMENT, racine, contenu: chargerLeContenu(racine) });
    const en = anglaises(site);
    expect(en.every((p) => !p.indexable && robotsDe(p) === 'noindex')).toBe(true);
    expect(site.pages.filter((p) => hreflangs(p).length)).toEqual([]);
    // Les matchs choisis de la copie : la Premier League, les coupes d’Europe (seulement des clubs français ici) et le PSG.
    expect(en.filter((p) => p.type === 'match-en').map((p) => p.cle)).toEqual([
      'everton-chelsea-2026-10-17', 'strasbourg-psg-2026-10-17', 'newcastle-aston-villa-2026-10-17', 'psg-barca-2026-10-20', 'lille-galatasaray-2026-10-21',
      'bruges-lens-2026-10-21', 'juventus-rennes-2026-10-22', 'sturm-graz-om-2026-10-22', 'monaco-fribourg-2026-10-22', 'hoffenheim-ol-2026-10-22',
      'aston-villa-man-city-2026-10-24', 'arsenal-everton-2026-10-24', 'chelsea-tottenham-2026-10-24', 'psg-ol-2026-10-25',
    ]);
    // Chaque page de match française a sa jumelle exactement quand son match est choisi ; aucune pour la Liga, la
    // Bundesliga, la Serie A ou la Ligue 1 sans le PSG.
    const competitionsChoisies = ['Premier League', 'Ligue des champions', 'Ligue Europa', 'Ligue Conférence'];
    for (const fr of site.pages.filter((p) => p.type === 'match')) {
      const choisi = competitionsChoisies.includes(fr.memoire.competition) || [fr.memoire.domicile.cle, fr.memoire.exterieur.cle].includes('psg');
      expect(site.pages.some((p) => p.chemin === `/en/matches/${fr.cle}/`), fr.chemin).toBe(choisi);
      expect(lienDeLangue(fr)?.[0] ?? null, fr.chemin).toBe(choisi ? `/en/matches/${fr.cle}/` : null);
    }
    // Sans vrai bar : la page le dit, avec l’heure ; aucun nombre de bars.
    const pl = pageDe(site, '/en/matches/everton-chelsea-2026-10-17/');
    expect(pl.contenu).toContain('No Paris bar has listed this match on Baromatch yet.');
    // The bars card: what is true before the app opens, and a button straight to the (French) form.
    expect(pl.contenu).toContain('<p><strong>Run a bar in Paris?</strong> Baromatch is looking for its first bars. The page for bars is in French.</p>');
    expect(pl.contenu).toContain('<a class="regarder-bars-pro__bouton" href="/pour-les-bars.html#proposer" hreflang="fr">Suggest your bar</a>');
    expect(pl.contenu).not.toContain('List your match nights');
    expect(pl.contenu).toContain('Sat 17 Oct, 1:30 pm (Paris time)');
    expect(pl.contenu).toContain('That’s 12:30 pm in the UK.');
    for (const p of en) expect(texteVisible(p.contenu), p.chemin).not.toMatch(/\d+ (?:Paris bars?|bars? in Paris)/);
    expect(pageDe(site, '/en/').contenu).toContain(TEXTES_EN.paris.sansBar);
    expect(pageDe(site, '/en/champions-league/').contenu).toContain('For now, it follows the French clubs in Europe.');
  });

  test('un vrai bar de Paris montre un match de Premier League : le guide indexable, la page du match pas encore', async () => {
    const site = await construireEnMemoire({ source: avecUnMatchDePremierLeague(['b-zinc']), maintenant: VENDREDI, racine, contenu });
    expect(pageDe(site, '/en/premier-league/').indexable).toBe(true);
    const en = pageDe(site, '/en/matches/arsenal-chelsea-2026-10-24/');
    const fr = pageDe(site, '/matchs/arsenal-chelsea-2026-10-24/');
    expect([en.indexable, fr.indexable]).toEqual([false, false]);
    expect([hreflangs(en), hreflangs(fr)]).toEqual([[], []]);
    expect(en.contenu).toContain('<time datetime="2026-10-24T16:00:00+02:00">Sat 24 Oct, 4:00 pm (Paris time)</time>');
    expect(en.contenu).toContain('That’s 3:00 pm in the UK.');
    expect(sansInsignes(pageDe(site, '/en/premier-league/').contenu)).toContain('<a class="regarder-matchs__match" href="/en/matches/arsenal-chelsea-2026-10-24/">Arsenal FC v Chelsea FC</a> <span class="regarder-matchs__infos"><time datetime="2026-10-24T16:00:00+02:00">4:00 pm</time> · Premier League · <span class="regarder-compte">1 bar in Paris</span></span>');
  });

  test('deux vrais bars de Paris le montrent : la page du match indexable, hreflang dans les deux sens', async () => {
    const site = await construireEnMemoire({ source: avecUnMatchDePremierLeague(['b-zinc', 'b-comptoir']), maintenant: VENDREDI, racine, contenu });
    const en = pageDe(site, '/en/matches/arsenal-chelsea-2026-10-24/');
    const fr = pageDe(site, '/matchs/arsenal-chelsea-2026-10-24/');
    expect([en.indexable, fr.indexable]).toEqual([true, true]);
    expect(hreflangs(en)).toEqual(paire(fr.chemin, en.chemin));
    expect(hreflangs(fr)).toEqual(paire(fr.chemin, en.chemin));
    expect(graphe(en).find((n) => n['@type'] === 'BreadcrumbList').itemListElement[2]).toEqual({ '@type': 'ListItem', position: 3, name: 'Premier League', item: `${ORIGINE}/en/premier-league/` });
  });

  test('Paris seulement : un bar de Lyon qui montre un match de Premier League ne rend rien indexable en anglais', async () => {
    const site = await construireEnMemoire({ source: avecUnMatchDePremierLeague(['b-gones', 'b-coin']), maintenant: VENDREDI, racine, contenu });
    expect(pageDe(site, '/matchs/arsenal-chelsea-2026-10-24/').indexable).toBe(true);
    expect(pageDe(site, '/en/matches/arsenal-chelsea-2026-10-24/').indexable).toBe(false);
    expect(pageDe(site, '/en/premier-league/').indexable).toBe(false);
    expect(hreflangs(pageDe(site, '/matchs/arsenal-chelsea-2026-10-24/'))).toEqual([]);
  });

  test('un match européen sans club français dans les données : la page ne dit plus qu’elle suit les clubs français', async () => {
    const source = scenarioModifie((brut) => ({
      ...brut,
      matches: [...brut.matches, {
        id: 'm-real-bayern', startAt: '2026-10-27T20:00:00.000Z', league: 'UEFA Champions League', homeTeam: 'Real Madrid CF', awayTeam: 'FC Bayern München',
        homeClub: { slug: 'real-madrid-cf', canonicalName: 'Real Madrid CF' }, awayClub: { slug: 'fc-bayern-munchen', canonicalName: 'FC Bayern München' },
      }],
    }));
    const site = await construireEnMemoire({ source, maintenant: VENDREDI, racine, contenu });
    const ldc = pageDe(site, '/en/champions-league/');
    expect(ldc.contenu).toContain('Baromatch’s calendar has a selection of Champions League matches, not every one.</p>');
    expect(ldc.contenu).not.toContain('French clubs');
    expect(site.pages.some((p) => p.chemin === '/en/matches/real-madrid-bayern-2026-10-27/')).toBe(true);
  });

  test('une jumelle française refusée : la page en anglais n’a ni lien vers elle, ni hreflang, ni son image', async () => {
    // Un texte fixe des pages de matchs que le contrôle refuse : chaque page de match en français est refusée.
    const refuse = { ...contenu, textes: { ...contenu.textes, match: { ...contenu.textes.match, titreBars: 'Où le regarder !' } } };
    const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu: refuse, images: true });
    expect(site.refusees.map((p) => p.chemin)).toContain('/matchs/psg-barca-2026-10-24/');
    const en = pageDe(site, '/en/matches/psg-barca-2026-10-24/');
    expect(en.indexable).toBe(true);
    expect(hreflangs(en)).toEqual([]);
    expect(lienDeLangue(en)).toBeNull();
    expect(meta(en.contenu, 'og:image')).toEqual([IMAGE_DU_SITE]);
    expect(controlerLaPage(en)).toEqual([]);
    // La page de Paris, elle, passe : /en/ garde ses liens.
    expect(hreflangs(pageDe(site, '/en/'))).toEqual(paire('/regarder-le-match/paris/', '/en/'));
  });
});

test.describe('le contrôle et l’écriture', () => {
  test('le contrôle refuse une page en anglais qui parle de boire, qui se dit en français, ou un hreflang en noindex', async () => {
    const site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu });
    const en = pageDe(site, '/en/matches/psg-ol-2026-10-25/');
    expect(controlerLaPage(en)).toEqual([]);
    const avec = (remplacer, p = en) => controlerLaPage({ ...p, contenu: remplacer(p.contenu) }).join('\n');
    for (const mot of ['Pints from 6 pm.', 'Cold beers on tap.', 'Two drinks for one.', 'Happy hour before kick-off.']) {
      expect(avec((h) => h.replace('</main>', `<p>${mot}</p></main>`)), mot).toMatch(/un mot de boisson sur une page en anglais/);
    }
    // Un nom de bar est le sien : « The Beer Garden » ne refuse rien.
    expect(controlerLaPage({ ...en, contenu: en.contenu.replace('</main>', '<p>The Beer Garden</p></main>') }, { motsDesBars: ['The Beer Garden'] })).toEqual([]);
    // La même phrase sur une page en français n’est pas jugée par cette liste-là.
    const fr = pageDe(site, '/matchs/psg-ol-2026-10-25/');
    expect(avec((h) => h.replace('</main>', '<p>Drinks</p></main>'), fr)).not.toMatch(/boisson/);
    expect(avec((h) => h.replace('<html lang="en" class="jour">', '<html lang="fr" class="jour">'))).toMatch(/<html lang="en" class="jour"> attendu en tête/);
    // Une page sans le jour (la classe jour de sa balise html) : refusée aussi, en anglais comme en français.
    expect(avec((h) => h.replace('<html lang="en" class="jour">', '<html lang="en">'))).toMatch(/<html lang="en" class="jour"> attendu en tête/);
    expect(avec((h) => h.replace('<html lang="fr" class="jour">', '<html lang="fr">'), fr)).toMatch(/<html lang="fr" class="jour"> attendu en tête/);
    // hreflang sur une page en noindex : refusé, en anglais comme en français.
    const lie = avecLesLangues(en.contenu, { autre: { chemin: fr.chemin, langue: 'fr', texte: 'Version française' }, alternatives: [{ hreflang: 'fr', chemin: fr.chemin }, { hreflang: 'en', chemin: en.chemin }] });
    expect(controlerLaPage({ ...en, contenu: lie }).join()).toMatch(/hreflang sur une page en noindex/);
    const jumelle = pageDe(site, '/matchs/psg-barca-2026-10-24/');
    expect(hreflangs(jumelle)).toHaveLength(3);
    expect(controlerLaPage({ ...jumelle, indexable: false, contenu: jumelle.contenu.replace('max-image-preview:large', 'noindex') }).join()).toMatch(/hreflang sur une page en noindex/);
    // Un gabarit qui perdrait l’adresse canonique : les liens de langue ne se posent pas en silence.
    expect(() => avecLesLangues('<html></html>', { autre: { chemin: '/', langue: 'fr', texte: 'x' } })).toThrow(/gabarit/);
  });

  test('un texte faux sur chaque page en anglais (leur gabarit commun) : toutes refusées, le passage s’arrête sans rien écrire', async () => {
    const sortie = dossierVide();
    await construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: VENDREDI, racine, contenu, rendu: null });
    const etatAvant = readFileSync(path.join(sortie, 'regarder-le-match', 'etat.json'), 'utf8');
    const faux = { ...contenu, anglais: { ...TEXTES_EN, fil: { ...TEXTES_EN.fil, accueil: 'Baromatch !' } } };
    await expect(construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: VENDREDI + 3_600_000, racine, contenu: faux, rendu: null })).rejects.toThrow(/Pages refusées, rien n’est écrit/);
    expect(readFileSync(path.join(sortie, 'regarder-le-match', 'etat.json'), 'utf8')).toBe(etatAvant);
  });

  test('la liste blanche : en/ et ses pages, rien d’autre ; le plan du site les remplace sans les doubler', () => {
    for (const permis of ['en/index.html', 'en/premier-league/index.html', 'en/matches/psg-ol-2026-10-25/index.html']) expect(estPermis(permis), permis).toBe(true);
    for (const refuse of ['en/partage.png', 'en/matches/x/badge.svg', 'en/x.html', 'en/../index.html', 'en/Matches/x/index.html', 'english/index.html']) expect(estPermis(refuse), refuse).toBe(false);
    const ancien = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://baromatch.fr/</loc><lastmod>2026-10-19</lastmod></url>\n  <url><loc>https://baromatch.fr/en/</loc><lastmod>2026-10-20</lastmod></url>\n</urlset>\n';
    const plan = nouveauPlan(ancien, { pages: { '/en/': { indexable: true, change: '2026-10-23' }, '/en/premier-league/': { indexable: false, change: '2026-10-23' } } });
    expect(plan).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://baromatch.fr/</loc><lastmod>2026-10-19</lastmod></url>\n  <url><loc>https://baromatch.fr/en/</loc><lastmod>2026-10-23</lastmod></url>\n</urlset>\n');
  });

  test('d’un passage à l’autre : indexables dans le plan du site et IndexNow, puis le match passé, puis effacé avec sa jumelle', async () => {
    const sortie = dossierVide();
    const passer = (maintenant, options = {}) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu, rendu: null, ...options });
    const lire = (relatif) => readFileSync(path.join(sortie, relatif), 'utf8');
    const etat = () => JSON.parse(lire('regarder-le-match/etat.json'));
    const premier = await passer('2026-10-23T08:00:00Z');
    const plan = lire('sitemap.xml');
    for (const chemin of ['/en/', '/en/champions-league/', '/en/matches/psg-barca-2026-10-24/']) {
      expect(plan, chemin).toContain(`<loc>${ORIGINE}${chemin}</loc>`);
      expect(premier.changees, chemin).toContain(`${ORIGINE}${chemin}`);
    }
    for (const chemin of ['/en/premier-league/', '/en/matches/psg-ol-2026-10-25/']) expect(plan, chemin).not.toContain(`<loc>${ORIGINE}${chemin}</loc>`);
    expect(etat().pages['/en/matches/psg-barca-2026-10-24/']).toMatchObject({ type: 'match-en', cle: 'psg-barca-2026-10-24', indexable: true, bars: ['b-comptoir', 'b-zinc'] });
    expect(etat().pages['/en/']).toMatchObject({ type: 'guide-en', cle: 'paris', indexable: true });
    expect(existsSync(path.join(sortie, 'en', 'index.html'))).toBe(true);

    // Le lundi 26 : le match est passé. Les deux pages le disent, sans score, en noindex, sans hreflang ; IndexNow le sait.
    const lundi = await passer('2026-10-26T08:00:00Z');
    const en = lire('en/matches/psg-barca-2026-10-24/index.html');
    expect(en).toContain('<h2 id="titre-passe">This match has been played</h2>');
    expect(en).toContain('<meta name="robots" content="noindex">');
    expect(en).not.toContain('hreflang="x-default"');
    expect(en).toContain('<p class="regarder-langue"><a href="/matchs/psg-barca-2026-10-24/" hreflang="fr" lang="fr">Version française</a></p>');
    expect(en).toContain('Next for Paris Saint-Germain: <a href="/en/matches/le-havre-psg-2026-10-30/">Le Havre AC v Paris Saint-Germain</a>');
    expect(lire('matchs/psg-barca-2026-10-24/index.html')).not.toContain('hreflang="x-default"');
    expect(lundi.changees).toEqual(expect.arrayContaining([`${ORIGINE}/en/matches/psg-barca-2026-10-24/`, `${ORIGINE}/matchs/psg-barca-2026-10-24/`]));
    expect(lire('sitemap.xml')).not.toContain('psg-barca');

    // Plus de 30 jours après le match : les deux pages sont effacées, comme leur entrée dans l’état.
    await passer('2026-11-24T08:00:00Z');
    expect(existsSync(path.join(sortie, 'en', 'matches', 'psg-barca-2026-10-24'))).toBe(false);
    expect(existsSync(path.join(sortie, 'matchs', 'psg-barca-2026-10-24'))).toBe(false);
    expect(Object.keys(etat().pages).filter((c) => c.includes('psg-barca'))).toEqual([]);
    // Les guides restent.
    expect(existsSync(path.join(sortie, 'en', 'premier-league', 'index.html'))).toBe(true);
  });

  test('le guide de la Premier League : indexable tant qu’un bar de Paris montre un de ses matchs, puis 30 jours encore', async () => {
    const sortie = dossierVide();
    const source = avecUnMatchDePremierLeague(['b-zinc']);
    const passer = (maintenant) => construire({ source, sortie, maintenant: Date.parse(maintenant), racine, contenu, rendu: null });
    const guide = () => JSON.parse(readFileSync(path.join(sortie, 'regarder-le-match', 'etat.json'), 'utf8')).pages['/en/premier-league/'];
    await passer('2026-10-23T08:00:00Z');
    expect(guide()).toMatchObject({ type: 'guide-en', indexable: true, memoire: { derniereSoiree: '2026-10-24T14:00:00.000Z' } });
    // Le lundi 26 : Arsenal – Chelsea est passé, aucun bar de Paris ne montre de match de Premier League. Le guide le dit,
    // et reste indexable : il ne sort pas de l’index d’un week-end à l’autre.
    await passer('2026-10-26T08:00:00Z');
    expect(guide()).toMatchObject({ indexable: true, memoire: { derniereSoiree: '2026-10-24T14:00:00.000Z' } });
    expect(readFileSync(path.join(sortie, 'sitemap.xml'), 'utf8')).toContain('<loc>https://baromatch.fr/en/premier-league/</loc>');
    const page = readFileSync(path.join(sortie, 'en', 'premier-league', 'index.html'), 'utf8');
    expect(page).toContain('For now, no Paris bar on Baromatch has listed an upcoming Premier League match.');
    expect(page).not.toContain('Le Zinc des Amis');
    // 30 jours après le coup d’envoi : noindex, hors du plan du site, et IndexNow le sait.
    const apres = await passer('2026-11-23T15:00:00Z');
    expect(guide().indexable).toBe(false);
    expect(apres.changees).toContain(`${ORIGINE}/en/premier-league/`);
    expect(readFileSync(path.join(sortie, 'sitemap.xml'), 'utf8')).not.toContain('/en/premier-league/');
  });

  test('un match retiré du programme : « no longer in the calendar », en noindex, comme sa jumelle', async () => {
    const sortie = dossierVide();
    await construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: VENDREDI, racine, contenu, rendu: null });
    const sansBarca = scenarioModifie((brut) => ({ ...brut, matches: brut.matches.filter((m) => !m.id.startsWith('m-psg-barca')), matchNights: brut.matchNights.filter((n) => !n.match.id.startsWith('m-psg-barca')) }));
    const resultat = await construire({ source: sansBarca, sortie, maintenant: VENDREDI + 3_600_000, racine, contenu, rendu: null });
    const en = resultat.fichiers.find((f) => f.chemin === '/en/matches/psg-barca-2026-10-24/');
    expect(en.indexable).toBe(false);
    expect(en.contenu).toContain('<h2 id="titre-passe">This match is no longer in the calendar</h2>');
    expect(en.contenu).not.toMatch(/Le Zinc|Comptoir/);
    expect(resultat.changees).toContain(`${ORIGINE}/en/matches/psg-barca-2026-10-24/`);
  });
});

test.describe('les textes en anglais', () => {
  test('l’heure de Paris, écrite à l’anglaise', () => {
    expect(heureALAnglaise(Date.parse('2026-10-24T19:00:00Z'))).toBe('9:00 pm');
    expect(heureALAnglaise(Date.parse('2026-10-24T10:30:00Z'))).toBe('12:30 pm');
    expect(heureALAnglaise(Date.parse('2026-10-24T22:05:00Z'))).toBe('12:05 am');
    expect(heureALAnglaise(Date.parse('2026-10-24T19:00:00Z'), 'Europe/London')).toBe('8:00 pm');
    expect(jourEntierALAnglaise(Date.parse('2026-11-01T12:00:00Z'))).toBe('Sunday 1 November');
    expect(quandALAnglaise({ debut: Date.parse('2026-10-31T19:00:00Z'), heureConfirmee: false })).toBe('Sat 31 Oct, kick-off time to be confirmed');
  });

  test('en.json : ni « ! », ni mot de boisson, ni « score » ou « places », ni espace avant « : », et une sélection dite comme telle', () => {
    const textes = JSON.parse(readFileSync(path.join(racine, 'generateur', 'contenu', 'en.json'), 'utf8'));
    const { _lisezMoi: _, ...affiches } = textes;
    const tout = JSON.stringify(affiches);
    expect(tout).not.toContain('!');
    expect(tout).not.toMatch(BOISSONS_EN_ANGLAIS);
    expect(tout).not.toMatch(/\bscores?\b|\bplaces\b|every match|all (?:the )?matches/i);
    expect(tout.match(/.{20} [?:;]/g)).toBeNull();
    expect(textes.premierLeague.chapeau).toContain('the Premier League matches in Baromatch’s calendar');
    expect(textes.championsLeague.chapeau).toContain('The Champions League matches in Baromatch’s calendar');
    expect(Object.keys(textes.selection).sort()).toEqual(['Ligue Conférence', 'Ligue Europa', 'Ligue des champions', 'Premier League']);
    expect(textes.clubsSuivis).toEqual(['psg']);
    // Les bars du scénario publiés : le test ne dépend pas de la liste du dépôt, vide aujourd’hui.
    expect(PUBLIES_DU_SCENARIO).toEqual(expect.arrayContaining(['b-zinc', 'b-comptoir']));
  });

  test('les noms de compétitions reçus en anglais ou en français mènent aux mêmes pages', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    // Le scénario a le même match sous « Ligue des champions » et « UEFA Champions League » : une seule page, en anglais aussi.
    expect(brut.matches.filter((m) => m.id.startsWith('m-psg-barca')).map((m) => m.league).sort()).toEqual(['Ligue des champions', 'UEFA Champions League']);
    const site = await construireEnMemoire({ brut, maintenant: VENDREDI, racine, contenu });
    expect(anglaises(site).filter((p) => p.chemin.includes('psg-barca')).map((p) => p.chemin)).toEqual(['/en/matches/psg-barca-2026-10-24/']);
  });
});
