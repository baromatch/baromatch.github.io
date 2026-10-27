// La page « Pour les bars » (pour-les-bars.html) : ce qu’elle dit et dans quel ordre, ce qu’elle charge, ce qu’elle
// ne dit jamais, et comment elle se tient sans JavaScript, sur un petit écran ou sans animation. Le formulaire
// lui-même (ce qui part, chaque réponse du serveur) est vérifié par pour-les-bars-formulaire.spec.mjs. Le serveur
// est simulé (page.route) : aucun test n’écrit à l’API de production.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { MARQUE } from './outils/marque.mjs';
import { PIED } from './outils/pied.mjs';
import { ralentirLaPremiereImage } from './outils/attente.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { mesureDuSite, politiqueAvecLaMesure } from '../generateur/mesure.mjs';

const PAGE = '/pour-les-bars.html';
const ORIGINE = 'https://baromatch.fr';
const CANONIQUE = `${ORIGINE}${PAGE}`;
const API = 'https://api-production-8ce4.up.railway.app';
const ADRESSE = `${API}/api/public/bar-contact`;

// Le titre choisi par le fondateur (26 octobre 2026) : celui de l’onglet, de la carte de partage et de la FAQ balisée.
const TITRE = 'Les soirs de match, ton bar sur Baromatch — Pour les bars';
// L’image de partage porte ce titre ; un nouveau nom de fichier, pour que les aperçus déjà vus se refassent.
const IMAGE_OG = '/img/og-bars-2026-10.jpg';
const DESCRIPTION = 'Baromatch montre ton bar aux fans qui cherchent où regarder le match, garde leurs places et te dit qui a réservé. Propose ton bar.';
const IMAGE_OG_ALT = 'La Console de Baromatch : pour un match, les places sur Baromatch, l’ouverture des réservations et l’heure jusqu’à laquelle une place est gardée. Exemple.';
// Le style du premier écran, en ligne dans la tête : la politique ne l’autorise que par son empreinte.
const SOURCE = readFileSync('pour-les-bars.html', 'utf8');
const PREMIER_ECRAN = SOURCE.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const EMPREINTE = `'sha256-${createHash('sha256').update(PREMIER_ECRAN).digest('base64')}'`;
// La politique de la page (la balise de la tête renvoie ici), règle par règle :
// - script-src 'self' : aucun script en ligne (d’où pour-les-bars-amorce.js) ;
// - style-src : l’empreinte du style de la tête (EMPREINTE, au-dessus : un style retouché, et ce test donne la nouvelle) ;
// - img-src data: : les sources vides des captures cachées à une largeur ;
// - connect-src : 'self' (Lighthouse y lit /robots.txt) et l’API, seul hôte à qui la page écrit (ADRESSE de
//   pour-les-bars.js), pour la seule demande d’un bar ;
// - form-action 'none' : seul le script envoie le formulaire ; base-uri et object-src : rien.
// Quand marque.json active la mesure d’audience, la page charge aussi /mesure.js, et connect-src admet son compte.
const MESURE = mesureDuSite();
const POLITIQUE = politiqueAvecLaMesure(`default-src 'self'; script-src 'self'; style-src 'self' ${EMPREINTE}; img-src 'self' data:; font-src 'self'; `
  + "connect-src 'self' https://api-production-8ce4.up.railway.app; base-uri 'none'; object-src 'none'; form-action 'none'", MESURE);

// Les conditions des premiers bars, mot pour mot comme le fondateur les a écrites (26 octobre 2026) : en entier en tête
// de « Combien ça coûte ? », reprises sans rien y ajouter dans « Je m’engage pour combien de temps ? », et leur première
// phrase sous le bouton (le titre tient sur trois lignes au téléphone : la phrase du prix reste dans le premier écran).
const CONDITIONS = 'Gratuit pendant le lancement, sans engagement. Aucun paiement tant que tu n’as pas accepté un tarif, et tu arrêtes quand tu veux.';
const CONDITIONS_COURTES = 'Gratuit pendant le lancement, sans engagement.';
const COMBIEN = 'Pour ton bar : gratuit pendant le lancement, sans engagement. Aucun paiement tant que tu n’as pas accepté un tarif, et tu arrêtes quand tu veux. Pour tes clients, Baromatch est gratuit : ce qu’ils prennent au bar, ils le paient au bar.';
const ENGAGEMENT = 'Sans engagement : tu arrêtes quand tu veux. Pendant le lancement, c’est gratuit, et aucun paiement tant que tu n’as pas accepté un tarif.';
// « Le tarif est à préciser », « tarif à préciser » : ce que la page disait avant ces conditions.
const TARIF_A_PRECISER = /tarif\s+(?:est\s+)?à\s+préciser/i;

// La loi Evin : la mention sanitaire, citée une fois, sous l’explication de l’offre du soir ; aucun mot d’alcool ailleurs.
const MENTION = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
const ALCOOL = /\b(alcool\w*|bières?|pintes?|demis?|vins?|cocktails?|apéros?|apéritifs?|spiritueux|whisky|vodka|rhum|champagne|happy hours?|shots?)\b/i;

const SAISIE = {
  '#demande-bar': 'Le Zinc des Amis',
  '#demande-ville': 'Paris',
  '#demande-nom': 'Camille Martin',
  '#demande-email': 'camille@lezinc.fr',
};

const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const fois = (texte, morceau) => texte.split(morceau).length - 1;

// Le serveur simulé : 201 par défaut, ou la réponse donnée ; 'silence' ne répond jamais.
const simulerServeur = (page, reponse = { status: 201, json: { ok: true } }) => page.route(ADRESSE, (route) => {
  if (reponse === 'silence') return undefined;
  return route.fulfill({
    status: reponse.status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(reponse.json ?? {}),
  });
});

// Le reste de la page arrive après le premier écran (pour-les-bars-amorce.js) : pour-les-bars.css et le script du
// formulaire partent ensemble, et le formulaire s’affiche dès que son script a tourné, sans attendre la feuille.
// `formulaireAffiche` dit seulement « le script a tourné » ; `pret` attend aussi la feuille appliquée : un test qui lit
// la mise en page sous le premier écran attend `pret`.
const formulaireAffiche = (page) => expect(page.locator('#demande')).toBeVisible();
const feuilleAppliquee = (page) => expect.poll(() => page.evaluate(() => [...document.styleSheets]
  .some((feuille) => feuille.href?.endsWith('/pour-les-bars.css')))).toBe(true);
async function pret(page) {
  await formulaireAffiche(page);
  await feuilleAppliquee(page);
}

// Amène chaque image paresseuse affichée à l’écran, une à une, et attend qu’elle soit chargée (pas de minuterie à
// deviner : c’est l’image qui dit qu’elle est là), puis remonte. Une image cachée à cette largeur n’est pas touchée.
async function parcourir(page) {
  for (const image of await page.locator('main img[loading="lazy"]').all()) {
    if (!(await image.isVisible())) continue;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((i) => i.complete && i.naturalWidth > 0), { timeout: 10_000 }).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => [...document.images]
    .filter((image) => image.getClientRects().length > 0)
    .every((image) => image.complete)), { timeout: 10_000 }).toBe(true);
}

// Remplit la demande, case cochée, et l’envoie une fois le formulaire affiché depuis 3 s (horloge simulée), sauf
// { attendre: false }.
async function envoyerUneDemande(page, saisie = SAISIE, { attendre = true } = {}) {
  for (const [champ, valeur] of Object.entries(saisie)) await page.fill(champ, valeur);
  await page.check('#demande-accord');
  if (attendre) await page.clock.fastForward(3000);
  await page.click('#demande-envoyer');
}

test.describe('ce que la page dit', () => {
  test('la tête : titre, description, adresse canonique, carte de partage, feuilles de style et police', async ({ page }) => {
    await page.goto(PAGE);
    await pret(page);
    const tete = await page.evaluate(() => {
      const contenu = (selecteur) => [...document.querySelectorAll(selecteur)].map((e) => e.getAttribute('content'));
      return {
        titre: document.title,
        description: contenu('meta[name="description"]'),
        robots: contenu('meta[name="robots"]'),
        canonique: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
        ogTitre: contenu('meta[property="og:title"]'),
        ogDescription: contenu('meta[property="og:description"]'),
        ogUrl: contenu('meta[property="og:url"]'),
        ogImage: contenu('meta[property="og:image"]'),
        ogImageAlt: contenu('meta[property="og:image:alt"]'),
        twitter: [...contenu('meta[name="twitter:card"]'), ...contenu('meta[name="twitter:site"]')],
        feuilles: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href')),
        police: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => [l.getAttribute('href'), l.getAttribute('as')]),
      };
    });
    expect(tete).toEqual({
      titre: TITRE,
      description: [DESCRIPTION],
      robots: ['max-image-preview:large'],
      canonique: [CANONIQUE],
      ogTitre: [TITRE],
      ogDescription: [DESCRIPTION],
      ogUrl: [CANONIQUE],
      ogImage: [`${ORIGINE}${IMAGE_OG}`],
      ogImageAlt: [IMAGE_OG_ALT],
      twitter: ['summary_large_image', '@baromatchapp'],
      feuilles: ['/styles.css', '/pour-les-bars.css'],
      police: [['/fonts/bricolage-grotesque.woff2', 'font']],
    });
    // La feuille de la page n’est chargée que par elle.
    const autres = readdirSync('.').filter((f) => f.endsWith('.html') && f !== 'pour-les-bars.html');
    expect(autres.filter((f) => readFileSync(f, 'utf8').includes('pour-les-bars.css'))).toEqual([]);
  });

  test('un seul titre h1, qui parle du bar et du match', async ({ page }) => {
    await page.goto(PAGE);
    const titres = await page.locator('h1').allTextContents();
    expect(titres).toHaveLength(1);
    expect(titres[0]).toMatch(/\bbar\b/i);
    expect(titres[0]).toMatch(/\bmatch\b/i);
    // Deux lignes, comme sur l’image de partage.
    expect(await page.locator('h1 > span').allTextContents()).toEqual(['Les soirs de match,', 'ton bar sur Baromatch.']);
    // L’ancien titre ne se lit plus nulle part : ni l’onglet, ni la carte de partage, ni la FAQ balisée. Sa nouvelle
    // image est dans le dépôt.
    expect(await page.content()).not.toContain('Remplis ton bar');
    expect(existsSync(IMAGE_OG.slice(1)), IMAGE_OG).toBe(true);
  });

  test('les sections dans l’ordre : ouverture, atouts, comment ça marche, heure par heure, ce que tu vois, questions, formulaire', async ({ page }) => {
    await page.goto(PAGE);
    const sections = await page.$$eval('main > section', (liste) => liste.map((s) => ({
      id: s.id,
      titre: s.querySelector('h1, h2').textContent.replace(/\s+/g, ' ').trim(),
    })));
    const ATTENDUES = [
      'Les soirs de match, ton bar sur Baromatch.',
      'Ce que Baromatch fait pour ton bar',
      'Comment ça marche',
      'Ton soir de match, heure par heure',
      'Ce que tu vois des fans. Et ce que tu ne vois jamais.',
      'Les questions des bars',
      'Propose ton bar',
    ];
    expect(sections.map((s) => s.titre).filter((t) => ATTENDUES.includes(t))).toEqual(ATTENDUES);
    expect(sections.find((s) => s.titre === 'Comment ça marche').id).toBe('comment');
    expect(sections.find((s) => s.titre === 'Propose ton bar').id).toBe('proposer');
    await expect(page.locator('main > section').first().locator('h1')).toHaveCount(1);
  });

  test('l’en-tête et le pied de page du site, « Pour les bars » marqué comme la page en cours', async ({ page }) => {
    await page.goto(PAGE);
    const liens = await page.$$eval('.entete__nav a', (a) => a.map((l) => [l.className, l.getAttribute('href'), l.textContent, l.getAttribute('aria-current')]));
    expect(liens).toEqual([
      ['entete__lien', '/boutique.html', 'Boutique', null],
      ['entete__lien entete__lien--bars', '/pour-les-bars.html', 'Pour les bars', 'page'],
    ]);
    // Le pied de page est celui des autres pages (tests/pages-de-texte.spec.mjs le vérifie mot pour mot) : les CGU
    // nommées, et « Supprimer mon compte » après « Confidentialité ».
    const pied = await page.$$eval('.pied__liens a', (a) => a.map((l) => [l.getAttribute('href'), l.textContent]));
    expect(pied[0]).toEqual(['/pour-les-bars.html', 'Pour les bars']);
    expect(pied.map(([href]) => href)).toEqual(PIED.map(([href]) => href));
  });

  test('les données structurées : le fil d’Ariane et la FAQ, qui répète mot pour mot chaque question de la page, rien d’autre', async ({ page }) => {
    await page.goto(PAGE);
    const blocs = (await page.$$eval('script[type="application/ld+json"]', (s) => s.map((e) => e.textContent))).map((t) => JSON.parse(t));
    const noeuds = blocs.flatMap((bloc) => bloc['@graph'] ?? [bloc]);
    expect(noeuds.map((n) => n['@type'])).toEqual(['BreadcrumbList', 'FAQPage']);
    const [fil, faq] = noeuds;
    expect(fil.itemListElement.map(({ position, name, item }) => ({ position, name, item }))).toEqual([
      { position: 1, name: 'Accueil', item: `${ORIGINE}/` },
      { position: 2, name: 'Pour les bars', item: CANONIQUE },
    ]);
    expect(faq.url).toBe(CANONIQUE);
    expect(faq.name).toBe(TITRE);
    const visibles = await page.$$eval('.questions details', (liste) => liste.map((details) => ({
      question: details.querySelector('summary').textContent,
      reponse: [...details.children].filter((e) => e.tagName !== 'SUMMARY').map((e) => e.textContent).join(' '),
    })));
    expect(visibles).toHaveLength(13);
    const espaces = (texte) => texte.replace(/[ \t\r\n]+/g, ' ').trim();
    expect(faq.mainEntity.map((q) => [q['@type'], q.acceptedAnswer['@type'], espaces(q.name), espaces(q.acceptedAnswer.text)]))
      .toEqual(visibles.map((v) => ['Question', 'Answer', espaces(v.question), espaces(v.reponse)]));
  });

  // Les deux endroits qui expliquent l’offre du soir : la carte « Ton offre du soir » et la question « Je peux mettre
  // une offre sur une boisson ? ». Chacun cite la mention en entier ; aucun autre texte ne parle d’alcool.
  test('la mention sanitaire, sous l’offre du soir et dans la réponse sur les offres, rien de plus ; aucun mot d’alcool ailleurs, même hors de la vue', async ({ page }) => {
    await page.goto(PAGE);
    const lu = await page.evaluate(() => {
      const offre = (racine) => [...racine.querySelectorAll('.questions details')].filter((d) => /offre sur une boisson/.test(d.querySelector('summary').textContent));
      const corps = document.body.cloneNode(true);
      const mentions = [...corps.querySelectorAll('.atout__mention')].map((e) => e.textContent);
      const reponses = offre(corps).map((d) => d.querySelector('p').textContent);
      corps.querySelectorAll('.atout__mention').forEach((e) => e.remove());
      offre(corps).forEach((d) => d.remove());
      const attributs = [...document.querySelectorAll('[alt], [aria-label], [title], meta[content]')]
        .map((e) => [e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('content')].filter(Boolean).join(' '));
      const questions = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .flatMap((s) => JSON.parse(s.textContent)['@graph'] ?? []).flatMap((n) => n.mainEntity ?? []);
      const autresQuestions = questions.filter((q) => !/offre sur une boisson/.test(q.name)).map((q) => `${q.name} ${q.acceptedAnswer.text}`);
      const questionOffre = questions.filter((q) => /offre sur une boisson/.test(q.name)).map((q) => q.acceptedAnswer.text);
      return { tout: document.body.textContent, mentions, reponses, reste: corps.textContent, questionOffre,
        ailleurs: [document.title, ...attributs, ...autresQuestions].join(' ') };
    });
    expect(fois(normaliser(lu.tout), MENTION)).toBe(2);
    expect(lu.mentions).toHaveLength(1);
    expect(normaliser(lu.mentions[0])).toContain(MENTION);
    expect(lu.reponses).toHaveLength(1);
    expect(normaliser(lu.reponses[0])).toContain(MENTION);
    expect(lu.questionOffre.map(normaliser)).toEqual([normaliser(lu.reponses[0])]);
    // Aucun exemple de boisson dans la réponse : le mot « alcool » seul, pour dire quand la mention s’affiche.
    expect(normaliser(lu.reponses[0]).replace(/alcool/gi, '').match(ALCOOL)).toBeNull();
    expect(normaliser(lu.reste).match(ALCOOL)).toBeNull();
    expect(normaliser(lu.ailleurs).match(ALCOOL)).toBeNull();
  });

  test('aucun point d’exclamation, ni dans le texte ni dans ce que lit un lecteur d’écran', async ({ page }) => {
    await page.goto(PAGE);
    const textes = await page.evaluate(() => [
      document.title,
      document.body.textContent,
      ...[...document.querySelectorAll('[alt], [aria-label], meta[content]')].map((e) => e.getAttribute('alt') ?? e.getAttribute('aria-label') ?? e.getAttribute('content')),
    ]);
    expect(textes.filter((t) => t.includes('!'))).toEqual([]);
  });

  test('le bord de chaque champ se voit sur la carte du formulaire : 3:1 au moins (WCAG 1.4.11)', async ({ page }) => {
    await page.goto(PAGE);
    await pret(page);
    const couleurs = await page.evaluate(() => ({
      page: getComputedStyle(document.body).backgroundColor,
      carte: getComputedStyle(document.querySelector('.carte-formulaire')).backgroundColor,
      bords: [...document.querySelectorAll('#demande .panier__champ')].map((c) => getComputedStyle(c).borderTopColor),
    }));
    const lire = (css) => {
      const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number);
      return { r, v, b, a };
    };
    const poser = (dessus, dessous) => ({
      r: dessus.r * dessus.a + dessous.r * (1 - dessus.a),
      v: dessus.v * dessus.a + dessous.v * (1 - dessus.a),
      b: dessus.b * dessus.a + dessous.b * (1 - dessus.a),
      a: 1,
    });
    const luminance = ({ r, v, b }) => [r, v, b]
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((somme, c, i) => somme + c * [0.2126, 0.7152, 0.0722][i], 0);
    const rapport = (x, y) => {
      const [clair, sombre] = [luminance(x), luminance(y)].sort((m, n) => n - m);
      return (clair + 0.05) / (sombre + 0.05);
    };
    const carte = poser(lire(couleurs.carte), lire(couleurs.page));
    expect(couleurs.bords).toHaveLength(6);
    for (const bord of couleurs.bords) expect(rapport(poser(lire(bord), carte), carte), bord).toBeGreaterThanOrEqual(3);
  });

  // Au pouce, le lien e-mail sous le formulaire et le lien vers la page Confidentialité se touchent sur 44 px de haut,
  // et ce dernier n’est pas dans l’étiquette de la case (en visant la case, on ouvrirait la page).
  test('à 360 px, le lien e-mail sous le formulaire et celui de la page Confidentialité font 44 px de haut ; la case n’a plus de lien dans son étiquette', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PAGE);
    await pret(page);
    await expect(page.locator('label[for="demande-accord"] a')).toHaveCount(0);
    await expect(page.locator('label[for="demande-accord"]')).toHaveText('J’ai lu comment Baromatch utilise ces informations pour me répondre.');
    const confidentialite = page.locator('#demande .formulaire__confidentialite a');
    await expect(confidentialite).toHaveAttribute('href', '/confidentialite.html#bars');
    await expect(confidentialite).toHaveText('Lire la page Confidentialité');
    for (const lien of [confidentialite, page.locator('.formulaire__ailleurs a[href="mailto:contact@baromatch.fr"]')]) {
      expect((await lien.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });

  test('le résumé des erreurs est un groupe, nommé par son titre', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#demande-resume')).toHaveAttribute('role', 'group');
    await expect(page.locator('#demande-resume')).toHaveAttribute('aria-labelledby', 'demande-resume-titre');
  });
});

// Ce qu’un patron pressé cherche : l’état du service, le prix et l’Android se lisent là où on les cherche, les mots de
// la Console sont expliqués au premier emploi, et les réponses utiles ne sont pas fermées au bas de la page. Chaque
// phrase ne dit que ce qui est vrai aujourd’hui : rien n’est promis ni mesuré.
test.describe('ce qu’un patron pressé lit sans chercher', () => {
  const questions = (page) => page.$$eval('.questions details', (liste) => liste.map((d) => ({
    question: d.querySelector('summary').textContent.replace(/\s+/g, ' ').trim(),
    ouverte: d.open,
    reponse: d.querySelector('p').textContent.replace(/\s+/g, ' ').trim(),
  })));

  test('le premier écran, à 360 × 740 : où en est Baromatch sous la phrase d’ouverture, le prix près du bouton, les pastilles, et le lien du fan égaré en haut', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE);
    const ouverture = page.locator('.ouverture-bars');
    // La ligne d’état, juste sous la phrase d’ouverture : tant que l’appli n’est pas ouverte (marque.json), elle dit
    // que les fans ne réservent pas encore, avant la plateforme. Le jour où l’appli ouvre, ce test échoue tant que la
    // ligne n’a pas changé : la page ne dit jamais « pas encore » d’une appli ouverte.
    const etat = ouverture.locator('.ouverture-bars__texte + .ouverture-bars__etat');
    expect(MARQUE.appli.ouverte, 'l’appli est ouverte : réécrire la ligne « Où on en est » de pour-les-bars.html').toBe(false);
    await expect(etat).toHaveText('Où on en est : Baromatch n’est pas encore ouvert au public, les fans ne réservent pas encore. En test sur Android, à Paris ; pas d’appli iPhone pour l’instant.');
    // Sous le bouton, les conditions des premiers bars, mot pour mot ; dans les pastilles, celles du bar à côté du
    // gratuit des clients.
    const bouton = ouverture.locator('.actions .capsule[href="#proposer"]');
    const prix = ouverture.locator('.actions + .ouverture-bars__prix');
    await expect(prix).toHaveText(CONDITIONS_COURTES);
    await expect(ouverture.locator('.boutique-promesses li')).toHaveText([
      'On cherche les premiers bars, à Paris',
      'Tu choisis combien de places tu ouvres',
      'Gratuit pour tes clients · pour ton bar, pendant le lancement, sans engagement',
    ]);
    // Tout ça sans défiler : le bouton et la phrase du prix sont dans le premier écran.
    await expect(bouton).toBeInViewport({ ratio: 1 });
    await expect(prix).toBeInViewport({ ratio: 1 });
    // Le fan égaré a son lien au-dessus du titre, à côté de « Pour les bars », vers la liste d’attente.
    const fan = ouverture.locator('a[href="/#attente"]');
    await expect(fan).toHaveCount(1);
    await expect(fan).toBeInViewport({ ratio: 1 });
    await expect(fan).toHaveAccessibleName('Tu es fan ? Par ici pour être prévenu du lancement');
    expect((await fan.boundingBox()).y + 24).toBeLessThan((await page.locator('h1').boundingBox()).y + 1);
    // Et l’ancienne pastille « Premiers bars à Paris », qui se lisait comme « il y a déjà des bars », est partie.
    await expect(ouverture).not.toContainText('Premiers bars à Paris');
  });

  test('le lien du fan tient sur la ligne de « Pour les bars » à 360 px, sans pousser le titre', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE);
    const etiquette = await page.locator('.ouverture-bars .etiquette').boundingBox();
    const fan = await page.locator('.ouverture-bars a[href="/#attente"]').boundingBox();
    expect(Math.abs((fan.y + fan.height / 2) - (etiquette.y + etiquette.height / 2))).toBeLessThan(2);
    expect(fan.height).toBeGreaterThanOrEqual(44);
  });

  // Le titre se coupe comme sur l’image de partage (IMAGE_OG) : deux lignes sur ordinateur, en colonne unique (1024 px)
  // comme dans la colonne de gauche (dès 1100 px). Là, sa taille suit la colonne, min(5rem, 6.6vw) : la seconde ligne
  // garde au moins 10 px de marge, barre de défilement comprise. Au téléphone, rien ne change : 13,4vw, trois lignes.
  const DEUX_LIGNES = ['Les soirs de match,', 'ton bar sur Baromatch.'];
  for (const [largeur, lignes, taille] of [
    [360, ['Les soirs de match,', 'ton bar', 'sur Baromatch.'], '48.24px'],
    [1024, DEUX_LIGNES], [1100, DEUX_LIGNES], [1280, DEUX_LIGNES], [1440, DEUX_LIGNES], [1920, DEUX_LIGNES],
  ]) {
    test(`à ${largeur} px, le titre tient sur ${lignes.length} lignes : « ${lignes.join(' / ')} »`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(PAGE);
      await page.waitForFunction(() => [...document.fonts].every((police) => police.status === 'loaded'));
      // Chaque mot rejoint la ligne du mot d’avant s’il a le même haut, sinon il en commence une.
      const titre = await page.locator('h1').evaluate((h1) => {
        const rangees = [];
        for (const span of h1.querySelectorAll('span')) {
          let haut = null;
          for (const mot of span.firstChild.data.matchAll(/\S+/g)) {
            const morceau = document.createRange();
            morceau.setStart(span.firstChild, mot.index);
            morceau.setEnd(span.firstChild, mot.index + mot[0].length);
            const y = Math.round(morceau.getBoundingClientRect().top);
            if (y === haut) rangees[rangees.length - 1] += ` ${mot[0]}`;
            else rangees.push(mot[0]);
            haut = y;
          }
        }
        return { rangees, taille: getComputedStyle(h1).fontSize };
      });
      expect(titre.rangees).toEqual(lignes);
      if (taille) expect(titre.taille).toBe(taille);
    });
  }

  test('l’appli de la porte, Android seulement pour l’instant, dit sur la carte de la porte, à l’étape 3 et en tête de « De quoi j’ai besoin ? » ; sans Android, la page Scan de la Console', async ({ page }) => {
    await page.goto(PAGE);
    const carte = page.locator('.atout', { has: page.locator('.atout__titre', { hasText: 'La porte, d’un scan' }) });
    await expect(carte).toContainText('c’est l’appli Baromatch, sur Android seulement pour l’instant');
    await expect(carte).toContainText('la Console (ton espace Baromatch, dans un navigateur) valide aussi un pass');
    const etape = page.locator('.marche__etape').nth(2);
    await expect(etape).toContainText('Pour l’instant, l’appli de la porte n’existe que sur Android : sans téléphone Android, la page Scan de la Console valide aussi un pass, depuis un navigateur.');
    const besoin = (await questions(page)).find((q) => q.question === 'De quoi j’ai besoin ?');
    expect(besoin.reponse).toMatch(/^Pour la porte, l’appli Baromatch sur un téléphone Android : pour l’instant, elle n’existe que sur Android\./);
    expect(besoin.reponse).toContain('On t’explique comment installer l’appli quand on te répond.');
    // Rien sur une version iPhone à venir, ni de date : rien n’est annoncé.
    expect(normaliser(await page.locator('main').textContent())).not.toMatch(/iPhone[^.]*(bientôt|prochainement|arrive|bientot)/i);
  });

  test('les questions : le prix d’abord, ouvert, puis l’engagement ; une réponse franche en tête ; les clients, le délai et l’offre sur une boisson répondus', async ({ page }) => {
    await page.goto(PAGE);
    const lues = await questions(page);
    expect(lues.slice(0, 6).map((q) => q.question)).toEqual([
      'Combien ça coûte ?',
      'Je m’engage pour combien de temps ?',
      'Mes clients doivent télécharger une appli ?',
      'De quoi j’ai besoin ?',
      'Comment je démarre, et en combien de temps ?',
      'Je peux mettre une offre sur une boisson ?',
    ]);
    expect(lues.filter((q) => q.ouverte).map((q) => q.question)).toEqual(['Combien ça coûte ?']);
    await expect(page.locator('.questions details').first().locator('p')).toBeVisible();
    const reponse = (debut) => lues.find((q) => q.question.startsWith(debut)).reponse;
    expect(reponse('Combien')).toBe(COMBIEN);
    expect(reponse('Je m’engage')).toBe(ENGAGEMENT);
    expect(reponse('Mes clients')).toMatch(/^Pour garder une place, oui : l’appli Baromatch, gratuite, en test sur Android pour l’instant\. Pour entrer, non : /);
    // Le délai de réponse d’abord (sous 48 h), puis l’ordre des choses, sans autre durée promise : ni mise en place, ni
    // ouverture.
    expect(reponse('Comment je démarre')).toMatch(/^On te répond sous 48 h\. Dans l’ordre : tu envoies ta demande/);
    expect(reponse('Comment je démarre').replace('sous 48 h', '')).not.toMatch(/\d+\s*(jours?|semaines?|heures?|h\b)/);
    // Tant que la question n’est pas tranchée avec un avocat (loi Evin), la réponse ne dit pas « Oui » : elle dit ce
    // qu’est l’offre du soir, et la mention sanitaire sous une offre qui parle d’alcool. Pareil dans la FAQ balisée.
    const boisson = 'L’offre du soir est la tienne : c’est toi qui la décides et qui la sers. Tu écris un titre et un prix (0 € si c’est gratuit) : les fans la voient sur la page de ton bar. Sous une offre qui parle d’alcool, l’appli affiche « L’abus d’alcool est dangereux pour la santé, à consommer avec modération. »';
    expect(reponse('Je peux mettre')).toBe(boisson);
    expect(reponse('Je peux mettre')).not.toMatch(/^\s*Oui\b/i);
    const balisee = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph']
      .flatMap((n) => n.mainEntity ?? []).find((q) => q.name.startsWith('Je peux mettre')).acceptedAnswer.text);
    expect(balisee.replace(/\s+/g, ' ')).toBe(boisson);
    // L’ancienne réponse « On ne peut pas encore te donner de délai. », franche mais vide, est remplacée par l’ordre des choses.
    expect(lues.map((q) => q.reponse).join(' ')).not.toContain('On ne peut pas encore te donner de délai');
  });

  // Les conditions des premiers bars : sous le bouton, dans les pastilles, dans les deux questions et dans la FAQ
  // balisée, les mêmes mots. « Tarif à préciser » ne se lit plus nulle part : ni sur la page, ni dans ce que lisent un
  // lecteur d’écran, un aperçu de partage ou un moteur de recherche.
  test('les conditions des premiers bars, mot pour mot : sous le bouton, dans « Combien ça coûte ? », dans « Je m’engage pour combien de temps ? » et dans la FAQ balisée ; « tarif à préciser » nulle part', async ({ page }) => {
    await page.goto(PAGE);
    expect(CONDITIONS.startsWith(CONDITIONS_COURTES)).toBe(true);
    await expect(page.locator('.ouverture-bars__prix')).toHaveText(CONDITIONS_COURTES);
    // En entier dans « Combien ça coûte ? », ouverte d’emblée, après « Pour ton bar : ».
    expect(COMBIEN.toLowerCase()).toContain(`pour ton bar : ${CONDITIONS.toLowerCase()} pour tes clients`);
    expect(normaliser(await page.locator('main').textContent()).toLowerCase()).toContain(CONDITIONS.toLowerCase());
    // La nouvelle question, juste après le prix, fermée comme les autres (seul le prix est ouvert).
    const engagement = page.locator('.questions details', { has: page.locator('summary', { hasText: 'Je m’engage pour combien de temps' }) });
    await expect(engagement).toHaveCount(1);
    expect(await engagement.evaluate((d) => d.open)).toBe(false);
    await expect(engagement.locator('summary')).toHaveText('Je m’engage pour combien de temps ?');
    await expect(engagement.locator('p')).toHaveText(ENGAGEMENT);
    // La FAQ balisée dit les mêmes mots.
    const balisees = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((s) => JSON.parse(s.textContent)['@graph'] ?? []).flatMap((n) => n.mainEntity ?? [])
      .map((q) => [q.name, q.acceptedAnswer.text]));
    const balisee = (question) => normaliser(balisees.find(([nom]) => normaliser(nom) === question)?.[1] ?? '');
    expect(balisee('Combien ça coûte ?')).toBe(COMBIEN);
    expect(balisee('Je m’engage pour combien de temps ?')).toBe(ENGAGEMENT);
    // Ce que tout le monde lit de la page : le texte, les attributs, la tête, les données structurées.
    const lu = await page.evaluate(() => [
      document.title,
      document.body.textContent,
      ...[...document.querySelectorAll('[alt], [aria-label], [title], meta[content]')]
        .map((e) => [e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('content')].filter(Boolean).join(' ')),
      ...[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.stringify(JSON.parse(s.textContent))),
    ].join(' '));
    expect(normaliser(lu)).not.toMatch(TARIF_A_PRECISER);
  });

  // Ailleurs que sur cette page : les pages écrites à la main, leurs scripts, llms.txt. Les pages que le générateur
  // écrit (sa liste blanche) sont relues à leur source, dans tests/feuille-du-patron.spec.mjs.
  test('aucun fichier publié écrit à la main ne dit encore « tarif à préciser »', () => {
    const fichiers = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .split('\0')
      .filter((f) => /\.(?:html|js|txt|xml|json)$/.test(f) && !/^(?:docs|tests|generateur)\//.test(f) && !estPermis(f) && existsSync(f));
    expect(fichiers).toEqual(expect.arrayContaining(['pour-les-bars.html', 'pour-les-bars.js', 'index.html', 'presse.html', 'llms.txt']));
    expect(fichiers.filter((f) => TARIF_A_PRECISER.test(readFileSync(f, 'utf8').replace(/&nbsp;/g, ' ')))).toEqual([]);
  });

  test('les mots de la Console sont dits en clair au premier emploi : la Console, le pass, le Mode bar ; les places sont « libérées », la position « pas envoyée »', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PAGE);
    await pret(page);
    const texte = normaliser(await page.locator('main').innerText());
    const apres = (mot, longueur = 60) => texte.slice(texte.indexOf(mot), texte.indexOf(mot) + longueur);
    expect(apres('Console')).toContain('Console (ton espace Baromatch');
    expect(apres('pass ', 50)).toContain('pass du fan (un QR code sur son téléphone)');
    expect(texte.slice(texte.indexOf('Mode bar') - 12, texte.indexOf('Mode bar') + 40)).toContain('c’est le Mode bar, l’écran de la porte');
    await expect(page.locator('.horaire__titre')).toContainText(['Les places gardées sont libérées']);
    // Une place sans arrivée validée est libérée : un fan dans la salle mais jamais scanné compte absent.
    await expect(page.locator('.horaire__moment', { hasText: 'Les places gardées sont libérées' }).locator('.horaire__texte'))
      .toHaveText('Si l’arrivée du fan n’est pas validée, sa place est libérée et comptée absente. Cette heure, c’est toi qui la choisis.');
    expect(texte).not.toMatch(/tombent/);
    // Mot pour mot : la position n’est pas envoyée avec l’arrivée (l’appli s’en sert sur le téléphone).
    await expect(page.locator('.regard__liste li', { hasText: 'Sa position' })).toHaveText('Sa position : elle n’est pas envoyée avec son arrivée.');
  });

  test('« Proposer mon bar » revient à la fin de « Ce que Baromatch fait pour ton bar »', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PAGE);
    const bouton = page.locator('.atouts > .actions .capsule[href="#proposer"]');
    await expect(bouton).toHaveText('Proposer mon bar');
    const fin = await page.locator('.atouts__grille').boundingBox();
    expect((await bouton.boundingBox()).y).toBeGreaterThan(fin.y + fin.height);
  });

  test('« Proposer mon bar » revient à la fin de « Ton soir de match, heure par heure »', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PAGE);
    const bouton = page.locator('.horaire > .actions .capsule[href="#proposer"]');
    await expect(bouton).toHaveText('Proposer mon bar');
    const fin = await page.locator('.horaire__historique').boundingBox();
    expect((await bouton.boundingBox()).y).toBeGreaterThan(fin.y + fin.height);
  });

  test('avant le formulaire, ce qui est vrai sur ce site : l’accord écrit du bar, et aucun bar qui paie pour passer devant', async ({ page }) => {
    await page.goto(PAGE);
    const accord = page.locator('#proposer .contact__intro .contact__suite + .chapo');
    await expect(accord).toHaveText('Sur ce site, ton bar n’apparaît qu’avec ton accord écrit, et aucun bar ne paie pour passer devant un autre. Comment on choisit les bars.');
    await expect(accord.locator('a')).toHaveAttribute('href', '/comment-on-choisit-les-bars.html');
    // Les deux faits sont ceux de la page qui explique le choix des bars, avec la même limite, « sur ce site » : la page
    // des bars ne promet rien de plus, et rien sur l’ordre des bars dans l’appli.
    const choix = readFileSync('comment-on-choisit-les-bars.html', 'utf8');
    expect(choix).toContain('Il n’apparaît sur ce site qu’avec son accord écrit.');
    expect(choix).toContain('Sur ce site, les bars sont rangés par ville, par arrondissement, puis par nom. Aucun bar ne paie pour passer devant un autre.');
  });

  test('les deux lignes pour les fans passent sous le formulaire, en fin de page', async ({ page }) => {
    await page.goto(PAGE);
    const ordre = await page.$$eval('main > *', (enfants) => enfants.map((e) => e.className.split(' ')[0]));
    expect(ordre.at(-1)).toBe('egares');
    expect(ordre.indexOf('contact')).toBe(ordre.length - 2);
    await expect(page.locator('.egares')).toContainText('Montre cette page au patron.');
  });
});

// Le délai choisi par le fondateur (26 octobre 2026) : une personne répond à chaque demande sous 48 h. Il est dit avant
// le formulaire, redit dans « C’est envoyé. » et dans « Comment je démarre, et en combien de temps ? », toujours avec les
// mêmes mots. Rien d’autre n’est promis : ni le temps de mise en place, ni une date d’ouverture.
test.describe('le délai de réponse : sous 48 h', () => {
  const DELAI = 'sous 48 h';

  test('avant le formulaire : une personne lit chaque demande et répond sous 48 h', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#proposer .contact__intro > .chapo').first())
      .toHaveText('Pas de compte à créer : une personne lit chaque demande et te répond sous 48 h.');
  });

  test('« Comment je démarre, et en combien de temps ? » : la réponse sous 48 h d’abord, la même dans la FAQ balisée ; plus rien « à préciser » sur la page', async ({ page }) => {
    await page.goto(PAGE);
    const demarrer = page.locator('.questions details', { has: page.locator('summary', { hasText: 'Comment je démarre' }) });
    await expect(demarrer.locator('p')).toHaveText('On te répond sous 48 h. Dans l’ordre : tu envoies ta demande, une personne te répond par e-mail ou par téléphone, '
      + 'puis, si on avance ensemble, Baromatch crée ton bar et ton compte patron (il n’y a pas d’inscription en ligne). Tu te connectes alors à la '
      + 'Console, tu règles ta salle et tu choisis tes matchs.');
    const lu = await page.evaluate(() => ({
      balisee: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => JSON.parse(s.textContent)['@graph'] ?? [])
        .flatMap((n) => n.mainEntity ?? []).find((q) => q.name.startsWith('Comment je démarre')).acceptedAnswer.text,
      tout: [document.title, document.body.textContent, ...[...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((s) => JSON.stringify(JSON.parse(s.textContent)))].join(' '),
    }));
    expect(normaliser(lu.balisee)).toBe(normaliser(await demarrer.locator('p').textContent()));
    expect(normaliser(lu.tout)).not.toMatch(/à préciser/i);
  });

  test('« C’est envoyé. » : la réponse sous 48 h à l’adresse tapée, et deux choses à faire en attendant, deux liens : l’affiche gratuite, la liste d’attente pour les habitués', async ({ page }) => {
    await simulerServeur(page);
    await page.clock.install();
    await page.goto(PAGE);
    await pret(page);
    await envoyerUneDemande(page);
    const merci = page.locator('#demande-envoyee');
    await expect(merci).toBeVisible();
    await expect(merci.locator('p')).toHaveText([
      `On te répond sous 48 h à ${SAISIE['#demande-email']}, ou par téléphone si tu as laissé ton numéro. Pas d’e-mail automatique : c’est une personne qui te répond.`,
      'Une erreur dans l’adresse ? Envoie une nouvelle demande',
      'En attendant, imprime l’affiche gratuite des matchs de la semaine pour ton comptoir. Dis aussi à tes habitués de laisser leur e-mail pour être prévenus du lancement.',
    ]);
    // Des liens seuls, vers deux pages du site qui existent : l’affiche de la semaine, la liste d’attente de l’accueil.
    expect(await merci.locator('a').evaluateAll((liens) => liens.map((a) => [a.getAttribute('href'), a.textContent]))).toEqual([
      ['/matchs/affiche/', 'imprime l’affiche gratuite des matchs de la semaine'],
      ['/#attente', 'laisser leur e-mail pour être prévenus du lancement'],
    ]);
    expect(existsSync('matchs/affiche/index.html')).toBe(true);
    expect(readFileSync('index.html', 'utf8')).toContain('id="attente"');
    // axe lit « C’est envoyé. » et ses liens dans tests/pour-les-bars-formulaire.spec.mjs, à 360 et 1280 px.
  });

  test('un seul délai, dit trois fois avec les mêmes mots ; la FAQ balisée le dit aussi', async ({ page }) => {
    await page.goto(PAGE);
    const texte = normaliser(await page.locator('main').textContent());
    expect(fois(texte, DELAI)).toBe(3);
    expect(texte).not.toMatch(/48\s*heures|deux jours|2 jours|24 h/i);
    const balisee = normaliser(await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.stringify(JSON.parse(s.textContent))).join(' ')));
    expect(fois(balisee, DELAI)).toBe(1);
  });
});

test.describe('les images', () => {
  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px : chaque image a son texte, ses tailles et son srcset, se charge, et seules celles sous l’écran attendent`, async ({ page }) => {
      const demandees = [];
      const casses = [];
      page.on('response', (reponse) => {
        if (reponse.request().resourceType() !== 'image' || reponse.url().startsWith('data:')) return;
        demandees.push(new URL(reponse.url()).pathname);
        if (reponse.status() >= 400) casses.push(`${reponse.status()} ${reponse.url()}`);
      });
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(PAGE);
      await pret(page);
      const auChargement = await page.$$eval('img', (images) => images.map((image) => ({
        src: image.getAttribute('src'),
        alt: image.getAttribute('alt'),
        largeur: Number(image.getAttribute('width')),
        hauteur: Number(image.getAttribute('height')),
        srcset: image.getAttribute('srcset') ?? '',
        sizes: image.getAttribute('sizes') ?? '',
        paresseuse: image.getAttribute('loading') === 'lazy',
        asynchrone: image.getAttribute('decoding') === 'async',
        prioritaire: image.getAttribute('fetchpriority') === 'high',
        ouverture: Boolean(image.closest('.ouverture-bars')),
        affichee: image.getClientRects().length > 0,
        aLEcran: image.getClientRects().length > 0 && image.getBoundingClientRect().top < window.innerHeight,
      })));
      expect(auChargement.length).toBeGreaterThan(5);
      for (const image of auChargement) {
        expect(image.alt?.length ?? 0, `${image.src} : alt`).toBeGreaterThan(20);
        expect(image.largeur, `${image.src} : width`).toBeGreaterThan(0);
        expect(image.hauteur, `${image.src} : height`).toBeGreaterThan(0);
        expect(image.srcset.split(',').map((c) => c.trim().split(/\s+/)[1]).every((d) => /^\d+w$/.test(d)), `${image.src} : srcset 1× et 2×`).toBe(true);
        expect(image.srcset.split(',').length, `${image.src} : srcset 1× et 2×`).toBe(2);
        expect(image.sizes, `${image.src} : sizes`).not.toBe('');
        expect(image.src, `${image.src} : WebP`).toMatch(/^\/img\/bars\/[a-z0-9-]+\.webp$/);
        // L’ouverture se charge tout de suite ; tout le reste attend d’approcher de l’écran, et rien de ce qui est
        // à l’écran au chargement n’attend.
        expect(image.paresseuse, `${image.src} : paresseuse`).toBe(!image.ouverture);
        expect(image.asynchrone, `${image.src} : décodage asynchrone`).toBe(!image.ouverture);
        expect(image.paresseuse && image.aLEcran, `${image.src} : à l’écran au chargement et paresseuse`).toBe(false);
        // Aucune image en priorité haute : sur téléphone, le LCP est la phrase d’ouverture, et la Console en
        // priorité haute lui prenait la bande passante (Lighthouse mobile 93–95 avec, 96–97 sans) ; sur ordinateur,
        // où la Console est le LCP, elle s’affiche à 0,6 s avec ou sans.
        expect(image.prioritaire, `${image.src} : priorité haute`).toBe(false);
      }

      await parcourir(page);
      const chargees = await page.$$eval('img', (images) => images.filter((image) => image.getClientRects().length > 0).map((image) => ({
        src: image.getAttribute('src'),
        chemin: new URL(image.currentSrc).pathname,
        complete: image.complete,
        naturelle: image.naturalWidth,
      })));
      for (const image of chargees) {
        expect(image.complete && image.naturelle > 1, `${image.src} : chargée`).toBe(true);
      }
      expect(casses).toEqual([]);
      // Une image cachée à cette largeur n’est pas téléchargée : seules celles qu’on voit le sont.
      const montrees = new Set(chargees.map((image) => image.chemin));
      expect([...new Set(demandees)].filter((chemin) => chemin.startsWith('/img/') && !montrees.has(chemin))).toEqual([]);
    });

    // L’étiquette « Exemple » est posée sur la capture elle-même, dans son coin du haut : on la
    // voit en même temps que les chiffres, pas 13 px sous l’image. La légende dit le reste.
    test(`à ${largeur} px : chaque capture porte son étiquette « Exemple » dans son coin, a sa légende, et l’écran de la porte se dit maquette`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(PAGE);
      await pret(page);
      const figures = await page.$$eval('img', (images) => images.filter((image) => image.getClientRects().length > 0).map((image) => {
        const figure = image.closest('figure');
        const affiche = (e) => Boolean(e) && e.getClientRects().length > 0;
        const legende = figure?.querySelector('figcaption');
        const etiquettes = [...(figure?.querySelectorAll('.exemple') ?? [])].filter(affiche);
        // La capture : le premier enfant affiché de la figure qui n’est ni l’étiquette ni la légende.
        const capture = [...(figure?.children ?? [])].find((e) => affiche(e) && !e.matches('.exemple, figcaption'));
        const e = etiquettes[0]?.getBoundingClientRect();
        const c = capture?.getBoundingClientRect();
        return {
          src: image.getAttribute('src'),
          exemple: etiquettes.map((x) => x.textContent),
          surLaCapture: Boolean(e && c) && e.right > c.left && e.left < c.right && e.bottom > c.top && e.top < c.bottom,
          dansLeCoin: Boolean(e && c) && e.top >= c.top - 16 && e.top <= c.top + 24 && e.left <= c.left + 40,
          legende: affiche(legende) ? legende.innerText : '',
          porte: image.getAttribute('src').includes('porte-cest-bon'),
        };
      }));
      expect(figures.length).toBeGreaterThan(3);
      for (const figure of figures) {
        expect(figure.exemple, `${figure.src} : étiquette « Exemple »`).toEqual(['Exemple']);
        expect(figure.surLaCapture, `${figure.src} : l’étiquette est sur la capture`).toBe(true);
        expect(figure.dansLeCoin, `${figure.src} : l’étiquette est dans le coin du haut`).toBe(true);
        expect(figure.legende.length, `${figure.src} : légende`).toBeGreaterThan(20);
        if (figure.porte) expect(figure.legende, `${figure.src} : la porte est une maquette`).toMatch(/maquette/);
      }
    });
  }
});

test.describe('ce que la page charge', () => {
  test('au chargement, rien d’autre que le site ; la demande ne part qu’à l’envoi, vers le seul serveur Baromatch', async ({ page, baseURL }) => {
    const origines = [];
    page.on('request', (requete) => {
      if (!requete.url().startsWith('data:')) origines.push(new URL(requete.url()).origin);
    });
    await simulerServeur(page);
    await page.clock.install();
    await page.goto(PAGE);
    await parcourir(page);
    expect([...new Set(origines)]).toEqual([new URL(baseURL).origin]);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect([...new Set(origines)]).toEqual([new URL(baseURL).origin, API]);
  });

  test('la politique de sécurité : exactement ce que la page utilise, aucune violation du chargement jusqu’à « C’est envoyé. », et elle bloque le reste', async ({ page }) => {
    await page.addInitScript(() => {
      window.violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await simulerServeur(page);
    await page.clock.install();
    await page.goto(PAGE);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', POLITIQUE);
    await parcourir(page);
    for (const details of await page.locator('.questions summary').all()) await details.click();
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(await page.evaluate(() => window.violations)).toEqual([]);

    // La politique est bien appliquée : une connexion vers un autre hôte est refusée, et signalée.
    await page.evaluate(() => fetch('https://exemple.invalid/').catch(() => null));
    await expect.poll(() => page.evaluate(() => window.violations)).toEqual([expect.stringMatching(/^connect-src https:\/\/exemple\.invalid/)]);
  });

  test('la politique laisse la page lire son propre site : Lighthouse y lit /robots.txt (audit SEO « robots.txt »)', async ({ page }) => {
    await page.addInitScript(() => {
      window.violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await page.goto(PAGE);
    expect(await page.evaluate(() => fetch('/robots.txt').then((r) => r.status, (e) => e.message))).toBe(200);
    expect(await page.evaluate(() => window.violations)).toEqual([]);
  });

  test('le HTML n’a ni attribut style, ni style en ligne autre que le premier écran (autorisé par son empreinte), ni script en ligne autre que les données structurées, ni gestionnaire d’événement', () => {
    expect(SOURCE.match(/<[^>]+\sstyle\s*=/gi)).toBeNull();
    expect(SOURCE.match(/<style[\s>]/gi)).toEqual(['<style>']);
    expect(SOURCE.indexOf('<style>')).toBeLessThan(SOURCE.indexOf('</head>'));
    const politique = SOURCE.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
    expect(politique, `style-src doit porter l’empreinte du premier écran : ${EMPREINTE}`).toContain(`style-src 'self' ${EMPREINTE};`);
    expect(SOURCE.match(/<[^>]+\son[a-z]+\s*=/gi)).toBeNull();
    const scripts = [...SOURCE.matchAll(/<script\b([^>]*)>/gi)].map(([, attributs]) => attributs.trim());
    expect(scripts.filter((a) => a !== 'type="application/ld+json"')).toEqual([
      ...(MESURE.active ? [`src="/mesure.js" data-mesure="${MESURE.adresse}" defer`] : []), 'src="/pour-les-bars-amorce.js" defer',
    ]);
  });
});

// Ce qui bloque le premier affichage sur un téléphone en 4G lente : le HTML, styles.css et la police. Le premier écran
// a ses règles dans la page ; pour-les-bars.css et le script du formulaire attendent qu’il soit affiché
// (pour-les-bars-amorce.js). Lighthouse mobile : 93–97 quand ils partaient avec le reste, 98–99 depuis.
test.describe('le premier écran d’abord', () => {
  // La part de chaque boîte qui est à l’écran (un conteneur peut grandir sous l’écran sans que rien ne bouge).
  const boitesALEcran = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
    .map((e) => [e, e.getBoundingClientRect()])
    .filter(([, b]) => b.width > 0 && b.height > 0 && b.top < window.innerHeight && b.bottom > 0)
    .map(([e, b]) => {
      const haut = Math.max(b.top, 0);
      const bas = Math.min(b.bottom, window.innerHeight);
      return `${e.tagName.toLowerCase()}.${e.getAttribute('class') ?? ''} ${Math.round(b.left)},${Math.round(haut)} ${Math.round(b.width)}×${Math.round(bas - haut)}`;
    }));
  // Les boîtes qui ont bougé de plus de `tolerance` pixels entre deux relevés.
  const bougees = (avant, apres, tolerance) => {
    const lire = (ligne) => ligne.match(/^(.*) (-?\d+),(-?\d+) (\d+)×(\d+)$/);
    if (avant.length !== apres.length) return [`${avant.length} boîtes, puis ${apres.length}`];
    return avant.filter((ligne, i) => {
      const [, nom, ...a] = lire(ligne);
      const [, autre, ...b] = lire(apres[i]);
      return nom !== autre || a.some((v, j) => Math.abs(Number(v) - Number(b[j])) > tolerance);
    }).map((ligne) => `${ligne} → ${apres[avant.indexOf(ligne)]}`);
  };
  // Retient une adresse jusqu’à ce qu’on la lâche.
  const retenir = async (page, motif) => {
    let lacher;
    const retenue = new Promise((resoudre) => { lacher = resoudre; });
    await page.route(motif, async (route) => { await retenue; await route.continue(); });
    return lacher;
  };
  // Note le moment où le formulaire apparaît (son script l’affiche en s’exécutant ; avant, l’amorce lui garde sa place,
  // invisible), et ceux où l’amorce ajoute la feuille et le script à la page (leur demande part à ce moment).
  const suivreLeFormulaire = (page) => page.addInitScript(() => {
    window.formulaireAffiche = null;
    window.ajoutes = {};
    new MutationObserver(() => {
      for (const [nom, selecteur] of [['feuille', 'link[href="/pour-les-bars.css"]'], ['script', 'script[src="/pour-les-bars.js"]']]) {
        if (!window.ajoutes[nom] && document.querySelector(selecteur)) window.ajoutes[nom] = performance.now();
      }
      const formulaire = document.getElementById('demande');
      if (!formulaire || formulaire.hidden || formulaire.hasAttribute('data-attente') || window.formulaireAffiche) return;
      window.formulaireAffiche = { moment: performance.now() };
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-attente'] });
  });
  const moments = (page) => page.evaluate(() => {
    const entree = (chemin) => performance.getEntriesByType('resource').find((r) => new URL(r.name).pathname === chemin);
    return {
      affichage: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      feuille: entree('/pour-les-bars.css')?.startTime ?? null,
      feuilleArrivee: entree('/pour-les-bars.css')?.responseEnd ?? null,
      script: entree('/pour-les-bars.js')?.startTime ?? null,
      fin: performance.getEntriesByType('navigation')[0].loadEventStart,
      formulaire: window.formulaireAffiche,
      ajoutes: window.ajoutes,
    };
  });

  test('dans la tête, une seule feuille bloque (styles.css) ; pour-les-bars.css n’y est que pour qui n’a pas JavaScript, et le HTML tient en 73 000 octets', () => {
    const tete = SOURCE.slice(0, SOURCE.indexOf('</head>'));
    const sansNoscript = tete.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    expect([...sansNoscript.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map(([lien]) => lien)).toEqual(['<link rel="stylesheet" href="/styles.css">']);
    expect([...tete.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map(([, contenu]) => contenu)).toEqual(['<link rel="stylesheet" href="/pour-les-bars.css">']);
    expect(SOURCE.slice(SOURCE.indexOf('</head>')).match(/<link\b/g)).toBeNull();
    // Le HTML est la première chose qu’attend le téléphone. Lighthouse, en local, le lit non compressé (GitHub Pages le
    // sert compressé en gzip) : au-delà d’environ 74 000 octets, la 4G lente simulée lui ajoute un aller-retour avant
    // de demander quoi que ce soit (+150 ms sur le premier affichage comme sur le LCP, un point de moins).
    expect(Buffer.byteLength(SOURCE), 'pour-les-bars.html : 73 000 octets au plus. Pour ajouter du texte, faire de la '
      + 'place dans la page : un commentaire HTML, un SVG répété (un <symbol> dans les définitions cachées et des <use>), '
      + 'une règle du style de la tête qui ne sert pas au premier écran (elle va dans pour-les-bars.css)').toBeLessThanOrEqual(73000);
  });

  // Le formulaire au repos a toutes ses règles dans le style de la page (grille, marges, bord des champs à 3:1) : son
  // script n’attend plus la feuille, qui ne sert qu’à ce qu’on voit en descendant et aux messages. Aucun gain mesuré
  // sur 4G lente (environ 2,95 s avant comme après) : gardé parce qu’une feuille bloquée ne retient plus le formulaire.
  test('après le premier affichage, pour-les-bars.css et le script partent ensemble ; le formulaire s’affiche sans attendre la feuille, avec le bord de ses champs', async ({ page }) => {
    await suivreLeFormulaire(page);
    const imageArrivee = await ralentirLaPremiereImage(page);
    const lacher = await retenir(page, '**/pour-les-bars.css');
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await formulaireAffiche(page);
    const m = await moments(page);
    expect(m.affichage).not.toBeNull();
    expect(m.ajoutes.feuille).toBeGreaterThan(m.affichage);
    expect(m.ajoutes.script).toBeGreaterThan(m.affichage);
    expect(Math.abs(m.ajoutes.script - m.ajoutes.feuille)).toBeLessThan(50);
    // La feuille est encore retenue, et le formulaire est là, ses champs bordés comme sur la page finie.
    expect(m.feuilleArrivee).toBeNull();
    expect(await page.evaluate(() => [...document.styleSheets].some((f) => f.href?.endsWith('/pour-les-bars.css')))).toBe(false);
    expect(await page.locator('#demande-bar').evaluate((c) => getComputedStyle(c).borderTopColor)).toBe('rgba(255, 255, 255, 0.34)');
    lacher();
    await imageArrivee();
  });

  test('arrivé sur une ancre (#proposer, depuis une affiche), la feuille et le script partent sans attendre le premier affichage, ensemble', async ({ page }) => {
    await suivreLeFormulaire(page);
    await page.goto(`${PAGE}#proposer`);
    await pret(page);
    const m = await moments(page);
    expect(Math.abs(m.ajoutes.script - m.ajoutes.feuille)).toBeLessThan(50);
    expect(m.feuilleArrivee).toBeLessThanOrEqual(m.fin);
  });

  // Le formulaire garde sa place, invisible, dès que l’amorce tourne : s’il ne vient pas, la carte ne reste pas un
  // grand vide. Sa place est rendue, et le chemin e-mail de secours revient en haut de la carte.
  test('pour-les-bars.js s’arrête sur une erreur avant d’afficher le formulaire : la place est rendue, le chemin e-mail en haut de la carte', async ({ page }) => {
    await page.route('**/pour-les-bars.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("panne");' }));
    await page.goto(`${PAGE}#proposer`);
    await expect(page.locator('#demande-secours')).toBeVisible();
    await expect(page.locator('#demande')).toBeHidden();
    const carte = await page.locator('.carte-formulaire').boundingBox();
    expect((await page.locator('#demande-secours').boundingBox()).y - carte.y).toBeLessThan(48);
  });

  // Un navigateur qui liste « paint » mais ne signale jamais le premier affichage (un moteur durci contre le pistage) :
  // l’observateur de l’amorce ne se réveille pas. Rien ne doit en dépendre.
  // L’horloge de la page arrêtée : ses minuteurs n’avancent que quand le test le dit.
  const horlogeArretee = async (page) => {
    const debut = new Date('2026-10-12T16:00:00Z').getTime();
    await arreterLHorloge(page, debut + 1000);
  };
  const observateurMuet = (page) => page.addInitScript(() => {
    const Muet = function () {};
    Muet.prototype.observe = function () {};
    Muet.prototype.disconnect = function () {};
    Muet.supportedEntryTypes = ['paint', 'resource', 'navigation'];
    window.PerformanceObserver = Muet;
  });

  test('le premier affichage jamais signalé : la feuille et le script partent quand même, 3 s après, et le formulaire s’affiche', async ({ page }) => {
    await observateurMuet(page);
    await horlogeArretee(page);
    await page.goto(PAGE);
    await page.clock.runFor(2_900);
    await expect(page.locator('#demande')).toHaveAttribute('data-attente', '');
    expect(await page.evaluate(() => Boolean(document.querySelector('script[src="/pour-les-bars.js"]')))).toBe(false);
    await page.clock.runFor(100);
    await formulaireAffiche(page);
    await feuilleAppliquee(page);
    await expect(page.locator('#demande-secours')).toBeHidden();
  });

  test('le premier affichage jamais signalé et le script qui ne vient pas : le chemin e-mail revient en haut de la carte au bout de 12 s', async ({ page }) => {
    await observateurMuet(page);
    await horlogeArretee(page);
    const lacher = await retenir(page, '**/pour-les-bars.js');
    await page.goto(PAGE);
    await page.clock.runFor(11_000);
    await expect(page.locator('#demande-secours')).toBeHidden();
    await page.clock.runFor(1_000);
    await expect(page.locator('#demande-secours')).toBeVisible();
    await expect(page.locator('#demande')).toBeHidden();
    const carte = await page.locator('.carte-formulaire').boundingBox();
    expect((await page.locator('#demande-secours').boundingBox()).y - carte.y).toBeLessThan(48);
    lacher();
  });

  test('l’amorce garde la place du formulaire par un attribut data-attente que le style de la page rend invisible, jamais par un style écrit', async ({ page }) => {
    // Le script retenu pendant que la page charge encore : on n’attend que le HTML lu, puis la demande du script.
    const imageArrivee = await ralentirLaPremiereImage(page);
    const lacher = await retenir(page, '**/pour-les-bars.js');
    const demande = page.waitForRequest('**/pour-les-bars.js');
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await demande;
    const formulaire = page.locator('#demande');
    await expect(formulaire).toHaveAttribute('data-attente', '');
    await expect(formulaire).toHaveCSS('visibility', 'hidden');
    await expect(formulaire).not.toHaveAttribute('style');
    lacher();
    await formulaireAffiche(page);
    await expect(formulaire).not.toHaveAttribute('data-attente');
    await expect(formulaire).not.toHaveAttribute('style');
    await imageArrivee();
  });

  test('pour-les-bars.js toujours pas là au bout de 12 s : la place est rendue au chemin e-mail ; arrivé ensuite, il affiche le formulaire et efface le secours', async ({ page }) => {
    await page.clock.install();
    const lacher = await retenir(page, '**/pour-les-bars.js');
    const demande = page.waitForRequest('**/pour-les-bars.js');
    await page.goto(`${PAGE}#proposer`, { waitUntil: 'domcontentloaded' });
    await demande;
    await page.clock.runFor(11_000);
    await expect(page.locator('#demande-secours')).toBeHidden();
    await page.clock.runFor(1_000);
    await expect(page.locator('#demande-secours')).toBeVisible();
    await expect(page.locator('#demande')).toBeHidden();
    lacher();
    await pret(page);
    await expect(page.locator('#demande-secours')).toBeHidden();
  });

  test('sans JavaScript, la suite de la page a ses règles (le <noscript> de la tête)', async ({ browser, baseURL }) => {
    const contexte = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await contexte.newPage();
    await page.goto(PAGE);
    await expect(page.locator('.regard__carte').first()).toHaveCSS('border-radius', '24px');
    await expect(page.locator('.marche__numero span').first()).toHaveCSS('border-radius', '50%');
    await contexte.close();
  });

  // Sans pour-les-bars.css (pas encore là, ou perdue en route) : pas d’icône géante, pas de numéro en double, et la
  // page a déjà à peu près sa hauteur ; le lien e-mail reste là.
  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px, sans pour-les-bars.css : aucune icône ne grandit, la page garde à peu près sa hauteur, le lien e-mail reste`, async ({ browser, baseURL }) => {
      const mesurer = async (bloquer) => {
        const page = await browser.newPage({ baseURL, viewport: { width: largeur, height: 800 } });
        if (bloquer) await page.route('**/pour-les-bars.css', (route) => route.abort());
        const feuille = page.waitForEvent(bloquer ? 'requestfailed' : 'requestfinished', (r) => r.url().endsWith('/pour-les-bars.css'));
        await page.goto(PAGE);
        await feuille;
        await formulaireAffiche(page);
        if (!bloquer) await feuilleAppliquee(page);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.formulaire__ailleurs a[href="mailto:contact@baromatch.fr"]')).toBeVisible();
        const mesure = await page.evaluate(() => ({
          hauteur: document.documentElement.scrollHeight,
          icones: [...document.querySelectorAll('main svg')].map((s) => (s.getClientRects().length ? Math.round(s.getBoundingClientRect().width) : 0)),
          numerotees: [...document.querySelectorAll('main ol')].filter((l) => l.getClientRects().length && getComputedStyle(l).listStyleType !== 'none').map((l) => l.className),
        }));
        await page.close();
        return mesure;
      };
      const finie = await mesurer(false);
      const sans = await mesurer(true);
      expect(sans.icones).toHaveLength(finie.icones.length);
      const geantes = sans.icones.map((l, i) => [l, finie.icones[i], i]).filter(([l, f]) => l > Math.max(48, f));
      expect(geantes, '[largeur sans la feuille, largeur finie, n° du svg dans main]').toEqual([]);
      expect(sans.numerotees).toEqual([]);
      expect(sans.hauteur).toBeLessThanOrEqual(finie.hauteur * 1.6);
    });
  }

  // Le premier écran ne doit pas bouger quand le reste arrive : tout ce qu’il montre a ses règles dans la page. On
  // retient pour-les-bars.css, on relève chaque boîte à l’écran, on la laisse arriver, on relève encore.
  for (const [largeur, hauteur] of [[360, 800], [412, 823], [768, 1024], [1350, 940], [1920, 1080], [2560, 1440]]) {
    test(`à ${largeur}×${hauteur} : l’arrivée de pour-les-bars.css ne bouge rien de ce qu’on voit en arrivant`, async ({ page }) => {
      const lacher = await retenir(page, '**/pour-les-bars.css');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: largeur, height: hauteur });
      const demande = page.waitForRequest('**/pour-les-bars.css');
      await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
      await demande;
      // La police est là (document.fonts.ready, lui, attend aussi la feuille retenue).
      await page.waitForFunction(() => [...document.fonts].every((police) => police.status === 'loaded'));
      const avant = await boitesALEcran(page);
      expect(avant.length).toBeGreaterThan(20);
      lacher();
      await pret(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await boitesALEcran(page)).toEqual(avant);
    });
  }

  // Arrivé par #proposer, on voit la fin des questions et la carte du formulaire : ni l’arrivée de la feuille, ni
  // celle du script n’y bougent rien, dans un ordre comme dans l’autre (le formulaire a déjà sa place, invisible ; il
  // apparaît avec son script, qui n’attend pas la feuille).
  for (const [largeur, hauteur, scriptDAbord] of [[412, 823, false], [1350, 940, false], [412, 823, true], [1350, 940, true]]) {
    test(`à ${largeur}×${hauteur}, arrivé par #proposer : ni pour-les-bars.css ni le script du formulaire ne bougent rien de ce qu’on voit (${scriptDAbord ? 'le script d’abord' : 'la feuille d’abord'})`, async ({ page }) => {
      const lacherFeuille = await retenir(page, '**/pour-les-bars.css');
      const lacherScript = await retenir(page, '**/pour-les-bars.js');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: largeur, height: hauteur });
      const demande = page.waitForRequest('**/pour-les-bars.css');
      await page.goto(`${PAGE}#proposer`, { waitUntil: 'domcontentloaded' });
      await demande;
      await page.waitForFunction(() => [...document.fonts].every((police) => police.status === 'loaded'));
      await page.evaluate(() => new Promise((resoudre) => { requestAnimationFrame(() => requestAnimationFrame(resoudre)); }));
      const avant = await boitesALEcran(page);
      expect(avant.join('\n')).toContain('carte-formulaire');
      const deuxImages = () => page.evaluate(() => new Promise((resoudre) => { requestAnimationFrame(() => requestAnimationFrame(resoudre)); }));
      const laFeuille = async () => {
        lacherFeuille();
        await feuilleAppliquee(page);
      };
      const leScript = async () => {
        lacherScript();
        await formulaireAffiche(page);
      };
      for (const arrivee of scriptDAbord ? [leScript, laFeuille] : [laFeuille, leScript]) {
        await arrivee();
        await deuxImages();
        // Un pixel près : la hauteur de ce qui est au-dessus change, et la position de défilement s’arrondit.
        expect(bougees(avant, await boitesALEcran(page), 1)).toEqual([]);
      }
    });
  }
});

// Le chemin e-mail qui remplace le formulaire quand son script ne tourne pas : sans JavaScript, ou quand
// pour-les-bars.js n’arrive pas (réseau faible, JavaScript actif). Les mots ne parlent pas de JavaScript, et l’e-mail
// tout prêt a une ligne par information du formulaire, sauf l’adresse e-mail : c’est celle de l’expéditeur.
async function verifierLeSecours(page) {
  const remplacant = page.locator('.sans-js');
  await expect(remplacant).toBeVisible();
  await expect(remplacant.locator('.sans-js__titre')).toHaveText('Écris-nous à contact@baromatch.fr');
  await expect(remplacant).toContainText('Le formulaire ne s’est pas affiché. Envoie-nous plutôt un e-mail avec :');
  await expect(remplacant).not.toContainText('JavaScript');
  const lien = remplacant.locator('a[href^="mailto:"]');
  await expect(lien).toBeVisible();
  await expect(lien).toHaveText('Écrire à Baromatch');
  const [destinataire, requete] = (await lien.getAttribute('href')).slice('mailto:'.length).split('?');
  const parametres = Object.fromEntries(requete.split('&').map((paire) => paire.split('=')).map(([cle, valeur]) => [cle, decodeURIComponent(valeur)]));
  expect(destinataire).toBe('contact@baromatch.fr');
  expect(parametres.subject).toBe('Demande d’un bar');
  expect(parametres.body.split('\r\n')).toEqual(['Bar : ', 'Ville : ', 'Nom : ', 'Téléphone : ', 'Message : ']);
}

test.describe('quand le formulaire ne vient pas, le chemin e-mail le remplace', () => {
  test('JavaScript actif mais pour-les-bars.js perdu en route : l’adresse et l’e-mail tout prêt se voient', async ({ page }) => {
    await page.route('**/pour-les-bars.js', (route) => route.abort());
    await page.goto(`${PAGE}#proposer`);
    await verifierLeSecours(page);
    await expect(page.locator('#demande')).toBeHidden();
    // Le chemin e-mail de secours passe axe, comme le reste de la page.
    const resultat = await new AxeBuilder({ page }).include('#proposer').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(resultat.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });

  test('le script là, le formulaire s’affiche et le chemin e-mail de secours s’efface ; arrivé par #proposer, rien ne saute', async ({ page }) => {
    await page.goto(`${PAGE}#proposer`);
    await pret(page);
    await expect(page.locator('.sans-js')).toBeHidden();
  });
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le formulaire reste caché ; l’adresse et un e-mail tout prêt, avec son objet, le remplacent ; le reste est dans le HTML', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#demande')).toBeHidden();
    await verifierLeSecours(page);
    // Ce qu’un robot doit lire est dans le HTML, sans script.
    await expect(page.locator('.atout')).toHaveCount(5);
    await expect(page.locator('.marche__etape')).toHaveCount(3);
    await expect(page.locator('.horaire__moment')).toHaveCount(5);
    await expect(page.locator('.questions details')).toHaveCount(13);
    await expect(page.locator('.formulaire__ailleurs a[href="mailto:contact@baromatch.fr"]')).toBeVisible();
  });
});

test.describe('pas de défilement de côté', () => {
  for (const largeur of [320, 360, 768, 1280]) {
    test(`à ${largeur} px : ni la page, ni les questions ouvertes, ni l’étape de l’e-mail ne dépassent`, async ({ page }) => {
      const debordement = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await simulerServeur(page, { status: 404 });
      await page.clock.install();
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(PAGE);
      await page.evaluate(() => document.fonts.ready);
      await pret(page);
      expect(await debordement()).toBeLessThanOrEqual(0);
      await page.evaluate(() => document.querySelectorAll('.questions details').forEach((d) => { d.open = true; }));
      expect(await debordement()).toBeLessThanOrEqual(0);
      await envoyerUneDemande(page);
      await expect(page.locator('#demande-courriel')).toBeVisible();
      expect(await debordement()).toBeLessThanOrEqual(0);
    });
  }

  // WCAG 1.4.4 : l’étape de l’e-mail avec le texte agrandi (150 et 200 %, réglage du navigateur), sur un téléphone. Le
  // texte à copier, « Ouvrir ma messagerie », « Copier le texte » et « Modifier ma demande » passent à la ligne : rien ne
  // sort de l’écran, aucune ligne n’est coupée, la page ne défile pas de côté.
  for (const largeur of [320, 360, 414]) {
    for (const texte of [150, 200]) {
      test(`à ${largeur} px, texte à ${texte} % : l’étape de l’e-mail tient dans l’écran, sans ligne coupée`, async ({ page }) => {
        await simulerServeur(page, { status: 404 });
        await page.clock.install();
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.goto(PAGE);
        await pret(page);
        await envoyerUneDemande(page, { ...SAISIE, '#demande-email': 'camille.martin.longue-adresse@lezinc-des-amis.fr' });
        await expect(page.locator('#demande-courriel')).toBeVisible();
        await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, texte);
        const lu = await page.evaluate(() => {
          const ecran = document.documentElement.clientWidth;
          const bloc = document.getElementById('demande-courriel');
          const coupes = [...bloc.querySelectorAll('*'), bloc].filter((e) => e.getClientRects().length && !e.closest('svg'))
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.left < -0.5 || r.right > ecran + 0.5 || e.scrollWidth > e.clientWidth + 1;
            })
            .map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''} « ${e.textContent.trim().slice(0, 30)} »`);
          return { coupes, defile: document.documentElement.scrollWidth > ecran };
        });
        expect(lu.coupes).toEqual([]);
        expect(lu.defile, 'la page défile de côté').toBe(false);
      });
    }
  }
});

test.describe('le mouvement', () => {
  const enCours = (page) => page.evaluate(() => document.getAnimations()
    .filter((animation) => animation.playState === 'running')
    .map((animation) => animation.animationName ?? animation.transitionProperty ?? 'animation'));

  test('avec « réduire les animations », rien ne bouge : ni au chargement, ni en descendant, ni pendant l’envoi', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await simulerServeur(page, 'silence');
    await page.clock.install();
    await page.goto(PAGE);
    expect(await enCours(page)).toEqual([]);
    await pret(page);
    expect(await enCours(page)).toEqual([]);
    await parcourir(page);
    expect(await enCours(page)).toEqual([]);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyer')).toHaveAttribute('aria-disabled', 'true');
    expect(await enCours(page)).toEqual([]);
  });

  // Les verres de « heure par heure » : vides tant qu’on ne les a pas vus, ils se remplissent à leur niveau la
  // première fois que la liste arrive à l’écran (800 ms, 60 ms d’écart de l’un à l’autre), puis ne bougent plus.
  const niveaux = (page) => page.$$eval('.horaire__niveau', (liste) => liste.map((g) => getComputedStyle(g).transform));

  test('sans réduction, les verres de la soirée se remplissent la première fois qu’on les voit', async ({ page }) => {
    await page.goto(PAGE);
    await pret(page);
    const avant = await niveaux(page);
    expect(avant).toHaveLength(5);
    expect(avant.filter((t) => t === 'none')).toEqual([]);
    await page.locator('.horaire__liste').scrollIntoViewIfNeeded();
    await expect(page.locator('.horaire__liste')).toHaveClass(/\bhoraire__liste--versee\b/);
    // La transition se lit dans le style calculé, qui ne dépend pas du moment où on le lit (une animation en cours,
    // elle, peut déjà être finie).
    const transitions = await page.$$eval('.horaire__niveau', (liste) => liste.map((g) => {
      const style = getComputedStyle(g);
      return [style.transitionProperty, style.transitionDuration, style.transitionDelay];
    }));
    expect(transitions).toEqual(['0s', '0.06s', '0.12s', '0.18s', '0.24s'].map((delai) => ['transform', '0.8s', delai]));
    // Puis chaque verre finit à son niveau : on attend la fin des transitions, sans minuterie à deviner.
    await page.$$eval('.horaire__niveau', (liste) => Promise.all(liste.flatMap((g) => g.getAnimations().map((a) => a.finished))));
    expect(await niveaux(page)).toEqual(Array(5).fill('none'));
    // Une seule fois : remonter et redescendre ne les vide pas.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.horaire__liste').scrollIntoViewIfNeeded();
    expect(await niveaux(page)).toEqual(Array(5).fill('none'));
  });

  test('les capsules de la page s’enfoncent sous le doigt (0,96), pas pendant l’envoi, et pas en mouvement réduit', async ({ page }) => {
    const enfoncee = async (selecteur) => {
      const cible = page.locator(selecteur);
      await cible.scrollIntoViewIfNeeded();
      await cible.hover();
      await page.mouse.down();
      // Lire le style lance la transition d’appui s’il y en a une ; on attend sa fin, puis on lit l’état posé.
      const transformation = await cible.evaluate(async (e) => {
        getComputedStyle(e).transform;
        await Promise.all(e.getAnimations().map((a) => a.finished));
        return getComputedStyle(e).transform;
      });
      await page.mouse.up();
      return transformation;
    };
    await simulerServeur(page, 'silence');
    await page.clock.install();
    await page.goto(PAGE);
    for (const selecteur of ['.ouverture-bars .capsule', '.bars .bouton-nuit', '#demande-envoyer']) {
      expect(await enfoncee(selecteur), selecteur).toBe('matrix(0.96, 0, 0, 0.96, 0, 0)');
    }
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyer')).toHaveAttribute('aria-disabled', 'true');
    expect(await enfoncee('#demande-envoyer')).toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    for (const selecteur of ['.ouverture-bars .capsule', '.bars .bouton-nuit', '#demande-envoyer']) {
      expect(await enfoncee(selecteur), selecteur).toBe('none');
    }
  });

  test('en mouvement réduit, et sans JavaScript, les verres de la soirée sont à leur niveau d’emblée', async ({ browser, baseURL }) => {
    for (const options of [{ reducedMotion: 'reduce' }, { javaScriptEnabled: false }]) {
      const contexte = await browser.newContext({ baseURL, ...options });
      const page = await contexte.newPage();
      await page.goto(PAGE);
      expect(await niveaux(page), JSON.stringify(options)).toEqual(Array(5).fill('none'));
      await contexte.close();
    }
  });

  // WCAG 2.2.2 : la vague du verre de 21:00 s’arrête d’elle-même avant 5 s, sur l’image du verre immobile (une longueur
  // d’onde entière, 140 px).
  test('la vague du verre de 21:00 s’arrête d’elle-même avant 5 s, sur l’image du verre immobile', async ({ page }) => {
    await page.goto(PAGE);
    const vagues = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'bm-vague').map((a) => {
      const temps = a.effect.getComputedTiming();
      const images = a.effect.getKeyframes();
      return { fin: temps.endTime, iterations: temps.iterations, derniere: images[images.length - 1].transform };
    }));
    expect(vagues).toHaveLength(1);
    expect(Number.isFinite(vagues[0].iterations), 'un nombre fixe de passages').toBe(true);
    expect(vagues[0].fin).toBeLessThanOrEqual(5000);
    expect(vagues[0].derniere).toBe('translateX(-140px)');
    await page.evaluate(() => document.getAnimations().forEach((a) => { if (a.animationName === 'bm-vague') a.finish(); }));
    expect(await page.locator('.horaire .bm-vague').evaluate((v) => getComputedStyle(v).transform)).toBe('none');
  });

  test('sans réduction, le téléphone de la porte se pose, le verre de 21:00 ondule et un petit verre se remplit pendant l’envoi', async ({ page }) => {
    await simulerServeur(page, 'silence');
    await page.clock.install();
    await page.goto(PAGE);
    expect(await enCours(page)).toEqual(expect.arrayContaining(['pb-poser', 'bm-vague']));
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyer')).toHaveAttribute('aria-disabled', 'true');
    expect(await enCours(page)).toContain('pb-monter');
  });
});
