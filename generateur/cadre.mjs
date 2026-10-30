// Le cadre de chaque page du site, d’une seule source : l’en-tête (la navigation « les matchs d’abord ») et le pied de
// page. Les pages du générateur le reçoivent de page() (gabarits.mjs) ; les pages écrites à la main, entre leurs repères
// (<!-- entete:debut --> … <!-- entete:fin -->, <!-- pied:debut --> … <!-- pied:fin -->), que « npm run cadre » (ce
// fichier, lancé seul) réécrit. tests/cadre.spec.mjs refuse une page dont l’en-tête ou le pied diffère de cette source.
// Les mots : contenu/cadre.json ; le logo et le verre du pied : contenu/logo.svg et contenu/verre.svg ; les clubs, les
// compétitions et les villes du pied : les listes du générateur (suivre.json, clubs.json, couleurs.json, villes.json),
// celles dont les pages existent toujours ; l’état de l’appli : marque.json.
// L’en-tête : le logo, quatre entrées (« Ce soir » et « La semaine » en paire, « Pour les bars », « À propos »), sans
// chiffre ni script, la page où l’on est marquée (aria-current), puis « Préviens-moi » sur les pages qui le portent :
// ambre si la page n’a pas déjà son bouton ambre, en contour sinon (actionDeLaPage).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_GENERATEUR, RACINE } from './contenu.mjs';
import { pagesEcritesALaMain } from './mesure.mjs';
import { echapper as e } from './texte.mjs';

const lire = (fichier) => readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', fichier), 'utf8');
const lireJson = (fichier) => JSON.parse(lire(fichier));
const sansNotes = (objet) => Object.entries(objet).filter(([cle]) => !cle.startsWith('_'));

// Un club, un disque : sa première couleur de midi dans le sens des aiguilles d’une montre, sur la part que
// couleurs.json lui donne (la moitié par défaut), la seconde dessous. Un club sans couleurs connues : un disque neutre.
// Des attributs de SVG, pas de style en ligne (la politique de sécurité des pages n’en permet aucun).
const COULEUR = /^#[0-9A-F]{6}$/i;
export const disque = (couleurs) => {
  const [premiere, seconde = premiere, part = 0.5] = Array.isArray(couleurs) ? couleurs : [];
  if (!COULEUR.test(premiere ?? '') || !COULEUR.test(seconde) || !(part >= 0.5 && part <= 0.85)) {
    return '<svg class="disque disque--neutre" viewBox="0 0 2 2" aria-hidden="true" focusable="false"><circle cx="1" cy="1" r="1"/></svg>';
  }
  const angle = 2 * Math.PI * part;
  const point = `${(1 + Math.sin(angle)).toFixed(3)} ${(1 - Math.cos(angle)).toFixed(3)}`;
  return `<svg class="disque" viewBox="0 0 2 2" aria-hidden="true" focusable="false"><circle cx="1" cy="1" r="1" fill="${seconde}"/><path d="M1 1V0A1 1 0 ${part > 0.5 ? 1 : 0} 1 ${point}z" fill="${premiere}"/></svg>`;
};

// Ce que le cadre lit, une fois : ses mots, ses deux dessins, et les listes du pied. racine : gardée pour les appels
// d’avant ; le cadre est celui du générateur, quel que soit le site qu’il écrit.
export const lireLeCadre = () => {
  const suivre = lireJson('suivre.json');
  const noms = lireJson('clubs.json');
  const couleurs = lireJson('couleurs.json');
  return {
    textes: lireJson('cadre.json'),
    logo: lire('logo.svg').trim(),
    verre: lire('verre.svg').trim(),
    clubs: sansNotes(suivre.clubs).map(([cle]) => ({ cle, nom: noms[cle]?.court ?? cle, couleurs: couleurs[cle] })),
    competitions: sansNotes(suivre.competitions).map(([nom, c]) => ({ cle: c.cle, nom })),
    villes: sansNotes(lireJson('villes.json')).map(([cle, v]) => ({ cle, nom: v.nom })),
  };
};

// Un lien du cadre ; celui de la page où l’on est le dit (aria-current).
// contenu : du HTML déjà échappé.
const lien = (href, contenu, chemin, classe = '') => `<a${classe ? ` class="${classe}"` : ''} href="${href}"${href === chemin ? ' aria-current="page"' : ''}>${contenu}</a>`;

// L’en-tête. action : null (l’accueil, « Pour les bars », les pages légales, la page introuvable, les affiches),
// « ambre » ou « contour ». Une page en anglais garde l’en-tête en français, et le dit.
export const entete = (cadre, { chemin = '', action = null, langue = 'fr' } = {}) => {
  const m = cadre.textes.menu;
  const entree = (href, texte) => `<li>${lien(href, e(texte), chemin, 'menu__lien')}</li>`;
  return `<header class="entete page"${langue === 'en' ? ' lang="fr"' : ''}>
<a class="entete__logo" href="/" aria-label="Baromatch, accueil">${cadre.logo}</a>
<nav class="menu" aria-label="${e(m.nom)}">
<ul class="menu__liste">
<li class="menu__groupe">
<ul class="menu__matchs">
${entree('/ce-soir/', m.ceSoir)}
${entree('/matchs/', m.semaine)}
</ul>
</li>
${entree('/pour-les-bars.html', m.bars)}
${entree('/a-propos.html', m.aPropos)}
</ul>
</nav>${action ? `
<a class="entete__attente${action === 'contour' ? ' entete__attente--contour' : ''}" href="/#attente">${e(cadre.textes.action)}</a>` : ''}
</header>`;
};

// Les boutons ambre du site (styles.css, regarder.css) : une page qui en montre un a « Préviens-moi » en contour, pour
// qu’un seul ambre plein appelle à l’action. Une capsule de verre n’est pas ambre.
const AMBRES = new Set(['capsule', 'attente__bouton', 'carte-match__voir', 'inscription__bouton', 'panier__envoyer', 'boutique-produit__ajouter',
  'boutique-barre__bouton', 'tablee__bouton', 'vitrine-accueil__bouton', 'perdu__accueil']);
const DE_VERRE = new Set(['capsule--verre', 'vitrine-accueil__bouton--verre']);
export const aUnBoutonAmbre = (html) => [...html.matchAll(/\sclass="([^"]*)"/g)]
  .map(([, classes]) => classes.split(/\s+/))
  .some((classes) => classes.some((c) => AMBRES.has(c)) && !classes.some((c) => DE_VERRE.has(c)));
export const actionDeLaPage = (contenu) => (aUnBoutonAmbre(contenu) ? 'contour' : 'ambre');
// Les pages du générateur portent « Préviens-moi », sauf les affiches à imprimer et la feuille du patron (/affiche/) :
// elles servent au patron d’un bar.
export const pageDuGenerateurAvecLAction = (chemin) => !chemin.includes('/affiche/');

// Le pied de page, de nuit. marque : marque.json (le contact, X, le slogan, l’état de l’appli). avecPresse : la page
// Presse existe. Sur une page en anglais, le même pied, dit en français (lang="fr"), sous une phrase en anglais.
// Écrit serré (une balise par ligne, sans retrait, sans classe que styles.css ne lit pas) : il est sur chaque page, et
// une page de plus de 73 000 octets perd un aller-retour sur un téléphone lent (tests/pour-les-bars.spec.mjs). L’adresse
// passe à la ligne après « @ » (<wbr>), quand le texte est agrandi.
export const pied = (cadre, { marque, chemin = '', avecPresse = true, langue = 'fr' } = {}) => {
  const t = cadre.textes.pied;
  const m = cadre.textes.menu;
  const liste = (liens) => `<ul>\n${liens.map(([href, texte]) => `<li>${lien(href, e(texte), chemin)}</li>`).join('\n')}\n</ul>`;
  const colonne = (titre, contenu) => `<div>\n<h2>${e(titre)}</h2>\n${contenu}\n</div>`;
  const etat = t.etat[marque.appli?.ouverte ? 'ouverte' : 'fermee'];
  const x = marque.profils?.x;
  const clubs = `<ul class="pied__clubs">\n${cadre.clubs.map((c) => `<li>${lien(`/matchs/club/${c.cle}/`, `${disque(c.couleurs).replace(' focusable="false"', '')}${e(c.nom)}`, chemin, 'pied__club')}</li>`).join('\n')}\n</ul>`;
  return `<footer class="pied page"${langue === 'en' ? ' lang="fr"' : ''}>${langue === 'en' ? `
<p class="pied__langue" lang="en">${e(t.langue)}</p>` : ''}
<div class="pied__tete">
<div>
<div class="pied__marque">${cadre.verre}<span>${e(marque.nom)}</span></div>
<p class="pied__slogan">${e(marque.slogan)}</p>${etat ? `
<p class="pied__etat">${e(etat)}</p>` : ''}
</div>
<div class="pied__contact">
<ul>
<li>${lien('/#attente', e(t.attente), chemin, 'pied__action')}</li>
<li>${lien('/pour-les-bars.html#proposer', e(t.proposer), chemin, 'pied__action')}</li>
</ul>
<p>${e(t.contact)}\u00A0: <a href="mailto:${e(marque.contact)}">${e(marque.contact).replace('@', '@<wbr>')}</a></p>${x ? `
<p><a href="${e(x)}" rel="me noopener">X\u00A0: @${e(x.replace(/\/+$/, '').split('/').pop())}</a></p>` : ''}
</div>
</div>
<nav class="pied__plan" aria-label="${e(t.plan)}">
${colonne(t.matchs, liste([['/ce-soir/', m.ceSoir], ['/matchs/', m.semaine], ['/agenda/', t.agenda]]))}
${colonne(t.clubs, clubs)}
${colonne(t.competitions, liste(cadre.competitions.map((c) => [`/matchs/competition/${c.cle}/`, c.nom])))}
${colonne(t.villes, liste([...cadre.villes.map((v) => [`/regarder-le-match/${v.cle}/`, v.nom]), ['/regarder-le-match/', t.toutesLesVilles]]))}
${colonne(t.baromatch, liste([
    ['/pour-les-bars.html', m.bars],
    ['/a-propos.html', m.aPropos],
    ...(avecPresse ? [['/presse.html', t.presse]] : []),
    ['/comment-on-choisit-les-bars.html', t.choisir],
    ['/trouver-un-bar-qui-diffuse-le-match.html', t.guide],
    ['/testeurs-android.html', t.testeurs],
    ['/boutique.html', t.boutique],
  ]))}
</nav>
<div class="pied__legal">
<nav aria-label="${e(t.legal)}">
${liste([['/mentions-legales.html', t.mentions], ['/cgu.html', t.cgu], ['/confidentialite.html', t.confidentialite], ['/supprimer-mon-compte.html', t.supprimer]])}
</nav>
<p>${e(t.droits)}</p>
</div>
</footer>`;
};

// ---------- Les pages écrites à la main ----------

// Chaque page écrite à la main, à son adresse, et si son en-tête porte « Préviens-moi » (décidé le 29 octobre : pas
// sur l’accueil, qui a le formulaire, ni sur « Pour les bars », dont l’action est « Proposer mon bar », ni sur les pages
// légales et la page introuvable). Une page écrite à la main qui n’est pas ici fait échouer « npm run cadre ».
export const PAGES_DU_CADRE = [
  { fichier: 'index.html', chemin: '/', action: false },
  { fichier: 'pour-les-bars.html', chemin: '/pour-les-bars.html', action: false },
  { fichier: 'mentions-legales.html', chemin: '/mentions-legales.html', action: false },
  { fichier: 'cgu.html', chemin: '/cgu.html', action: false },
  { fichier: 'confidentialite.html', chemin: '/confidentialite.html', action: false },
  { fichier: 'supprimer-mon-compte.html', chemin: '/supprimer-mon-compte.html', action: false },
  { fichier: '404.html', chemin: '/404.html', action: false },
  { fichier: 'a-propos.html', chemin: '/a-propos.html', action: true },
  { fichier: 'presse.html', chemin: '/presse.html', action: true },
  { fichier: 'comment-on-choisit-les-bars.html', chemin: '/comment-on-choisit-les-bars.html', action: true },
  { fichier: 'trouver-un-bar-qui-diffuse-le-match.html', chemin: '/trouver-un-bar-qui-diffuse-le-match.html', action: true },
  { fichier: 'testeurs-android.html', chemin: '/testeurs-android.html', action: true },
  { fichier: 'boutique.html', chemin: '/boutique.html', action: true },
];

export const REPERES_DU_CADRE = {
  entete: { debut: '<!-- entete:debut -->', fin: '<!-- entete:fin -->' },
  pied: { debut: '<!-- pied:debut -->', fin: '<!-- pied:fin -->' },
};

// Ce qui est entre les deux repères d’une page (une fois chacun), ou une erreur qui dit lequel manque.
const entre = (html, { debut, fin }) => {
  const i = html.indexOf(debut);
  const j = html.indexOf(fin);
  if (i < 0 || j < i || html.indexOf(debut, i + 1) >= 0 || html.indexOf(fin, j + 1) >= 0) throw new Error(`les repères ${debut} et ${fin}, une fois chacun et dans cet ordre, sont introuvables`);
  return { avant: html.slice(0, i + debut.length), dedans: html.slice(i + debut.length, j), apres: html.slice(j) };
};

// La page avec son cadre : l’en-tête et le pied écrits entre leurs repères, rien d’autre de changé. Le style de
// « Préviens-moi » se lit dans le reste de la page (hors de l’en-tête et du pied).
export const pageAvecLeCadre = (html, { chemin, action }, { cadre = lireLeCadre(), marque, avecPresse = true } = {}) => {
  const haut = entre(html, REPERES_DU_CADRE.entete);
  const bas = entre(haut.apres, REPERES_DU_CADRE.pied);
  const reste = `${haut.avant}${bas.avant}${bas.apres}`;
  const style = action ? actionDeLaPage(reste) : null;
  return `${haut.avant}\n${entete(cadre, { chemin, action: style })}\n${bas.avant}\n${pied(cadre, { marque, chemin, avecPresse })}\n${bas.apres}`;
};

// Réécrit le cadre de chaque page écrite à la main (toutes contrôlées avant d’en écrire une seule) ; verifier : n’écrit
// rien, et rend seulement les pages qui changeraient. Rend les fichiers changés (ou à changer).
export const ecrireLeCadre = ({ racine = RACINE, verifier = false } = {}) => {
  const marque = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
  const cadre = lireLeCadre();
  const connues = new Set(PAGES_DU_CADRE.map((p) => p.fichier));
  const oubliees = pagesEcritesALaMain(racine).filter((f) => !connues.has(f));
  if (oubliees.length) throw new Error(`Pages écrites à la main sans cadre (à ajouter à PAGES_DU_CADRE) : ${oubliees.join(', ')} ; rien n’est écrit`);
  const changees = [];
  const erreurs = [];
  for (const p of PAGES_DU_CADRE) {
    const fichier = path.join(racine, p.fichier);
    const avant = readFileSync(fichier, 'utf8');
    try {
      const apres = pageAvecLeCadre(avant, p, { cadre, marque });
      if (apres !== avant) changees.push({ fichier: p.fichier, chemin: fichier, apres });
    } catch (erreur) {
      erreurs.push(`${p.fichier} : ${erreur.message}`);
    }
  }
  if (erreurs.length) throw new Error(`${erreurs.join('\n')}\nRien n’est écrit.`);
  if (!verifier) for (const c of changees) writeFileSync(c.chemin, c.apres);
  return changees.map((c) => c.fichier);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verifier = process.argv.includes('--verifier');
  const changees = ecrireLeCadre({ verifier });
  if (verifier && changees.length) {
    console.error(`Le cadre de ces pages n’est plus celui de generateur/cadre.mjs : ${changees.join(', ')}. Lance « npm run cadre ».`);
    process.exit(1);
  }
  console.log(changees.length ? `Cadre réécrit : ${changees.join(', ')}` : 'Le cadre de chaque page est à jour.');
}
