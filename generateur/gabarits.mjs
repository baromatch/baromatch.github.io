// Le HTML des pages générées : la tête (titre, description, adresse canonique, aperçus, données structurées, politique
// de sécurité), l’en-tête et le pied de page du site, et le corps de chaque sorte de page. Aucun JavaScript : tout est
// dans le HTML, lisible par un robot qui n’exécute rien. Chaque texte venu des données est échappé.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { accorder, capitale, echapper as e } from './texte.mjs';
import { jourEnLettres, quandEnLettres, heureDeParis } from './heure.mjs';
import { adresseDe, ancreDeLaSoiree, blocJsonLd, cheminDuBar, cheminDuMatch, cheminDeLaVille, debutDe, IMAGE } from './jsonld.mjs';

export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'";
const IMAGE_ALT = 'Le verre de lumière de Baromatch et la phrase : Ton match. Ton bar. Ce soir.';

// L’en-tête et la marque du pied de page, repris tels quels de l’accueil : une retouche de l’accueil passe ici au
// passage suivant. Le verre (le dessin de la marque) sert aussi au badge.
export const lireLeCadre = (racine) => {
  const accueil = readFileSync(path.join(racine, 'index.html'), 'utf8');
  const entete = accueil.match(/<header class="entete page">[\s\S]*?<\/header>/)?.[0];
  const piedMarque = accueil.match(/<div class="pied__marque">[\s\S]*?<\/div>/)?.[0];
  const verre = piedMarque?.match(/<svg viewBox="0 0 200 200"[\s\S]*?<\/svg>/)?.[0];
  if (!entete || !piedMarque || !verre) throw new Error('index.html : l’en-tête ou la marque du pied de page est introuvable, rien n’est écrit');
  return { entete, piedMarque, verre };
};

// ---------- Tête, en-tête, pied ----------

const tete = ({ titre, description, chemin, indexable, jsonld }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Page écrite par le générateur des pages des matchs (dossier generateur du dépôt), à chaque passage : une retouche
     à la main serait effacée au suivant. Aucun script : seulement les fichiers du site. -->
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${e(titre)}</title>
<meta name="description" content="${e(description)}">
<meta name="robots" content="${indexable ? 'max-image-preview:large' : 'noindex'}">
<link rel="canonical" href="${adresseDe(chemin)}">
<meta name="theme-color" content="#0A0B10">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/regarder.css">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Baromatch">
<meta property="og:title" content="${e(titre)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${adresseDe(chemin)}">
<meta property="og:image" content="${IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@baromatchapp">
<script type="application/ld+json">${blocJsonLd(jsonld)}</script>
</head>
<body>
<a class="lien-evitement" href="#contenu">Aller au contenu</a>
`;

// Le pied de page commun, dans l’ordre de toutes les pages ; « Presse » dès que la page existe.
const pied = ({ cadre, marque, chemin, avecPresse }) => {
  const x = marque.profils?.x;
  const liens = [
    ['/pour-les-bars.html', 'Pour les bars'],
    ['/matchs/', 'Où regarder le match'],
    ['/boutique.html', 'Boutique'],
    ...(avecPresse ? [['/presse.html', 'Presse']] : []),
    ['/mentions-legales.html', 'Mentions légales'],
    ['/cgu.html', 'Règles de l’appli (CGU)'],
    ['/confidentialite.html', 'Confidentialité'],
    ['/supprimer-mon-compte.html', 'Supprimer mon compte'],
  ];
  const elements = liens.map(([href, texte]) => `    <li><a href="${href}"${href === chemin ? ' aria-current="page"' : ''}>${texte}</a></li>`);
  if (x) elements.push(`    <li><a href="${e(x)}" rel="me noopener">X : @${e(x.replace(/\/+$/, '').split('/').pop())}</a></li>`);
  elements.push(`    <li><a href="mailto:${e(marque.contact)}">${e(marque.contact)}</a></li>`);
  return `<footer class="pied page">
  ${cadre.piedMarque}
  <ul class="pied__liens">
${elements.join('\n')}
  </ul>
</footer>
</body>
</html>
`;
};

// La typographie française, sur toute la page (titre, description, texte, données structurées) : une espace insécable
// avant « ? », « : » et « ; », pour que le signe ne parte jamais seul à la ligne.
export const insecables = (texte) => texte.replace(/ ([?:;])/g, '\u00A0$1');

export const page = ({ cadre, marque, avecPresse, titre, description, chemin, indexable, jsonld, corps }) => insecables(`${tete({ titre, description, chemin, indexable, jsonld })}${cadre.entete}

<main id="contenu" class="regarder page">
${corps}
</main>
${pied({ cadre, marque, chemin, avecPresse })}`);

// ---------- Morceaux communs ----------

export const fil = (etapes) => `<nav class="regarder-fil" aria-label="Fil d’Ariane">
  <ol>
${etapes.map((etape, i) => (i === etapes.length - 1
    ? `    <li aria-current="page">${e(etape.nom)}</li>`
    : `    <li><a href="${etape.chemin}">${e(etape.nom)}</a></li>`)).join('\n')}
  </ol>
</nav>`;

// Le jour et l’heure (« dimanche 25 octobre · 20:45 ») ; heureSeule : l’heure seulement (« 20:45 »), quand le jour
// est déjà le titre de la liste, comme sur la page de la semaine. La date complète reste dans l’attribut datetime.
export const quand = (match, { heureSeule = false } = {}) => {
  const texte = heureSeule
    ? (match.heureConfirmee ? heureDeParis(match.debut) : 'heure à confirmer')
    : quandEnLettres(match.debut, match.heureConfirmee);
  return `<time datetime="${debutDe(match)}">${e(texte)}</time>`;
};

const prix = (centimes) => {
  const euros = Math.floor(centimes / 100);
  const reste = centimes % 100;
  return `${euros}${reste ? `,${String(reste).padStart(2, '0')}` : ''} €`;
};

// L’offre d’une soirée (loi Evin) : telle que le bar l’a écrite, avec son heure limite, si elle est sans alcool ; sinon
// « Une offre du bar dans l’appli », sans titre ni prix. La mention santé reste dessous dès qu’une offre affichée parle
// d’alcool (le filet de sécurité).
export const offre = (o, textes) => {
  if (!o) return '';
  if (o.dansLAppli) {
    return `<div class="regarder-offre">
        <p class="regarder-offre__texte">${e(textes.offre.dansLAppli)}</p>
      </div>`;
  }
  const suite = [o.prixCentimes !== null ? prix(o.prixCentimes) : null, o.jusqua ? textes.offre.jusqua.replace('{heure}', heureDeParis(o.jusqua)) : null].filter(Boolean);
  return `<div class="regarder-offre">
        <p class="regarder-offre__texte"><span class="regarder-offre__etiquette">${e(textes.offre.etiquette)}</span> ${e(o.titre)}${suite.map((s) => ` · ${e(s)}`).join('')}</p>
${o.alcool ? `        <p class="regarder-offre__sante">${e(textes.mentionSante)}</p>\n` : ''}      </div>`;
};

// Ce que le bar dit de lui, et rien de plus.
export const atouts = (bar, textes) => {
  const t = textes.atouts;
  const liste = [];
  if (Number.isInteger(bar.atouts.screens) && bar.atouts.screens > 0) {
    liste.push((bar.atouts.screens > 1 ? t.screensPluriel : t.screens).replace('{n}', bar.atouts.screens));
  }
  for (const cle of ['sound', 'bothCamps', 'outdoor', 'food', 'standing']) if (bar.atouts[cle] === true) liste.push(t[cle]);
  return liste.length ? `<ul class="regarder-atouts">${liste.map((a) => `<li>${e(a)}</li>`).join('')}</ul>` : '';
};

// L’appel à l’action : tant que l’appli n’est pas ouverte, la liste d’attente de l’accueil.
export const appel = (marque, textes) => {
  if (marque.appli.ouverte) {
    const magasins = [['Android', marque.appli.android], ['iPhone', marque.appli.iphone]].filter(([, lien]) => lien);
    return `<div class="regarder-appel">
  ${magasins.map(([nom, lien]) => `<a class="capsule" href="${e(lien)}">${e(textes.appel.ouverte.texte)} · ${nom}</a>`).join('\n  ')}
  <p>${e(textes.appel.ouverte.note)}</p>
</div>`;
  }
  return `<div class="regarder-appel">
  <a class="capsule" href="${e(textes.appel.fermee.adresse)}">${e(textes.appel.fermee.texte)}</a>
  <p>${e(textes.appel.fermee.note)}</p>
</div>`;
};

// Tant que l’appli n’est pas ouverte, au futur (« Quand l’appli ouvre, tu pourras… ») : rien n’est promis aujourd’hui.
export const commentCaMarche = (textes, marque) => {
  const { intro, etapes } = textes.commentCaMarche[marque.appli?.ouverte ? 'ouverte' : 'fermee'];
  return `<section class="regarder-section" aria-labelledby="titre-comment">
  <h2 id="titre-comment">${e(textes.commentCaMarche.titre)}</h2>
${intro ? `  <p>${e(intro)}</p>\n` : ''}  <ol class="regarder-etapes">
${etapes.map((etape) => `    <li><strong>${e(etape.titre)}</strong> ${e(etape.texte)}</li>`).join('\n')}
  </ol>
</section>`;
};

// « Tu tiens un bar ? » : vers la page des bars.
export const tuTiensUnBar = (textes) => `<p class="regarder-bars-pro"><a href="/pour-les-bars.html">${e(textes.match.tuTiensUnBar)}</a> ${e(textes.match.tuTiensUnBarSuite)}</p>`;

// La carte d’un bar : son nom (vers sa page), son quartier et son adresse, ce qu’il dit de lui ; sur la page d’un
// match, l’offre de la soirée ; sur « Ce soir », ses places (une phrase déjà écrite, ou rien).
export const carteDuBar = (bar, textes, { soiree = null, niveau = 4, places = '' } = {}) => [
  '<li class="regarder-carte">',
  `      <h${niveau} class="regarder-carte__nom"><a href="${cheminDuBar(bar)}">${e(bar.nom)}</a></h${niveau}>`,
  `      <p class="regarder-carte__lieu">${e(bar.quartier)} · ${e(bar.adresse)}</p>`,
  places && `      <p class="regarder-carte__places">${e(places)}</p>`,
  atouts(bar, textes) && `      ${atouts(bar, textes)}`,
  soiree?.offre && `      ${offre(soiree.offre, textes)}`,
  '    </li>',
].filter(Boolean).join('\n');

// Une ligne de match : son nom court (vers sa page s’il en a une), le jour et l’heure (ou l’heure seule, sous un
// titre qui donne déjà le jour), la compétition.
export const ligneDeMatch = (match, { avecPage, suite = '', heureSeule = false }) => {
  const nom = `${e(match.domicile.court)} – ${e(match.exterieur.court)}`;
  return `<li>${avecPage ? `<a href="${cheminDuMatch(match)}">${nom}</a>` : nom} · ${quand(match, { heureSeule })} · ${e(match.competition)}${suite}</li>`;
};

export { accorder, capitale, e, jourEnLettres, heureDeParis, ancreDeLaSoiree, cheminDeLaVille, cheminDuBar, cheminDuMatch };
