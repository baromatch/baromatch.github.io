// La page des bars en anglais (/en/for-bars/), pour les pubs anglais et irlandais de Paris : la même page que
// pour-les-bars.html (mêmes feuilles, même script, même formulaire, même serveur), avec ses mots à elle. Ce fichier reprend,
// en anglais, ce que tests/pour-les-bars.spec.mjs vérifie de la page française : sa tête, ses sections, son cadre, ses
// données structurées, ce qu’elle charge et ce qu’elle ne dit jamais, son premier écran, sans JavaScript, sur un petit
// écran, avec le texte agrandi ; puis ce qui lui est propre : hreflang dans les deux sens, le plan du site, le résumé en
// anglais des parties « Les demandes des bars » et « Les bars que nous contactons » de la page Confidentialité, aucun mot de
// boisson (une page en anglais n’en écrit aucun). Le formulaire est vérifié par for-bars-en-formulaire.spec.mjs.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { racine } from './outils/environnement.mjs';
import { PAGES_DU_CADRE } from '../generateur/cadre.mjs';
import { BOISSONS_EN_ANGLAIS } from '../generateur/controle.mjs';
import { nouveauPlan } from '../generateur/etat.mjs';
import { mesureDuSite, pagesEcritesALaMain, politiqueAvecLaMesure } from '../generateur/mesure.mjs';

const PAGE = '/en/for-bars/';
const FICHIER = 'en/for-bars/index.html';
const FRANCAIS = '/pour-les-bars.html';
const ORIGINE = 'https://baromatch.fr';
const CANONIQUE = `${ORIGINE}${PAGE}`;
const CANONIQUE_FR = `${ORIGINE}${FRANCAIS}`;
const API = 'https://api-production-8ce4.up.railway.app';
const ADRESSE = `${API}/api/public/bar-contact`;

const TITRE = 'Match nights, your bar on Baromatch — For bars';
const DESCRIPTION = 'Baromatch shows your bar to fans looking for where to watch the match, and holds their places. Free during the launch. Request to join.';
const IMAGE_OG = '/img/og-bars-2026-10.jpg';

const lire = (fichier) => readFileSync(`${racine}/${fichier}`, 'utf8');
const SOURCE = lire(FICHIER);
const SOURCE_FR = lire('pour-les-bars.html');
const CONFIDENTIALITE = lire('confidentialite.html');
const MESURE = mesureDuSite();
const premierEcran = (html) => html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const empreinte = (style) => `'sha256-${createHash('sha256').update(style).digest('base64')}'`;
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
// Le texte d’un morceau de HTML : les blocs se séparent d’une espace, les balises dans une ligne (lien, gras, <wbr>) se
// referment sur leur mot.
const texteDe = (html) => normaliser(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<\/?(?:li|ul|ol|p|h\d|section|div|summary|details|br|label|button|footer|header|nav)\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '\''));
const principal = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const MAIN_EN = principal(SOURCE);

// ---------- La tête, les deux langues ----------

test.describe('the head, and the two languages', () => {
  test('title, description, canonical address, share card, style sheets and font', async ({ page }) => {
    await page.goto(PAGE);
    const tete = await page.evaluate(() => {
      const contenu = (selecteur) => [...document.querySelectorAll(selecteur)].map((e) => e.getAttribute('content'));
      return {
        langue: document.documentElement.lang,
        titre: document.title,
        description: contenu('meta[name="description"]'),
        robots: contenu('meta[name="robots"]'),
        canonique: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
        ogTitre: contenu('meta[property="og:title"]'),
        ogDescription: contenu('meta[property="og:description"]'),
        ogUrl: contenu('meta[property="og:url"]'),
        ogLocale: contenu('meta[property="og:locale"]'),
        ogImage: contenu('meta[property="og:image"]'),
        ogImageAlt: contenu('meta[property="og:image:alt"]').length,
        twitter: [...contenu('meta[name="twitter:card"]'), ...contenu('meta[name="twitter:site"]')],
        police: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => [l.getAttribute('href'), l.getAttribute('as')]),
      };
    });
    expect(tete).toEqual({
      langue: 'en',
      titre: TITRE,
      description: [DESCRIPTION],
      robots: ['max-image-preview:large'],
      canonique: [CANONIQUE],
      ogTitre: [TITRE],
      ogDescription: [DESCRIPTION],
      ogUrl: [CANONIQUE],
      ogLocale: ['en_GB'],
      ogImage: [`${ORIGINE}${IMAGE_OG}`],
      ogImageAlt: 1,
      twitter: ['summary_large_image', '@baromatchapp'],
      police: [['/fonts/bricolage-grotesque.woff2', 'font']],
    });
    expect(TITRE.length).toBeGreaterThanOrEqual(15);
    expect(TITRE.length).toBeLessThanOrEqual(60);
    expect(DESCRIPTION.length).toBeGreaterThanOrEqual(70);
    expect(DESCRIPTION.length).toBeLessThanOrEqual(155);
    // Les feuilles : styles.css dans la tête, pour-les-bars.css après le premier écran (le <noscript> de la tête pour qui n’a pas
    // JavaScript), comme la page française.
    expect([...SOURCE.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1])).toEqual(['/styles.css', '/pour-les-bars.css']);
    expect(SOURCE).toContain('<noscript><link rel="stylesheet" href="/pour-les-bars.css"></noscript>');
  });

  test('hreflang both ways: the same three links on both pages, French and English each pointing at the other, x-default on the French one', () => {
    const alternatives = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
    const attendues = [['fr', CANONIQUE_FR], ['en', CANONIQUE], ['x-default', CANONIQUE_FR]];
    expect(alternatives(SOURCE)).toEqual(attendues);
    expect(alternatives(SOURCE_FR)).toEqual(attendues);
    // Juste après l’adresse canonique, dans la tête, comme les pages jumelles du générateur (avecLesLangues).
    expect(SOURCE).toContain(`<link rel="canonical" href="${CANONIQUE}">\n<link rel="alternate" hreflang="fr"`);
    expect(SOURCE_FR).toContain(`<link rel="canonical" href="${CANONIQUE_FR}">\n<link rel="alternate" hreflang="fr"`);
    // Deux pages indexables : aucune des deux n’est en noindex.
    for (const html of [SOURCE, SOURCE_FR]) expect(html).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
  });

  test('the visible links between the two pages: in a sentence of the hero, with their language; the French address does not move', async ({ page }) => {
    await page.goto(PAGE);
    const versFrancais = page.locator('.ouverture-bars a[hreflang="fr"]');
    await expect(versFrancais).toHaveAttribute('href', FRANCAIS);
    await expect(versFrancais).toHaveAttribute('lang', 'fr');
    await expect(versFrancais).toHaveText('en français');
    await expect(page.locator('.ouverture-bars__delai', { has: page.locator('a[hreflang="fr"]') })).toHaveText('This page is also en français.');
    await page.goto(FRANCAIS);
    const versAnglais = page.locator('.ouverture-bars a[hreflang="en"]');
    await expect(versAnglais).toHaveAttribute('href', PAGE);
    await expect(page.locator('.ouverture-bars__delai[lang="en"]', { has: page.locator('a[hreflang="en"]') })).toHaveText('Running a pub in Paris? This page is also in English.');
    // L’adresse française reste la sienne : son canonique, son titre, son plan.
    expect(SOURCE_FR).toContain(`<link rel="canonical" href="${CANONIQUE_FR}">`);
    expect(readFileSync(`${racine}/sitemap.xml`, 'utf8')).toContain(`<loc>${CANONIQUE_FR}</loc>`);
  });

  test('the site map has the page, with a real date, and the generator keeps its line when it rewrites the plan', () => {
    const plan = lire('sitemap.xml');
    const ligne = plan.match(new RegExp(`<url><loc>${CANONIQUE}</loc><lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod></url>`));
    expect(ligne, 'une ligne pour /en/for-bars/').toBeTruthy();
    expect(Number.isNaN(Date.parse(ligne[1]))).toBe(false);
    // Une page du générateur n’y reste que si l’état la connaît : celle-ci est écrite à la main, la sienne reste.
    const refait = nouveauPlan(plan, { pages: {} });
    expect(refait).toContain(`<loc>${CANONIQUE}</loc>`);
    expect(refait).toContain(`<loc>${CANONIQUE_FR}</loc>`);
    expect(refait).not.toContain('/en/premier-league/');
    // Les pages en anglais du générateur, elles, sont bien retirées du plan quand l’état ne les connaît plus.
    const avecGuide = plan.replace('</urlset>', `  <url><loc>${ORIGINE}/en/premier-league/</loc><lastmod>2026-11-01</lastmod></url>\n</urlset>`);
    expect(nouveauPlan(avecGuide, { pages: {} })).not.toContain('/en/premier-league/');
  });

  test('a hand-written page: its frame is the generator’s (French header and footer, with the English line), and the audience measurement reaches it', () => {
    expect(pagesEcritesALaMain(racine)).toContain(FICHIER);
    expect(PAGES_DU_CADRE.find((p) => p.fichier === FICHIER)).toEqual({ fichier: FICHIER, chemin: PAGE, action: false, langue: 'en' });
    expect(SOURCE).toContain('<header class="entete page" lang="fr">');
    expect(SOURCE).toContain('<footer class="pied page" lang="fr">');
    expect(SOURCE).toContain('<p class="pied__langue" lang="en">The rest of baromatch.fr is in French.</p>');
    for (const repere of ['<!-- entete:debut -->', '<!-- entete:fin -->', '<!-- pied:debut -->', '<!-- pied:fin -->']) expect(SOURCE.split(repere).length - 1, repere).toBe(1);
  });
});

// ---------- Ce que la page charge ----------

test.describe('what the page loads', () => {
  const PREMIER_ECRAN_EN = premierEcran(SOURCE);
  const PREMIER_ECRAN_FR = premierEcran(SOURCE_FR);
  const POLITIQUE = (style) => politiqueAvecLaMesure(`default-src 'self'; script-src 'self'; style-src 'self' ${empreinte(style)}; img-src 'self'; font-src 'self'; `
    + "connect-src 'self' https://api-production-8ce4.up.railway.app; base-uri 'none'; object-src 'none'; form-action 'none'", MESURE);

  test('the first-screen style is the French one plus one rule (no 3D room beside the text); the policy carries its hash and is the French policy otherwise', () => {
    expect(PREMIER_ECRAN_EN.startsWith(PREMIER_ECRAN_FR), 'le style anglais commence par le style français, octet pour octet').toBe(true);
    const ajout = PREMIER_ECRAN_EN.slice(PREMIER_ECRAN_FR.length);
    expect(ajout.trim().split('\n').filter((l) => !l.startsWith('/*'))).toEqual([
      '@media (min-width: 1100px) { .ouverture-bars { display: block; min-height: 0; padding-top: 56px; padding-bottom: 96px; } }',
    ]);
    const politique = SOURCE.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
    expect(politique, `style-src doit porter l’empreinte du premier écran : ${empreinte(PREMIER_ECRAN_EN)}`).toBe(POLITIQUE(PREMIER_ECRAN_EN));
    const politiqueFr = SOURCE_FR.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
    expect(politique.replace(empreinte(PREMIER_ECRAN_EN), '@')).toBe(politiqueFr.replace(empreinte(PREMIER_ECRAN_FR), '@'));
  });

  test('the HTML has no style attribute, no inline style but the first screen, no inline script but the structured data and the page’s own words, no event handler; under 73 000 bytes', () => {
    expect(SOURCE.match(/<[^>]+\sstyle\s*=/gi)).toBeNull();
    expect(SOURCE.match(/<style[\s>]/gi)).toEqual(['<style>']);
    expect(SOURCE.match(/<[^>]+\son[a-z]+\s*=/gi)).toBeNull();
    const scripts = [...SOURCE.matchAll(/<script\b([^>]*)>/gi)].map(([, attributs]) => attributs.trim());
    expect(scripts.filter((a) => a !== 'type="application/ld+json"')).toEqual([
      ...(MESURE.active ? [`src="/mesure.js" data-mesure="${MESURE.adresse}" defer`] : []),
      'type="application/json" id="textes-en"',
      'src="/pour-les-bars-amorce.js" defer',
    ]);
    expect(Buffer.byteLength(SOURCE)).toBeLessThan(73_000);
  });

  test('at load nothing but the site; the request goes only when sent, to the one Baromatch server; the policy is not violated, and it blocks the rest', async ({ page, baseURL }) => {
    const origines = [];
    page.on('request', (requete) => { if (!requete.url().startsWith('data:')) origines.push(new URL(requete.url()).origin); });
    await page.addInitScript(() => {
      window.violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await page.route(ADRESSE, (route) => route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
    await page.clock.install();
    await page.goto(PAGE);
    await expect(page.locator('#demande')).toBeVisible();
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', POLITIQUE(PREMIER_ECRAN_EN));
    for (const details of await page.locator('.questions summary').all()) await details.click();
    expect([...new Set(origines)]).toEqual([new URL(baseURL).origin]);
    await page.fill('#demande-bar', 'Le Zinc des Amis');
    await page.fill('#demande-ville', 'Paris');
    await page.fill('#demande-nom', 'Camille');
    await page.fill('#demande-email', 'camille@lezinc.fr');
    await page.check('#demande-accord');
    await page.clock.fastForward(3000);
    await page.click('#demande-envoyer');
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect([...new Set(origines)]).toEqual([new URL(baseURL).origin, API]);
    expect(await page.evaluate(() => window.violations)).toEqual([]);
    await page.evaluate(() => fetch('https://exemple.invalid/').catch(() => null));
    await expect.poll(() => page.evaluate(() => window.violations)).toEqual([expect.stringMatching(/^connect-src https:\/\/exemple\.invalid/)]);
  });

  test('the form’s script finds its English words in the page: the same keys and the same {placeholders} as the French ones, no “!”, no drink word', () => {
    const script = lire('pour-les-bars.js');
    const debut = script.indexOf('var TEXTES = {');
    const fin = script.indexOf('\n  };', debut);
    // TEXTES est un objet de chaînes (écrit en JavaScript) : lu tel quel.
    // eslint-disable-next-line no-new-func
    const francais = new Function(`"use strict"; return ${script.slice(debut + 'var TEXTES = '.length, fin + 4)}`)();
    const anglais = JSON.parse(SOURCE.match(/<script type="application\/json" id="textes-en">\s*([\s\S]*?)\s*<\/script>/)[1]);
    const cles = (objet, prefixe = '') => Object.entries(objet).flatMap(([cle, valeur]) => (typeof valeur === 'object' ? cles(valeur, `${prefixe}${cle}.`) : [`${prefixe}${cle}`]));
    const valeurs = (objet) => Object.values(objet).flatMap((v) => (typeof v === 'object' ? valeurs(v) : [v]));
    expect(cles(anglais)).toEqual(cles(francais));
    const accesParCle = (objet, chemin) => chemin.split('.').reduce((o, k) => o[k], objet);
    for (const chemin of cles(francais)) {
      const marques = (texte) => [...texte.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
      expect(marques(accesParCle(anglais, chemin)), chemin).toEqual(marques(accesParCle(francais, chemin)));
    }
    for (const texte of valeurs(anglais)) {
      expect(texte).not.toContain('!');
      expect(texte).not.toMatch(BOISSONS_EN_ANGLAIS);
      expect(texte).not.toMatch(/[àâçéèêëîïôûùüÿœ]/i);
    }
    // Les limites annoncées sont celles du serveur, comme sur la page française.
    expect(anglais.tropDEnvois.texte).toContain('5 per hour');
    expect(francais.tropDEnvois.texte).toContain('5 par heure');
  });
});

// ---------- Ce que la page dit ----------

test.describe('what the page says', () => {
  test('one h1, in English, about the bar and the match nights; the sections in order: opening, conditions, how to start, questions, privacy, form', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Match nights, your bar on Baromatch.');
    const sections = await page.$$eval('main > section', (liste) => liste.map((s) => s.getAttribute('aria-labelledby')));
    expect(sections).toEqual(['titre', 'titre-conditions', 'titre-marche', 'titre-questions', 'titre-privacy', 'titre-contact']);
    expect(await page.$$eval('main h2', (h) => h.map((e) => e.textContent))).toEqual([
      'The conditions', 'How to start', 'Bars’ questions', 'Privacy: what we do with your details', 'Request to join',
    ]);
  });

  test('the structured data: the trail and the FAQ, which repeats word for word each question of the page, nothing else', async ({ page }) => {
    await page.goto(PAGE);
    const blocs = (await page.$$eval('script[type="application/ld+json"]', (s) => s.map((e) => e.textContent))).map((t) => JSON.parse(t));
    const noeuds = blocs.flatMap((bloc) => bloc['@graph'] ?? [bloc]);
    expect(noeuds.map((n) => n['@type'])).toEqual(['BreadcrumbList', 'FAQPage']);
    const [fil, faq] = noeuds;
    expect(fil.itemListElement.map(({ position, name, item }) => ({ position, name, item }))).toEqual([
      { position: 1, name: 'Home', item: `${ORIGINE}/` },
      { position: 2, name: 'For bars', item: CANONIQUE },
    ]);
    expect(faq.url).toBe(CANONIQUE);
    expect(faq.name).toBe(TITRE);
    expect(faq.inLanguage).toBe('en');
    const visibles = await page.$$eval('.questions details', (liste) => liste.map((details) => ({
      question: details.querySelector('summary').textContent,
      reponse: [...details.children].filter((e) => e.tagName !== 'SUMMARY').map((e) => e.textContent).join(' '),
    })));
    expect(visibles).toHaveLength(4);
    const espaces = (texte) => texte.replace(/[ \t\r\n]+/g, ' ').trim();
    expect(faq.mainEntity.map((q) => [q['@type'], q.acceptedAnswer['@type'], espaces(q.name), espaces(q.acceptedAnswer.text)]))
      .toEqual(visibles.map((v) => ['Question', 'Answer', espaces(v.question), espaces(v.reponse)]));
    // Le prix d’abord, et ouvert.
    await expect(page.locator('.questions details').first()).toHaveAttribute('open', '');
    await expect(page.locator('.questions summary').first()).toHaveText('How much does it cost?');
  });

  test('the conditions: the same seven, in English, with the same promises as the French page', async ({ page }) => {
    await page.goto(PAGE);
    const lignes = await page.$$eval('#titre-conditions ~ .conditions__liste li', (li) => li.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    expect(lignes).toHaveLength(7);
    expect(lignes[0]).toBe('Free during the launch. If it becomes paid, we offer you a price: you accept, or you stop.');
    expect(lignes[1]).toBe('No commitment. You stop whenever you want.');
    expect(lignes[2]).toBe('Free for your customers. What they have at the bar, they pay at the bar. Without the app, they walk in as usual.');
    expect(lignes[3]).toBe('Nothing without your OK. On this site, your bar appears only with your written consent.');
    expect(lignes[4]).toBe('What you never see: a fan’s e-mail. At the door, a nickname and a number; the History only keeps totals.');
    // Ce que la page française dit, la page anglaise le dit aussi (la même règle, avec ses mots) : l’accord écrit, aucun bar qui paie.
    const francais = texteDe(principal(SOURCE_FR));
    expect(francais).toContain('Gratuit pendant le lancement. Si ça devient payant, on te propose un tarif : tu acceptes, ou tu arrêtes.');
    expect(francais).toContain('Sans engagement. Tu arrêtes quand tu veux.');
    expect(francais).toContain('ton bar n’apparaît qu’avec ton accord écrit');
    expect(francais).toContain('Aucun bar ne paie pour passer devant un autre.');
    expect(lignes[5]).toContain('No bar pays to be ahead of another.');
    expect(lignes[6]).toContain('Where French law requires a health notice, the app adds it by itself.');
    // « 0 € », « free » : jamais avec une offre ou une boisson.
    expect(lignes[6]).not.toMatch(/free|0\s?€|offered/i);
  });

  test('one delay, said three times with the same words: the opening, the form, the thank-you; the FAQ promises no other', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('.ouverture-bars__delai').first()).toHaveText('A reply within 48 hours, from a person.');
    await expect(page.locator('#titre-contact ~ .chapo')).toHaveText('No account to create: a person reads every request and replies within 48 hours.');
    await expect(page.locator('#demande-envoyee')).toContainText('We’ll reply within 48 hours to');
    const faq = await page.$$eval('.questions details p', (p) => p.map((e) => e.textContent).join(' '));
    expect(faq).not.toMatch(/\b\d+\s*(?:hours?|h)\b/i);
  });

  test('where the app stands, as on the French page: fans cannot book yet, the app is coming to the stores, Paris only', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('.ouverture-bars__etat')).toHaveText('Fans can’t book yet: we’re preparing the opening with the first bars.');
    const resume = await page.locator('.marche__resume').textContent();
    expect(resume).toContain('coming soon to the stores, in Paris');
    expect(resume).toContain('looking for its first bars in Paris');
    const francais = texteDe(principal(SOURCE_FR));
    expect(francais).toContain('Les fans ne réservent pas encore');
    expect(francais).toContain('bientôt sur les stores, à Paris');
    expect(francais).toContain('Baromatch cherche ses premiers bars à Paris');
  });

  test('no exclamation mark, not in the text and not in what a screen reader reads; never the old name; no drink word at all, even out of sight', async ({ page }) => {
    await page.goto(PAGE);
    const lu = await page.evaluate(() => [
      document.title, document.body.innerText,
      ...[...document.querySelectorAll('[aria-label], [alt], [title]')].flatMap((e) => ['aria-label', 'alt', 'title'].map((a) => e.getAttribute(a)).filter(Boolean)),
    ].join('\n'));
    expect(lu).not.toContain('!');
    const toutLeHtml = texteDe(SOURCE.replace(/<header class="entete page"[\s\S]*?<\/header>/, '').replace(/<footer class="pied page"[\s\S]*?<\/footer>/, ''));
    expect(toutLeHtml).not.toMatch(/soir de match/i);
    expect(toutLeHtml).not.toMatch(BOISSONS_EN_ANGLAIS);
    // Les données structurées et les méta, qu’aucun lecteur ne voit, comprises.
    const tete = SOURCE.slice(0, SOURCE.indexOf('</head>')).replace('<!doctype html>', '').replace(/<!--[\s\S]*?-->/g, '');
    expect(tete).not.toMatch(BOISSONS_EN_ANGLAIS);
    expect(tete).not.toContain('!');
    for (const mot of ['happy hour', 'verre offert', 'tournée', 'free drink', 'cheers']) expect(SOURCE.toLowerCase()).not.toContain(mot);
  });

  test('every French word is in a French element: the header, the footer, the links and quotes to the French pages carry lang="fr"; the rest of the page is English', async ({ page }) => {
    await page.goto(PAGE);
    const francaisHorsDeSaLangue = await page.evaluate(() => {
      const mots = /\b(?:les|des|pour|nous|une|est|que|avec|dans|sur|ton|tes|votre|bars?\s+que)\b/i;
      const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const trouves = [];
      for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
        const parent = n.parentElement;
        if (!parent || parent.closest('[lang="fr"], script, style, svg, noscript')) continue;
        if (mots.test(n.data)) trouves.push(n.data.trim());
      }
      return trouves;
    });
    expect(francaisHorsDeSaLangue).toEqual([]);
    expect(await page.locator('header.entete').getAttribute('lang')).toBe('fr');
    expect(await page.locator('footer.pied').getAttribute('lang')).toBe('fr');
  });
});

// ---------- Le résumé de la confidentialité ----------

test.describe('the privacy summary, in English', () => {
  const SECTION = SOURCE.match(/<section class="conditions bloc page" id="privacy"[\s\S]*?<\/section>/)[0];
  const demandes = SECTION.slice(SECTION.indexOf('id="privacy-requests"'), SECTION.indexOf('id="privacy-contacted"'));
  const contactes = SECTION.slice(SECTION.indexOf('id="privacy-contacted"'));
  const FR_DEMANDES = CONFIDENTIALITE.slice(CONFIDENTIALITE.indexOf('<h2 id="bars">'), CONFIDENTIALITE.indexOf('<h2 id="droits">'));
  const dit = (html) => texteDe(html);

  test('it links to the French privacy page, which is the reference, from the section, the form and the explanation of each part', () => {
    expect(SECTION).toContain('<a href="/confidentialite.html" hreflang="fr" lang="fr">Confidentialité</a>');
    expect(SECTION).toContain('<a href="/confidentialite.html#bars" hreflang="fr" lang="fr">Les demandes des bars</a>');
    expect(SECTION).toContain('<a href="/confidentialite.html" hreflang="fr" lang="fr">Les bars que nous contactons</a>');
    expect(dit(SECTION)).toContain('The full page is in French, and it is the reference');
  });

  test('“Bar requests”: every point of the French section “Les demandes des bars”, with the same facts', () => {
    expect(CONFIDENTIALITE).toContain('<h2 id="bars">Les demandes des bars</h2>');
    const en = dit(demandes);
    const fr = dit(FR_DEMANDES);
    // Chaque fait chiffré ou nommé de la page française est dans le résumé, avec ses mots à lui.
    const faits = [
      ['ton adresse mail (gardée en minuscules)', 'your e-mail address (kept in lower case)'],
      ['sans ton adresse IP', 'without your IP address'],
      ['un champ caché, qui doit rester vide', 'a hidden field that must stay empty'],
      ['5 demandes par heure', '5 requests per hour'],
      ['une adresse IPv4, ou un bloc IPv6 /64', 'an IPv4 address, or an IPv6 /64 block'],
      ['pendant une heure', 'for one hour'],
      ['Aucune adresse IP n’est écrite dans la base de données', 'No IP address is written to the database'],
      ['te répondre', 'to reply to you'],
      ['démarches faites à ta demande avant de conclure un contrat', 'steps taken at your request before a contract'],
      ['La case à cocher est obligatoire', 'The box is compulsory'],
      ['ce n’est pas un accord pour recevoir de la publicité', 'it is not an agreement to receive advertising'],
      ['uniquement la personne qui gère Baromatch', 'only the person who runs Baromatch'],
      ['Resend', 'Resend'],
      ['établi aux États-Unis', 'based in the United States'],
      ['sur 24 heures', 'over 24 hours'],
      ['Rien n’est vendu ni loué', 'Nothing is sold or rented'],
      ['ne contiennent aucun champ du formulaire', 'contain no field of the form'],
      ['contact@baromatch.fr', 'contact@baromatch.fr'],
      ['12 mois à partir de ta demande', '12 months from your request'],
      ['stockage de session', 'session storage'],
      ['dans les 10 minutes', 'within 10 minutes'],
      ['sous un mois', 'within a month'],
      ['saisir la CNIL', 'complain to the CNIL'],
    ];
    for (const [francais, anglais] of faits) {
      expect(fr, francais).toContain(francais);
      expect(en, anglais).toContain(anglais);
    }
    // Dix points, comme la page française, dans le même ordre.
    const points = (html) => [...html.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
    expect(points(demandes)).toEqual([
      'What we collect:', 'Against mass sending:', 'Why:', 'On what basis:', 'Who can see it:', 'Server logs:', 'If the form does not respond:',
      'How long:', 'On your device:', 'To see, correct or erase your request:',
    ]);
    expect(points(FR_DEMANDES)).toHaveLength(10);
  });

  test('“Bars we contact”: the points of the French section as written for the next release, with the same facts', () => {
    const en = dit(contactes);
    for (const fait of [
      'the name of the bar, its public professional contact details, and our notes about its match nights',
      'the bar’s public pages (its website, its social networks, its listing on online maps)',
      'to introduce Baromatch to you. Nothing else.',
      'our legitimate interest in introducing Baromatch to professionals, within the framework the CNIL sets for prospecting between professionals: we only talk to you about your business',
      'three years at most after our last contact, then we erase',
      'reply “no thanks”, or write to contact@baromatch.fr. We stop writing to you. We only keep the name of the bar and your refusal, so as not to contact you again',
      'to see, correct or erase this data, at the same address',
      'complain to the CNIL at cnil.fr',
    ]) expect(en, fait).toContain(fait);
    const points = [...contactes.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
    expect(points).toEqual(['What we keep:', 'Where it comes from:', 'Why:', 'On what basis:', 'How long:', 'To refuse:', 'Your rights:']);
    // La partie française existe quand sa page est fusionnée : alors le résumé en reprend chaque nombre.
    if (CONFIDENTIALITE.includes('id="bars-contactes"')) {
      const fr = dit(CONFIDENTIALITE.slice(CONFIDENTIALITE.indexOf('<h2 id="bars-contactes">'), CONFIDENTIALITE.indexOf('<h2 id="droits">')));
      expect(fr).toContain('trois ans au plus après notre dernier contact');
      expect(fr).toContain('non merci');
    }
  });

  test('it makes no promise the French page does not make: no “advertising list”, nothing sold, no other recipient, no longer delay', () => {
    const en = dit(SECTION);
    expect(en).not.toMatch(/newsletter|mailing list|third part|sell|share (?:your|it) with/i);
    expect(en).not.toMatch(/\b(?:6|18|24) months\b/);
    expect(en).not.toMatch(/\b(?:two|four|five) years\b/);
    expect(en).toContain('Nothing is sold or rented');
  });
});

// ---------- Ce qu’un patron lit sans chercher ----------

test.describe('what a busy owner reads without looking', () => {
  test('the first screen at 360 × 740: the value, the button and the price, then where Baromatch stands; one amber button', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE);
    const ouverture = page.locator('.ouverture-bars');
    await expect(ouverture.locator('.ouverture-bars__valeur')).toHaveText('Know who’s coming before kick-off.');
    const bouton = ouverture.getByRole('link', { name: 'Request to join' });
    await expect(bouton).toHaveAttribute('href', '#proposer');
    for (const element of [bouton, ouverture.locator('.ouverture-bars__prix'), ouverture.locator('.ouverture-bars__valeur')]) await expect(element).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.ouverture-bars__prix')).toHaveText('Free during the launch, no commitment.');
    const ambres = await ouverture.locator('.capsule, .panier__envoyer, .bouton-nuit').evaluateAll((els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).backgroundColor === 'rgb(255, 177, 61)').map((e) => e.textContent.trim()));
    expect(ambres).toEqual(['Request to join']);
    const boite = await bouton.boundingBox();
    expect(boite.height).toBeGreaterThanOrEqual(44);
  });

  test('on a wide screen the opening is one column, text on the left, without the height of a screen; nothing overflows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    const ouverture = await page.locator('.ouverture-bars').boundingBox();
    expect(ouverture.height).toBeLessThan(900);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ouverture-bars')).display)).toBe('block');
  });

  test('no horizontal scroll: from 320 to 1440 px, text at 100 and at 200 %', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#demande')).toBeVisible();
    for (const largeur of [320, 360, 390, 768, 1100, 1440]) {
      for (const pourcent of [100, 200]) {
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
        const resultat = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dehors: [...document.querySelectorAll('main *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 && !e.closest('.visuellement-cache')).map((e) => e.tagName + (e.className ? `.${e.className}` : '')).slice(0, 5),
        }));
        expect(resultat, `${largeur} px, ${pourcent} %`).toEqual({ page: 0, dehors: [] });
      }
    }
  });

  test('each long word stays whole at 200 %: the words of the title and of the buttons are never split', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(PAGE);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const coupes = await page.evaluate(() => {
      const trouves = [];
      for (const bloc of document.querySelectorAll('h1 span, h2, h3, .capsule, .panier__envoyer, summary')) {
        const marcheur = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
        for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
          for (const mot of n.data.matchAll(/[^\s-]+/g)) {
            const plage = document.createRange();
            plage.setStart(n, mot.index);
            plage.setEnd(n, mot.index + mot[0].length);
            const lignes = new Set([...plage.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
            if (lignes.size > 1) trouves.push(mot[0]);
          }
        }
      }
      return trouves;
    });
    expect(coupes).toEqual([]);
  });

  test('without JavaScript: the form stays hidden; the address and a ready-made e-mail in English replace it; the rest is in the HTML', async ({ browser, baseURL }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await contexte.newPage();
    await page.goto(PAGE);
    await expect(page.locator('#demande')).toBeHidden();
    const secours = page.locator('#demande-secours');
    await expect(secours).toBeVisible();
    await expect(secours.locator('.sans-js__titre')).toHaveText('Write to us at contact@baromatch.fr');
    const lien = await secours.getByRole('link').getAttribute('href');
    expect(lien).toBe('mailto:contact@baromatch.fr?subject=Bar%20request&body=Bar%3A%20%0D%0AFirst%20name%3A%20%0D%0AE-mail%3A%20%0D%0AArea%3A%20');
    await expect(page.locator('h1')).toBeVisible();
    // pour-les-bars.css est là par le <noscript> de la tête : la page est mise en forme.
    expect(await page.evaluate(() => [...document.styleSheets].some((f) => f.href?.endsWith('/pour-les-bars.css')))).toBe(true);
    await contexte.close();
  });

  test('when the form script is lost on the way, the address and the ready-made e-mail show', async ({ page }) => {
    await page.route('**/pour-les-bars.js', (route) => route.abort());
    await page.clock.install();
    await page.goto(PAGE);
    await page.clock.fastForward(13_000);
    await expect(page.locator('#demande-secours')).toBeVisible();
    await expect(page.locator('#demande')).toBeHidden();
  });

  test('with reduced motion nothing moves on the page, at load or while scrolling', async ({ browser, baseURL }) => {
    const contexte = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 800 }, baseURL });
    const page = await contexte.newPage();
    await page.goto(PAGE);
    await expect(page.locator('#demande')).toBeVisible();
    await page.mouse.wheel(0, 1500);
    const animations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime === Infinity).length);
    expect(animations).toBe(0);
    await contexte.close();
  });
});
