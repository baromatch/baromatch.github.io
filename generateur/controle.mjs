// Le contrôle de chaque page avant qu’elle soit écrite : ce qu’un robot y lit (un titre de 15 à 60 caractères, une
// description de 70 à 160, l’adresse canonique, un seul h1, l’index permis ou non, les aperçus de partage), la
// politique de sécurité, aucun script, et ce que la page ne dit jamais (« ! », happy hour, tournée, verre offert,
// score). Les mots d’un bar (son nom, son adresse, son offre) sont les siens : ils sont retirés avant de chercher.
// Une page en erreur est refusée (site.mjs garde sa version précédente).
import { MOTS_INTERDITS } from './donnees.mjs';
import { CSP } from './gabarits.mjs';
import { adresseDe } from './jsonld.mjs';
import { echapper } from './texte.mjs';

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': '\'' };
const decoder = (texte) => texte.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, nom) => ENTITES[nom]);
const tous = (html, motif) => [...html.matchAll(motif)].map((m) => decoder(m[1]));

// Le texte que lit le visiteur : le corps sans ses balises, sans les données structurées ni le code du badge.
export const texteVisible = (html) => decoder((html.split('<body>')[1] ?? '')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<textarea[\s\S]*?<\/textarea>/g, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

export const controlerLaPage = (p, { motsDesBars = [] } = {}) => {
  const html = p.contenu;
  const erreurs = [];
  const exiger = (condition, message) => { if (!condition) erreurs.push(`${p.chemin} : ${message}`); };

  exiger(html.startsWith('<!doctype html>\n<html lang="fr">'), '<html lang="fr"> attendu en tête');
  const titres = tous(html, /<title>([^<]*)<\/title>/g);
  exiger(titres.length === 1, `${titres.length} titres`);
  exiger(titres[0]?.length >= 15 && titres[0]?.length <= 60, `titre de ${titres[0]?.length} caractères (15 à 60) : « ${titres[0]} »`);
  const descriptions = tous(html, /<meta name="description" content="([^"]*)">/g);
  exiger(descriptions.length === 1, `${descriptions.length} descriptions`);
  exiger(descriptions[0]?.length >= 70 && descriptions[0]?.length <= 160, `description de ${descriptions[0]?.length} caractères (70 à 160) : « ${descriptions[0]} »`);
  exiger(tous(html, /<link rel="canonical" href="([^"]*)">/g).join() === adresseDe(p.chemin), 'adresse canonique');
  exiger(tous(html, /<meta property="og:url" content="([^"]*)">/g).join() === adresseDe(p.chemin), 'og:url');
  exiger(tous(html, /<meta property="og:title" content="([^"]*)">/g).join() === titres[0], 'og:title différent du titre');
  exiger(tous(html, /<meta property="og:description" content="([^"]*)">/g).join() === descriptions[0], 'og:description différente de la description');
  exiger((html.match(/<h1[\s>]/g) ?? []).length === 1, `${(html.match(/<h1[\s>]/g) ?? []).length} h1`);
  const robots = tous(html, /<meta name="robots" content="([^"]*)">/g);
  exiger(robots.length === 1 && (p.indexable ? !/noindex/.test(robots[0]) : robots[0] === 'noindex'), `robots « ${robots.join()} » pour une page ${p.indexable ? 'indexable' : 'non indexable'}`);
  exiger(tous(html, /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g).join() === CSP, 'politique de sécurité');
  exiger([...html.matchAll(/<script\b([^>]*)>/g)].every((m) => m[1] === ' type="application/ld+json"'), 'un script autre que les données structurées');
  // Les vrais attributs des balises, sans leurs valeurs entre guillemets : un texte (« Le Spot onair=1 »), dans la
  // page ou dans la valeur d’un attribut, n’en est pas un.
  const attributs = [...html.replace(/<textarea[\s\S]*?<\/textarea>/g, '').matchAll(/<[a-zA-Z][^>]*>/g)].map((m) => m[0].replace(/"[^"]*"|'[^']*'/g, '""'));
  exiger(!attributs.some((balise) => /\son[a-z]+\s*=/i.test(balise)), 'un attribut d’évènement (onclick…)');

  // Ce que la page dit elle-même : sans les mots des bars, ni « ! », ni mot interdit, ni dans la tête ni dans le corps.
  let texte = `${titres.join(' ')} ${descriptions.join(' ')} ${texteVisible(html)}`;
  for (const mot of [...motsDesBars].sort((a, b) => b.length - a.length)) if (mot) texte = texte.split(mot).join(' ');
  exiger(!texte.includes('!'), `un point d’exclamation : « ${texte.slice(Math.max(0, texte.indexOf('!') - 40), texte.indexOf('!') + 1)} »`);
  const interdit = texte.match(MOTS_INTERDITS);
  exiger(!interdit, `un mot que le site ne publie pas : « ${interdit?.[0]} »`);
  return erreurs;
};

// Les offres des bars ne vont jamais dans un titre, une description, un aperçu ni une donnée structurée.
export const controlerLesOffres = (p, offres) => {
  const tete = p.contenu.split('<body>')[0];
  return offres.filter((o) => tete.includes(o) || tete.includes(echapper(o)) || tete.includes(JSON.stringify(o).slice(1, -1))).map((o) => `${p.chemin} : l’offre « ${o} » dans la tête de la page ou ses données structurées`);
};
