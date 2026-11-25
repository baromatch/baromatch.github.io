// Ce que les trois aperçus partagent : l’en-tête HTML (sans index, sans rien d’un autre site), le logo, le formulaire de
// la liste d’attente (les mêmes champs qu’en ligne, mais rien ne part d’un aperçu) et le pied de page léger.
import { readFileSync } from 'node:fs';
import { PIED, echapper } from './donnees.mjs';

const LOGO = readFileSync(new URL('../../generateur/contenu/logo.svg', import.meta.url), 'utf8').trim();
const VERRE = readFileSync(new URL('../../generateur/contenu/verre.svg', import.meta.url), 'utf8').trim();

// Aucune requête vers un autre site, et rien ne part : un aperçu n’envoie aucun formulaire.
const POLITIQUE = "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";

export const tete = ({ titre, description, classe = '', css, image }) => `<!doctype html>
<html lang="fr"${classe ? ` class="${classe}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${POLITIQUE}">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
${image ? `<link rel="preload" as="image" href="${image.src}" imagesrcset="${image.srcset}" imagesizes="${image.sizes}" fetchpriority="high">\n` : ''}<link rel="stylesheet" href="${css}">
</head>`;

export const logo = (id = 'logo') => LOGO
  .replace('<svg ', `<svg class="logo" width="132" height="26" `)
  .replace(/id="en-/g, `id="${id}-`).replace(/url\(#en-/g, `url(#${id}-`);

export const verre = (id = 'v') => VERRE.replace(/pd-/g, `${id}-`);

export const entete = (classe = '') => `<header class="entete${classe ? ` ${classe}` : ''}">
<a class="entete__marque" href="/" aria-label="Baromatch, l’accueil">${logo('en')}</a>
<nav class="entete__nav" aria-label="Principal"><a href="/pour-les-bars.html">Pour les bars</a><a href="/a-propos.html">À propos</a></nav>
</header>`;

const VILLES = ['Paris', 'Lyon', 'Marseille', 'Lille', 'Autre'];

// La liste d’attente : l’adresse et la ville, comme le formulaire en ligne (aucun champ de plus).
export const formulaire = (id = 'liste') => `<form class="liste" id="${id}" action="#" method="post" novalidate data-apercu>
<label class="visuellement-cache" for="${id}-mail">Ton adresse e-mail</label>
<div class="liste__ligne"><input class="liste__champ" id="${id}-mail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="ton@adresse.fr" required aria-describedby="${id}-note ${id}-retour"><button class="liste__bouton" type="submit">Préviens-moi</button></div>
<details class="liste__ville"><summary>Pour <span data-ville>Paris</span> · changer de ville</summary>
<fieldset><legend class="visuellement-cache">Ta ville</legend>${VILLES.map((v, i) => `<label class="liste__puce"><input type="radio" name="ville" value="${v}"${i === 0 ? ' checked' : ''}><span>${v}</span></label>`).join('')}</fieldset>
</details>
<p class="liste__note" id="${id}-note">On t’écrit quand Baromatch ouvre dans ta ville, et pour les premiers tests. <a href="/confidentialite.html#liste-attente">Ce qu’on garde</a></p>
<p class="liste__retour" id="${id}-retour" role="status" aria-live="polite"></p>
</form>`;

export const pied = (classe = '') => `<footer class="pied${classe ? ` ${classe}` : ''}">
<div class="pied__marque"><a href="/" aria-label="Baromatch, l’accueil">${logo('pi')}</a><p>Ton match. Ton bar. Ce soir.</p></div>
<nav class="pied__liens" aria-label="Le site"><ul>${PIED.map(([href, nom]) => `<li><a href="${href}">${nom}</a></li>`).join('')}</ul></nav>
<p class="pied__contact"><a href="mailto:contact@baromatch.fr">contact@baromatch.fr</a> · © 2026 Baromatch</p>
</footer>`;

export const bandeauApercu = (nom) => `<p class="apercu">Aperçu « ${nom} » · matchs du 25 novembre · pas en ligne</p>`;
