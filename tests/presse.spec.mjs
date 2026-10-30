// La page Presse et partenariats, « le kit sur la page » : les logos à télécharger, cinq écrans de l’appli d’aujourd’hui
// (chacun marqué « Écran de démonstration »), le film à regarder, les deux couleurs et la police, le texte à copier avec
// les mots de marque.json, ce que Baromatch n’est pas (ni paris sportifs, ni diffuseur, ni vente d’alcool), le mot du
// fondateur (ses mots, mot pour mot, rien d’écrit à sa place), les partenariats et à qui écrire. Aucun emplacement vide
// en ligne. Ses données structurées la relient à l’Organization de l’accueil.
// Le reste (référencement, liens, accessibilité, politique de sécurité, pied de page) vient de tests/outils/pages.mjs ;
// le jour (un seul bouton ambre, contraste, texte agrandi, rien qui bouge), de tests/pages-du-jour.spec.mjs.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { MOT_DU_FONDATEUR, motPourMot, SIGNATURE_DU_FONDATEUR } from './outils/fondateur.mjs';

const PAGE = '/presse.html';
const ORIGINE = 'https://baromatch.fr';
const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
const PHRASE_DROITS = 'Les logos, les captures et l’affiche de cette page peuvent être utilisés pour parler de Baromatch, sans les modifier.';
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();

test.use({ javaScriptEnabled: false });

test('Baromatch en bref : le slogan, la phrase et la description de marque.json, mot pour mot', async ({ page }) => {
  await page.goto(PAGE);
  const texte = normaliser(await page.locator('main').textContent());
  for (const cle of ['slogan', 'uneLigne', 'description']) expect(texte, cle).toContain(normaliser(MARQUE[cle]));
  // Vrai aujourd’hui : en test, Android, Paris, pas encore ouvert ; l’appli ne coûte rien au fan (la boutique, elle,
  // vend des pièces : jamais « tu ne paies rien à Baromatch »).
  if (!MARQUE.appli.ouverte) expect(texte).toContain('L’appli n’est pas encore ouverte au public, ni sur iPhone.');
  const fait = async (nom) => normaliser(await page.locator('.presse__faits > div').filter({ has: page.locator('dt', { hasText: nom }) }).locator('dd').textContent());
  expect(await fait('Pour les fans')).toBe('L’appli ne te coûte rien. Ce que tu prends au bar, tu le paies au bar.');
  expect(await fait('Aujourd’hui')).toMatch(/^En test sur Android, à Paris\./);
  // Qui publie : le nom, puis les mentions légales pour le reste.
  expect(await fait('Qui publie')).toBe('Skander Kamoun, fondateur. Détails dans les mentions légales.');
  expect(texte).not.toMatch(/Tu ne paies rien|Gratuit\. Ce qu’ils/);
  // Le chapô : la description de marque.json, puis ce qu’on trouve sur la page.
  expect(normaliser(await page.locator('.presse__chapo').textContent())).toBe(`${normaliser(MARQUE.description)} Ici : le logo, les écrans, le film et un texte à copier.`);
});

// Une seule liste : ce que Baromatch n’est pas, et ce qu’il refuse (les écussons et les logos de compétition ou de
// chaîne, un bar qui paierait pour passer devant), rien qui ne soit déjà vrai ailleurs sur le site.
test('ce que Baromatch n’est pas : ni paris sportifs, ni diffuseur, ni vente d’alcool, ni écusson, ni bar qui paie', async ({ page }) => {
  await page.goto(PAGE);
  const points = (await page.locator('#n-est-pas + ul > li > strong').allTextContents()).map(normaliser);
  expect(points).toEqual(['Pas un site de paris sportifs.', 'Pas un diffuseur.', 'Pas un vendeur d’alcool.', 'Ni écusson, ni logo.', 'Aucun bar ne paie pour passer devant un autre.']);
  const liste = normaliser(await page.locator('#n-est-pas + ul').textContent());
  expect(liste).toContain('Et jamais d’alcool à gagner.');
  expect(liste).toContain('Pas d’écusson de club, ni de logo de compétition ou de chaîne : les clubs et les compétitions sont écrits en toutes lettres.');
  expect(liste).toContain('Sur ce site, les bars sont rangés par ville, par arrondissement, puis par nom.');
  await expect(page.locator('main')).not.toContainText('Ce que Baromatch refuse');
  // Vrai aussi le jour où l’appli proposera des pronostics entre amis : ni pari, ni cote, ni argent, jamais.
  const paris = normaliser(await page.locator('#n-est-pas + ul > li').first().textContent());
  expect(paris).toContain('on ne parie pas sur Baromatch : ni mise, ni cote, ni argent en jeu.');
  expect(paris).not.toMatch(/pronostic/i);
});

// Ses mots à lui, écrits le 26 octobre 2026 : publiés tels quels, avec la typographie du site (l’apostrophe ’, une
// espace insécable avant « : » et « ? »), signés. Le kit d’abord (le logo, les écrans, le film, les couleurs, le texte à
// copier), puis ce que Baromatch n’est pas, et ses mots juste après, là où un journaliste les cite. Les partenariats
// remontent avant les couleurs : une phrase et son bouton.
test('le mot du fondateur : ses mots, mot pour mot, signés, juste après « Ce que Baromatch n’est pas »', async ({ page }) => {
  await page.goto(PAGE);
  const titres = (await page.locator('main h2').allTextContents()).map(normaliser);
  expect(titres).toEqual(['Le logo', 'Les écrans de l’appli', 'Le film', 'Partenariats', 'Les couleurs et la police', 'Le texte à copier', 'Ce que Baromatch n’est pas', 'Le mot du fondateur', 'Écrire à Baromatch']);
  const mot = page.locator('#mot-du-fondateur + figure');
  const cite = await mot.locator('blockquote').textContent();
  expect(motPourMot(cite)).toBe(MOT_DU_FONDATEUR);
  expect(cite).not.toMatch(/'| [:;?!]/);
  expect(cite).toContain('simple\u00a0: où');
  expect(cite).toContain('de la place\u00a0? Je');
  expect(normaliser(await mot.locator('figcaption').textContent())).toBe(SIGNATURE_DU_FONDATEUR);
});

test('aucun emplacement vide, ni lu, ni dans la source, et la page reste indexable', async ({ page, request }) => {
  // Ni dans la page servie (texte, commentaires, classes), ni dans aucune page HTML du dépôt.
  const source = await (await request.get(PAGE)).text();
  const aEcrire = /[àa] [ée]crire|[àa] compl[ée]ter|presse__a-ecrire|son fondateur arrive/i;
  expect(source).not.toMatch(aEcrire);
  for (const fichier of readdirSync(racine).filter((f) => f.endsWith('.html'))) {
    expect(readFileSync(path.join(racine, fichier), 'utf8'), fichier).not.toMatch(aEcrire);
  }
  await page.goto(PAGE);
  await expect(page.locator('#histoire')).toHaveCount(0);
  // Chaque titre de la page a son contenu : aucun titre vide.
  const vides = await page.$$eval('main h2', (titres) => titres.filter((h2) => !h2.nextElementSibling || /^H[12]$/.test(h2.nextElementSibling.tagName)).map((h2) => h2.textContent));
  expect(vides).toEqual([]);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'max-image-preview:large');
  expect(readFileSync(path.join(racine, 'sitemap.xml'), 'utf8')).toContain('<loc>https://baromatch.fr/presse.html</loc>');
});

test('les logos : fond clair, fond sombre et icône, chacun en SVG et en PNG à télécharger', async ({ page }) => {
  await page.goto(PAGE);
  const fichiers = await page.$$eval('.presse__logo .presse__fichiers a', (liens) => liens.map((a) => [a.getAttribute('href'), a.hasAttribute('download')]));
  expect(fichiers).toEqual(['baromatch-logo-fond-clair', 'baromatch-logo-fond-sombre', 'baromatch-icone']
    .flatMap((nom) => [[`/presse/${nom}.svg`, true], [`/presse/${nom}.png`, true]]));
  // Chaque aperçu montre le SVG qu’on télécharge.
  const apercus = await page.$$eval('.presse__apercu img', (images) => images.map((img) => img.getAttribute('src')));
  expect(apercus).toEqual(['/presse/baromatch-logo-fond-clair.svg', '/presse/baromatch-logo-fond-sombre.svg', '/presse/baromatch-icone.svg']);
});

// Les écrans d’aujourd’hui, ceux de l’accueil (des clubs, des bars et des rues inventés), chacun marqué « Écran de
// démonstration » et téléchargeable en 600 px. Les anciennes captures (un bar inventé à une vraie adresse, de vrais
// clubs à une date passée, « 1 place par compte ») ne sont plus ni sur la page, ni dans le site.
test('les écrans et le film : cinq écrans d’aujourd’hui chargés tard, chacun marqué et à télécharger, le film à un clic', async ({ page }) => {
  await page.goto(PAGE);
  const ecrans = await page.$$eval('#ecrans ~ .presse__ecrans figure', (figures) => figures.map((figure) => {
    const img = figure.querySelector('img');
    const lien = figure.querySelector('figcaption a');
    return {
      src: img.getAttribute('src'), srcset: img.getAttribute('srcset'), paresseuse: img.getAttribute('loading') === 'lazy',
      etiquette: figure.querySelector('.exemple')?.textContent ?? '', nom: figure.querySelector('figcaption strong')?.textContent ?? '',
      telecharger: lien && [lien.getAttribute('href'), lien.hasAttribute('download'), lien.textContent.replace(/\s+/g, ' ').trim()],
    };
  }));
  expect(ecrans.map((e) => e.nom)).toEqual(['Ce soir', 'La recherche', 'La page d’un bar', 'Ta soirée', 'Tu y es']);
  for (const [i, nom] of ['ce-soir', 'carte-recherche', 'bar', 'ta-soiree', 'tu-y-es'].entries()) {
    const ecran = ecrans[i];
    expect(ecran.src).toBe(`/img/appli/${nom}-300.webp`);
    expect(ecran.srcset).toBe(`/img/appli/${nom}-300.webp 300w, /img/appli/${nom}-600.webp 600w`);
    expect(ecran.paresseuse, nom).toBe(true);
    expect(ecran.etiquette, nom).toBe('Écran de démonstration');
    expect(ecran.telecharger[0], nom).toBe(`/img/appli/${nom}-600.webp`);
    expect(ecran.telecharger[1], nom).toBe(true);
    expect(ecran.telecharger[2], nom).toMatch(/^Télécharger l’écran .+ \(WebP, 600 px\)$/);
  }
  expect(normaliser(await page.locator('#ecrans + p').textContent())).toContain('Sur ces écrans, les bars, les clubs, les pseudos et les chiffres sont inventés.');
  const source = readFileSync(path.join(racine, 'presse.html'), 'utf8');
  expect(source).not.toMatch(/capture-|Oberkampf|1 place par compte/);
  expect(readdirSync(path.join(racine, 'presse')).filter((nom) => nom.startsWith('capture-'))).toEqual([]);
  await expect(page.locator('a.presse__affiche')).toHaveAttribute('href', '/baromatch-film.mp4');
  await expect(page.locator('a.presse__affiche img')).toHaveAttribute('src', '/baromatch-film.webp');
  // La phrase du film, entière, et rien d’un attribut perdu dans le texte.
  await expect(page.locator('#film + p')).toHaveText('Le film de présentation de Baromatch : 15 secondes, sans le son, en portrait. Ses bars, ses clubs, ses pseudos et ses chiffres sont inventés.');
  expect(await page.locator('#film ~ *').evaluateAll((e) => e.map((x) => x.textContent).join(' '))).not.toMatch(/">|<\/a>|alt=/);
});

// Écrire : les deux boutons vont à l’adresse de marque.json, sans phrase qui la redise ; la phrase de secours la donne
// en toutes lettres. Sous les écrans, un autre format ou une plus grande taille se demande à la même adresse.
test('le contact presse : l’adresse de marque.json, et un autre format des écrans sur demande', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#contact + ul.presse__ecrire')).toHaveCount(1);
  for (const lien of await page.locator('#contact ~ .presse__ecrire a').all()) expect(await lien.getAttribute('href')).toMatch(new RegExp(`^mailto:${MARQUE.contact}\\?subject=`));
  await expect(page.locator('#contact ~ .presse__secours .presse__adresse')).toHaveText(MARQUE.contact);
  const autre = page.locator('#ecrans ~ .presse__autre-format');
  expect(normaliser(await autre.textContent())).toBe('Besoin d’un autre format ou d’une plus grande taille ? Écris-nous.');
  await expect(autre.locator('a')).toHaveAttribute('href', `mailto:${MARQUE.contact}?subject=Presse%20%E2%80%93%20Baromatch`);
});

// Le logo et l’icône, avec les tailles des fichiers qu’on télécharge, lues dans leurs PNG.
test('les tailles dites du logo et de l’icône sont celles de leurs fichiers', async ({ page }) => {
  const tailleDuPng = (nom) => { const o = readFileSync(path.join(racine, 'presse', nom)); return [o.readUInt32BE(16), o.readUInt32BE(20), o[25]]; };
  expect(tailleDuPng('baromatch-logo-fond-clair.png').slice(0, 1)).toEqual([2400]);
  expect(tailleDuPng('baromatch-logo-fond-sombre.png').slice(0, 1)).toEqual([2400]);
  // Le logo a de la transparence (type 6) ; l’icône est sur la nuit, carrée, sans transparence.
  expect(tailleDuPng('baromatch-logo-fond-clair.png')[2]).toBe(6);
  expect(tailleDuPng('baromatch-icone.png')).toEqual([1024, 1024, 2]);
  await page.goto(PAGE);
  expect(normaliser(await page.locator('#logos + p').textContent())).toBe('Le logo en SVG (net à toutes les tailles) et en PNG (2400 px de large, fond transparent). L’icône de l’appli en SVG et en PNG (1024 px, sur la nuit). Garde-les tels quels : mêmes couleurs, mêmes proportions, sans effet ajouté.');
});

test('données structurées : une page « à propos » de l’Organization de l’accueil, et son fil d’Ariane', async ({ page }) => {
  await page.goto('/');
  const accueil = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const organisation = accueil['@graph'].find((n) => n['@type'] === 'Organization');

  await page.goto(PAGE);
  const { '@graph': graphe } = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const fiche = graphe.find((n) => n['@type'] === 'AboutPage');
  // La page se suffit : elle recopie l’Organization complète de l’accueil.
  expect(graphe.find((n) => n['@type'] === 'Organization')).toEqual(organisation);
  const fil = graphe.find((n) => n['@type'] === 'BreadcrumbList');
  expect(fiche.about['@id']).toBe(organisation['@id']);
  expect(fiche.isPartOf['@id']).toBe(`${ORIGINE}/#site`);
  expect(fiche.breadcrumb['@id']).toBe(fil['@id']);
  expect(fiche.description).toBe(await page.locator('meta[name="description"]').getAttribute('content'));
  expect(fil.itemListElement.map((e) => [e.position, e.name, e.item])).toEqual([
    [1, 'Accueil', `${ORIGINE}/`],
    [2, 'Presse et partenariats', `${ORIGINE}${PAGE}`],
  ]);
  // Datée comme la page, et comme le plan du site.
  const affichee = normaliser(await page.locator('.document__date').textContent());
  expect(affichee).toBe('Mise à jour le 30 octobre 2026');
  expect(fiche.dateModified).toBe('2026-10-30');
  expect(readFileSync(path.join(racine, 'sitemap.xml'), 'utf8')).toContain('<url><loc>https://baromatch.fr/presse.html</loc><lastmod>2026-10-30</lastmod></url>');
});

test('le film en texte, les droits des visuels, et une adresse qui passe à la ligne à 200 %', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#film ~ .presse__liens-film a[href="/#film-texte"]')).toHaveText('Ce que montre le film, en texte');
  // Le film reste à regarder, et la page le dit : un lien pour le voir, aucun pour le télécharger ; l’affiche, elle,
  // se télécharge, et c’est elle que la description de la page nomme.
  await expect(page.locator('#film ~ p.presse__film-droits')).toHaveText('Le film se regarde, il ne se reprend pas. Seule son affiche peut être utilisée.');
  const description = 'Le kit de Baromatch, l’appli gratuite pour trouver un bar qui diffuse ton match à Paris : logos, écrans, affiche du film, texte à copier et contact.';
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description);
  expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'].find((n) => n['@type'] === 'AboutPage').description).toBe(description);
  // L’affiche du film, en 540 et 720 px : jamais agrandie sur un téléphone à ×3 (tests/pages-du-jour.spec.mjs).
  await expect(page.locator('a.presse__affiche img')).toHaveAttribute('srcset', '/baromatch-film.webp 540w, /baromatch-film-720.webp 720w');
  // Le film reste à regarder : un lien pour le voir, aucun pour le télécharger ; l’affiche, elle, se télécharge.
  await expect(page.locator('#film ~ .presse__liens-film a[href="/baromatch-film.mp4"]')).toHaveText('Voir le film (MP4)');
  expect(await page.locator('a[download][href$=".mp4"]').count()).toBe(0);
  await expect(page.locator('#film ~ .presse__liens-film a[download][href="/baromatch-film.webp"]')).toHaveCount(1);
  await expect(page.locator('main')).toContainText(PHRASE_DROITS);
  const adresses = await page.$$eval('a[href="mailto:contact@baromatch.fr"]', (liens) => liens.map((a) => a.innerHTML));
  expect(adresses.length).toBeGreaterThan(0);
  for (const html of adresses) expect(html).toBe('contact@<wbr>baromatch.fr');
});

test('les droits du kit presse : la phrase du propriétaire, citée mot pour mot dans les mentions légales, et plus de « libres d’utilisation »', async ({ page }) => {
  const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');
  const texteDe = (html) => normaliser(html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '));
  const phrase = texteDe(lire('presse.html').match(/<p>(Les logos, les captures[^<]*)<\/p>/)[1]);
  expect(phrase).toBe(normaliser(PHRASE_DROITS));
  const mentions = texteDe(lire('mentions-legales.html').match(/<h2>Propriété intellectuelle<\/h2>\s*<p>([\s\S]*?)<\/p>/)[1]);
  expect(mentions).toContain(`Seule exception, celle de la page Presse : « ${phrase} »`);
  // Rendu : la page Presse et les mentions disent la même phrase, et la citation mène à la page Presse.
  await page.goto(PAGE);
  expect(normaliser(await page.locator('main').textContent())).toContain(phrase);
  await page.goto('/mentions-legales.html');
  expect(normaliser(await page.locator('main').textContent())).toContain(`« ${phrase} »`);
  await expect(page.locator('main a[href="/presse.html"]')).toHaveText('page Presse');
  await expect(page.locator('.document__date')).toHaveText('Mises à jour le 29 octobre 2026');
  // Le film reste à regarder : aucun lien de téléchargement vers le MP4.
  expect(await page.locator('a[download][href$=".mp4"]').count()).toBe(0);
  // L’ancienne formule n’est plus nulle part dans les fichiers publiés.
  const publies = (dossier) => readdirSync(path.join(racine, dossier), { withFileTypes: true }).flatMap((e) => {
    if (['node_modules', '.git', 'tests', 'docs'].includes(e.name)) return [];
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return publies(chemin);
    return /\.(html|txt|md|json|xml|js|css)$/.test(e.name) ? [chemin] : [];
  });
  for (const fichier of publies('.')) expect(lire(fichier), fichier).not.toContain('libres d’utilisation');
});

// L’ouverture dit à qui écrire : un seul bouton ambre, pour la presse (le visiteur de cette page), puis le partenariat
// en contour, et une ligne pour le patron de bar qui arrive ici. Les deux objets de message sont ceux de la page.
test('l’ouverture : écrire pour la presse ou pour un partenariat, une ligne pour un bar, et le sommaire de la page', async ({ page }) => {
  await page.goto(PAGE);
  const ouverture = page.locator('.presse__ouverture');
  const liens = await ouverture.locator('.presse__actions a, .presse__bar a').evaluateAll((a) => a.map((l) => [l.className, l.textContent.trim(), l.getAttribute('href')]));
  expect(liens).toEqual([
    ['capsule', 'Écrire pour la presse', `mailto:${MARQUE.contact}?subject=Presse%20%E2%80%93%20Baromatch`],
    ['presse__bouton', 'Écrire pour un partenariat', `mailto:${MARQUE.contact}?subject=Partenariat%20%E2%80%93%20Baromatch`],
    ['', 'Proposer mon bar', '/pour-les-bars.html#proposer'],
  ]);
  expect(normaliser(await ouverture.locator('.presse__bar').textContent())).toBe('Tu tiens un bar ? Proposer mon bar');
  expect(normaliser(await ouverture.textContent())).toContain(PHRASE_DROITS);
  // Sur cette page : cinq entrées, chacune vers un titre de la page.
  const sommaire = page.getByRole('navigation', { name: 'Sur cette page' });
  const entrees = await sommaire.locator('a').evaluateAll((a) => a.map((l) => [l.textContent.trim(), l.getAttribute('href')]));
  expect(entrees).toEqual([['Logo', '#logos'], ['Écrans', '#ecrans'], ['Film', '#film'], ['Partenariats', '#partenariats'], ['Couleurs', '#couleurs'], ['Texte', '#texte'], ['Ce qu’il n’est pas', '#n-est-pas'], ['Écrire', '#contact']]);
  for (const [, ancre] of entrees) await expect(page.locator(`h2${ancre}`)).toHaveCount(1);
  // Dans l’ordre réel de la page.
  const ordre = await page.locator('main h2').evaluateAll((h) => h.map((e) => `#${e.id}`));
  const rangs = entrees.map(([, ancre]) => ordre.indexOf(ancre));
  expect(rangs).toEqual([...rangs].sort((x, y) => x - y));
});

// Les deux couleurs, dites comme on les copie : le code, ses valeurs RVB (calculées du code ici), le disque peint de la
// même couleur, et leur rôle. Une seule police, nommée, avec sa licence.
test('les couleurs et la police : chaque code, ses valeurs RVB et son disque disent la même couleur', async ({ page }) => {
  await page.goto(PAGE);
  const teintes = await page.$$eval('.presse__teintes li', (liste) => liste.map((li) => ({
    nom: li.querySelector('.presse__teinte-nom').textContent.trim(),
    codes: [...li.querySelectorAll('code')].map((c) => c.textContent.trim()),
    disque: getComputedStyle(li.querySelector('.presse__disque')).backgroundColor,
    role: li.querySelector('.presse__role').textContent.trim(),
  })));
  expect(teintes.map(({ nom, role }) => [nom, role])).toEqual([['Ambre', 'La couleur de l’action.'], ['Nuit', 'Le fond de l’appli.']]);
  for (const { nom, codes: [hex, rvb], disque } of teintes) {
    const valeurs = hex.match(/^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/).slice(1).map((x) => parseInt(x, 16));
    expect(rvb, nom).toBe(valeurs.join(' '));
    expect(disque, nom).toBe(`rgb(${valeurs.join(', ')})`);
  }
  expect(teintes.map((t) => t.codes[0])).toEqual(['#FFB13D', '#0A0B10']);
  await expect(page.locator('.presse__police .presse__teinte-nom')).toHaveText('Bricolage Grotesque');
  await expect(page.locator('.presse__police a')).toHaveAttribute('href', '/fonts/LICENSE-OFL.txt');
  expect(readFileSync(path.join(racine, 'fonts', 'LICENSE-OFL.txt'), 'utf8')).toMatch(/SIL OPEN FONT LICENSE/i);
});

// Le texte à copier se prend d’un geste (un toucher le sélectionne en entier), y compris sur iPhone, où Safari ne lit
// que -webkit-user-select.
test('le texte à copier : la phrase, la ligne et le paragraphe de marque.json, chacun sélectionné d’un geste', async ({ page }) => {
  await page.goto(PAGE);
  const copie = await page.$$eval('.presse__copie > div', (lignes) => lignes.map((div) => [div.querySelector('dt').textContent.trim(), div.querySelector('dd').textContent.replace(/[\s ]+/g, ' ').trim(), getComputedStyle(div.querySelector('dd')).userSelect]));
  expect(copie).toEqual([
    ['La phrase', MARQUE.slogan, 'all'],
    ['En une ligne', normaliser(MARQUE.uneLigne), 'all'],
    ['En un paragraphe', normaliser(MARQUE.description), 'all'],
  ]);
  const feuille = readFileSync(path.join(racine, 'presse.css'), 'utf8');
  for (const regle of feuille.split('}').filter((r) => /user-select: all/.test(r))) expect(regle).toContain('-webkit-user-select: all;');
});

// Partenariats : une phrase et son bouton, en contour. Puis à qui écrire : deux boutons en contour, chacun avec son
// objet, et la phrase de secours qui nomme ces deux objets quand la messagerie ne s’ouvre pas.
test('partenariats et contact : une phrase et son bouton, deux objets déjà écrits et la phrase de secours', async ({ page }) => {
  await page.goto(PAGE);
  const partenariats = page.locator('section[aria-labelledby="partenariats"]');
  expect(normaliser(await partenariats.textContent())).toBe('Partenariats Investisseur, club ou ville : écris-nous. Écrire pour un partenariat');
  await expect(partenariats.locator('a')).toHaveAttribute('href', `mailto:${MARQUE.contact}?subject=Partenariat%20%E2%80%93%20Baromatch`);
  await expect(partenariats.locator('a')).toHaveClass('presse__bouton');
  await expect(page.locator('main')).not.toContainText('Baromatch aujourd’hui');
  const contact = page.locator('section[aria-labelledby="contact"]');
  const boutons = await contact.locator('.presse__ecrire li').evaluateAll((li) => li.map((l) => [l.querySelector('p').textContent.trim(), l.querySelector('a').className, l.querySelector('a').getAttribute('href')]));
  expect(boutons).toEqual([
    ['Pour un article, une interview, des images', 'presse__bouton', `mailto:${MARQUE.contact}?subject=Presse%20%E2%80%93%20Baromatch`],
    ['Pour un investisseur, un club ou une ville', 'presse__bouton', `mailto:${MARQUE.contact}?subject=Partenariat%20%E2%80%93%20Baromatch`],
  ]);
  expect(normaliser(await contact.locator('.presse__secours').textContent())).toBe(`Ta messagerie ne s’ouvre pas ? Écris à ${MARQUE.contact} avec l’objet « Presse – Baromatch » ou « Partenariat – Baromatch ».`);
  // Une seule famille d’objets sur la page : « Presse – Baromatch » et « Partenariat – Baromatch ».
  const objets = await page.$$eval('main a[href^="mailto:"]', (a) => [...new Set(a.map((l) => new URL(l.href).searchParams.get('subject')).filter(Boolean))]);
  expect(objets.sort()).toEqual(['Partenariat – Baromatch', 'Presse – Baromatch']);
});

// « Ce que montre le film, en texte » mène au texte du film sur l’accueil : il s’ouvre en arrivant (main.js), au lieu
// d’un résumé fermé. Sans JavaScript, le résumé reste visible et s’ouvre au toucher.
test.describe('le film en texte, depuis la page Presse', () => {
  test.use({ javaScriptEnabled: true });
  test('le lien ouvre le texte du film sur l’accueil, et le texte se lit', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#film ~ .presse__liens-film a[href="/#film-texte"]').click();
    await expect(page).toHaveURL(/\/#film-texte$/);
    await expect(page.locator('#film-texte')).toHaveAttribute('open', '');
    await expect(page.locator('#film-texte ol li').first()).toBeVisible();
  });
  test('sur l’accueil, un lien vers #film-texte l’ouvre aussi en cours de route', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#film-texte')).not.toHaveAttribute('open', '');
    await page.evaluate(() => { location.hash = 'film-texte'; });
    await expect(page.locator('#film-texte')).toHaveAttribute('open', '');
  });
});
