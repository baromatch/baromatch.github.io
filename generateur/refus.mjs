// Ce que devient une page refusée par le contrôle (site.mjs) : jamais rien de faux, de vieux ou de retiré en ligne, et
// jamais un lien vers une page qui n’existe pas.
// Sa version précédente reste en ligne seulement si elle est sûre : l’état dit quels bars elle nomme et chacun est
// encore publié (un bar retiré de bars-publies.json, ou exclu, n’y reste jamais), chaque page qu’elle cite existe encore
// après ce passage, et elle n’est pas gardée depuis plus de 24 heures (elle vieillit : jours, soirées, bars). Sinon, une
// page neutre la remplace à la même adresse (« Cette page se met à jour », en noindex, vers les matchs et les villes),
// et un bar y a le badge générique : les liens des autres pages mènent toujours quelque part. Le journal dit chaque cas.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { HEURE_MS } from './donnees.mjs';
import { fichierDuChemin } from './etat.mjs';
import { page } from './gabarits.mjs';
import { filDAriane, pageWeb } from './jsonld.mjs';
import { echapper as e } from './texte.mjs';

export const GARDE_MAX_MS = 24 * HEURE_MS;

// Les textes de la page neutre, écrits ici et pas dans textes.json : elle doit rester juste même quand ces textes-là
// sont la cause du refus.
export const TEXTES_DU_REPLI = {
  titre: 'Cette page se met à jour',
  description: 'Cette page de Baromatch se met à jour. En attendant, les matchs de la semaine et les bars qui les diffusent sont sur la page des matchs.',
  chapeau: 'En attendant, les matchs de la semaine et les bars qui les diffusent sont ici :',
  matchs: 'Les matchs de la semaine',
  villes: 'Toutes les villes',
};

// Les adresses de pages générées qu’un fichier cite (liens, adresse canonique, données structurées, badge) :
// « /matchs/…/ », « /regarder-le-match/…/ », « /bar/…/ ».
export const adressesCitees = (html) => [...new Set([...html.matchAll(/(?:https:\/\/baromatch\.fr)?(\/(?:matchs|regarder-le-match|bar)\/(?:[a-z0-9-]+\/)*)/g)].map((m) => m[1]))];

// Pourquoi la version précédente d’une page refusée ne peut pas rester en ligne, ou null si elle le peut.
// avant : son entrée dans l’état ; html : son contenu sur le disque (null s’il manque) ; publies : les identifiants des
// bars publiés à ce passage ; existantes : les adresses des pages qui existent après ce passage.
export const raisonDeNePasGarder = ({ avant, html, publies, existantes, maintenant }) => {
  if (!avant || html === null) return 'elle n’a pas de version précédente';
  if (avant.repli) return 'sa version précédente est déjà la page neutre';
  if (!Array.isArray(avant.bars)) return 'l’état ne dit pas quels bars elle nomme';
  const retires = avant.bars.filter((id) => !publies.has(String(id)));
  if (retires.length) return `elle nomme un bar qui n’est plus publié (${retires.join(', ')})`;
  const disparues = adressesCitees(html).filter((chemin) => !existantes.has(chemin));
  if (disparues.length) return `elle mène à une page qui n’existe plus (${disparues.join(', ')})`;
  if (avant.gardeeDepuis && maintenant - Date.parse(avant.gardeeDepuis) >= GARDE_MAX_MS) return 'elle est gardée depuis plus de 24 heures';
  return null;
};

// La page neutre, à l’adresse de la page refusée. Elle garde la mémoire de la page refusée (ce qu’il faut pour la
// refaire au passage suivant) et ne nomme aucun bar.
export const pageDeRepli = (refusee, { cadre, marque, avecPresse }) => {
  const t = TEXTES_DU_REPLI;
  const { chemin } = refusee;
  const titre = `${t.titre} — Baromatch`;
  const etapes = [{ nom: 'Accueil', chemin: '/' }, { nom: t.titre, chemin }];
  const corps = `<nav class="regarder-fil" aria-label="Fil d’Ariane">
  <ol>
    <li><a href="/">Accueil</a></li>
    <li aria-current="page">${e(t.titre)}</li>
  </ol>
</nav>
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(t.titre)}</h1>
  <p class="regarder-chapeau">${e(t.chapeau)}</p>
</header>
<ul class="regarder-matchs">
  <li><a href="/matchs/">${e(t.matchs)}</a></li>
  <li><a href="/regarder-le-match/">${e(t.villes)}</a></li>
</ul>`;
  return {
    type: refusee.type, cle: refusee.cle, ...(refusee.date ? { date: refusee.date } : {}), chemin, indexable: false, repli: true,
    ...(refusee.memoire ? { memoire: refusee.memoire } : {}),
    titre, description: t.description,
    contenu: page({ cadre, marque, avecPresse, titre, description: t.description, chemin, indexable: false, jsonld: [pageWeb({ chemin, titre, description: t.description }), filDAriane(etapes)], corps }),
  };
};

// Pour chaque page refusée : sa version précédente gardée ({ chemin, entree }, avec son badge), ou sa page neutre.
// controler : le contrôle de site.mjs, que la page neutre passe aussi (sinon, rien n’est écrit).
export const traiterLesRefus = ({ site, precedent, sortie, maintenant, controler }) => {
  const publies = new Set(site.donnees.bars.map((b) => b.id));
  const existantes = new Set([...site.pages, ...site.refusees].map((p) => p.chemin));
  const gardees = [];
  const replis = [];
  const messages = [];
  for (const refusee of site.refusees) {
    const avant = precedent.pages?.[refusee.chemin];
    const fichier = path.join(sortie, fichierDuChemin(refusee.chemin));
    const html = avant && existsSync(fichier) ? readFileSync(fichier, 'utf8') : null;
    const raison = raisonDeNePasGarder({ avant, html, publies, existantes, maintenant });
    const erreurs = refusee.erreurs.join(' ; ');
    if (!raison) {
      gardees.push({ chemin: refusee.chemin, entree: { ...avant, gardeeDepuis: avant.gardeeDepuis ?? new Date(maintenant).toISOString() } });
      const badge = `${refusee.chemin}badge.svg`;
      if (precedent.pages?.[badge]) gardees.push({ chemin: badge, entree: precedent.pages[badge] });
      messages.push(`Page refusée, sa version précédente reste en ligne : ${refusee.chemin} (${erreurs})`);
      continue;
    }
    const repli = pageDeRepli(refusee, { cadre: site.cadre, marque: site.contenu.marque, avecPresse: site.avecPresse });
    const erreursDuRepli = controler(repli);
    if (erreursDuRepli.length) throw new Error(`La page neutre est refusée elle aussi, rien n’est écrit :\n${erreursDuRepli.join('\n')}`);
    replis.push(repli);
    messages.push(`Page refusée, remplacée par une page neutre : ${refusee.chemin} (${erreurs}) ; sa version précédente ne reste pas : ${raison}`);
  }
  return { gardees, replis, messages };
};
