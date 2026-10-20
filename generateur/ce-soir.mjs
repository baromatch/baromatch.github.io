// La page « Ce soir » (/ce-soir/), refaite à chaque passage : les matchs de ce soir à l’heure de Paris et, pour chacun,
// les vrais bars publiés qui le diffusent (les mêmes soirées que sur la page du match), avec leurs places seulement
// quand l’appli est ouverte et que les listes publiques les donnent.
// « Ce soir », c’est le jour de Paris du passage : ses matchs pas encore finis (un match se joue trois heures au plus,
// prolongations comprises, comme partout ailleurs sur le site), et un match de la veille qui se joue encore. Après
// minuit, la page passe au nouveau jour : l’Action passe juste après minuit à Paris (0 h 05, en heure d’été comme
// d’hiver), et qui la lit alors pense à la soirée qui vient ; un match de la veille qui se joue encore y reste
// (« Commencé le … »). Le jour est écrit en entier dans son titre et sous lui. Un match fini n’est plus listé.
// Indexable seulement quand elle montre un vrai bar pour un match de ce soir. Sinon noindex, et elle montre quand même
// les matchs du jour et les suivants (vers leurs pages), les villes et la liste d’attente : jamais vide, jamais un faux
// bar. Ses données structurées : la page, son fil d’Ariane et la liste des matchs qu’elle montre, chacun vers sa page ;
// les soirées (Event) restent sur les pages des matchs et des bars, où elles sont décrites. Comme une page de match,
// elle a le bloc « Partager » et son image d’aperçu (partage.mjs) : le jour écrit en entier, ses matchs, le vrai nombre
// de vrais bars.
import { DUREE_MATCH_MS } from './donnees.mjs';
import { heureDeParis, heureDuJour, jourDeParis, jourEnLettres } from './heure.mjs';
import { accorder, capitale, echapper as e, enumerer } from './texte.mjs';
import { adresseDe, cheminDuMatch, filDAriane, pageWeb } from './jsonld.mjs';
import { appel, carteDuBar, commentCaMarche, fil, ligneDeListe, ligneDeMatch, page, quand, tuTiensUnBar } from './gabarits.mjs';
import { barsParVille, description, titre } from './pages.mjs';
import { adresseDeLImage, lignesDeLaCarte } from './partage.mjs';

export const CHEMIN_CE_SOIR = '/ce-soir/';
// Au moins un vrai bar pour un match de ce soir : la page est indexable.
export const BARS_POUR_CE_SOIR = 1;
// Les prochains matchs montrés sous ceux de ce soir.
export const PROCHAINS = 8;

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
// « 2 bars à Paris, 1 bar à Lyon », en texte : chaque carte, dessous, dit déjà sa ville.
const compteParVille = (soirees) => {
  const villes = new Map();
  for (const s of soirees) villes.set(s.bar.ville.nom, (villes.get(s.bar.ville.nom) ?? 0) + 1);
  return [...villes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([ville, n]) => `${accorder(n, 'bar')} à ${ville}`).join(', ');
};

// Les places de chaque soirée, telles que les listes publiques les donnent (GET /bars/match-nights) : les places que
// l’appli peut encore donner, « complet », et si l’on peut réserver. Une valeur absente ou illisible reste absente :
// aucun nombre n’est deviné.
export const lireLesPlaces = (nuits = []) => new Map(nuits.filter((n) => n && n.id !== undefined && n.id !== null).map((n) => [String(n.id), {
  restantes: Number.isInteger(n.remainingPlatformSeats) && n.remainingPlatformSeats >= 0 ? n.remainingPlatformSeats : null,
  complet: n.isSoldOut === true,
  ouvertes: typeof n.reservationsOpen === 'boolean' ? n.reservationsOpen : null,
}]));

// La phrase des places d’une soirée, à l’heure du passage (la page vit trois heures), ou rien : l’appli fermée, le
// match commencé, une soirée que le bar a fermée, ou rien dans les listes.
const phraseDesPlaces = (places, { heure, t }) => {
  if (!places) return '';
  if (places.complet || places.restantes === 0) return remplir(t.complet, { heure });
  if (places.restantes === null || places.ouvertes === false) return '';
  return remplir(places.restantes > 1 ? t.places : t.placesUne, { heure, n: places.restantes });
};

const listeDesMatchs = (nom, matchs) => ({
  '@type': 'ItemList',
  name: nom,
  numberOfItems: matchs.length,
  itemListElement: matchs.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: nomCourt(m), url: adresseDe(cheminDuMatch(m)) })),
});

// pages : celles du passage (pour savoir quel match a sa page, et quelles villes en ont une) ; nuits : la liste brute
// des soirées, pour leurs places ; images : le rendu des images de partage est là (sinon, l’image générale du site).
export const fabriquerCeSoir = ({ donnees, contenu, cadre, avecPresse = false, pages = [], nuits = [], images = false }) => {
  const { maintenant } = donnees;
  const { textes, marque } = contenu;
  const t = textes.ceSoir;
  const chemin = CHEMIN_CE_SOIR;
  const aujourdhui = jourDeParis(maintenant);
  const moment = heureDuJour(maintenant) >= 17 ? t.soir : t.jour;
  const avecPage = new Set(pages.filter((p) => p.type === 'match').map((p) => p.chemin));
  const aUnePage = (m) => avecPage.has(cheminDuMatch(m));
  const commence = (m) => m.debut <= maintenant;
  const parDebut = (a, b) => a.debut - b.debut || a.slug.localeCompare(b.slug);

  // ---------- Ce soir, et la suite ----------
  const ceSoir = donnees.matchs
    .filter((m) => m.debut + DUREE_MATCH_MS > maintenant && (jourDeParis(m.debut) === aujourdhui || commence(m)))
    .sort(parDebut);
  // Un match reporté ou annulé reste listé, avec son statut, mais sans ses bars.
  const avecBars = ceSoir.filter((m) => !m.statut && m.soirees.length > 0);
  const autres = ceSoir.filter((m) => !avecBars.includes(m));
  const soirees = avecBars.flatMap((m) => m.soirees);
  const nombreDeBars = new Set(soirees.map((s) => s.bar.id)).size;
  const indexable = nombreDeBars >= BARS_POUR_CE_SOIR;
  const fini = ceSoir.length === 0 && donnees.matchs.some((m) => jourDeParis(m.debut) === aujourdhui && !m.statut);
  const prochains = donnees.matchs.filter((m) => !ceSoir.includes(m) && m.debut > maintenant && !m.statut && aUnePage(m)).sort(parDebut).slice(0, PROCHAINS);

  // ---------- Les morceaux ----------
  const lien = (m) => (aUnePage(m) ? `<a href="${cheminDuMatch(m)}">${e(nomCourt(m))}</a>` : e(nomCourt(m)));
  // L’heure du coup d’envoi ; « Commencé à 20:45 » une fois le match commencé (vrai à toute heure de lecture), avec le
  // jour s’il a commencé la veille.
  const coupDEnvoi = (m) => {
    const memeJour = jourDeParis(m.debut) === aujourdhui;
    const heure = quand(m, { heureSeule: memeJour, majuscule: !commence(m) });
    if (!commence(m)) return heure;
    return `${e(memeJour ? t.commenceA : t.commenceLe)} ${heure}`;
  };
  const places = lireLesPlaces(nuits);
  const heure = heureDeParis(maintenant);
  const placesDe = (s) => (marque.appli?.ouverte && !commence(s.match) ? phraseDesPlaces(places.get(s.id), { heure, t }) : '');
  const parLieu = (a, b) => a.bar.ville.nom.localeCompare(b.bar.ville.nom, 'fr')
    || (a.bar.arrondissement?.numero ?? 0) - (b.bar.arrondissement?.numero ?? 0) || a.bar.nom.localeCompare(b.bar.nom, 'fr');
  const blocDuMatch = (m) => `  <div class="regarder-soir">
    <h3 class="regarder-soir__match">${lien(m)}</h3>
    <p class="regarder-soir__quand">${coupDEnvoi(m)} · ${e(m.competition)} · ${e(compteParVille(m.soirees))}</p>
    <ul class="regarder-cartes">
      ${[...m.soirees].sort(parLieu).map((s) => carteDuBar(s.bar, textes, { soiree: s, niveau: 4, places: placesDe(s) })).join('\n      ')}
    </ul>
  </div>`;
  const ligneDuSoir = (m) => `    ${ligneDeListe(e(nomCourt(m)), aUnePage(m) ? cheminDuMatch(m) : null, `${coupDEnvoi(m)} · ${e(m.competition)} · ${m.statut
    ? `<strong>${e(textes.match[m.statut])}</strong>`
    : `<span class="regarder-compte">${e(textes.semaine.pasDeBar)}</span>`}`)}`;

  // ---------- Les sections ----------
  const sectionDuSoir = avecBars.length
    ? `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(moment.avecBars)}</h2>
${avecBars.map(blocDuMatch).join('\n')}
</section>${autres.length ? `
<section class="regarder-section" aria-labelledby="titre-autres">
  <h2 id="titre-autres">${e(moment.autres)}</h2>
  <ul class="regarder-matchs">
${autres.map(ligneDuSoir).join('\n')}
  </ul>
</section>` : ''}`
    : ceSoir.length
      ? `<section class="regarder-section" aria-labelledby="titre-matchs">
  <h2 id="titre-matchs">${e(moment.matchs)}</h2>
${ceSoir.some((m) => !m.statut) ? `  <p class="regarder-vide">${e(moment.sansBar)}</p>
  ${tuTiensUnBar(textes)}
` : ''}  <ul class="regarder-matchs">
${ceSoir.map(ligneDuSoir).join('\n')}
  </ul>
</section>`
      : `<section class="regarder-section regarder-ce-soir" aria-labelledby="titre-rien">
  <h2 id="titre-rien">${e(fini ? t.fini : t.rien)}</h2>
  <p>${e(fini ? t.finiSuite : t.rienSuite)}</p>
</section>`;
  // Les prochains matchs, sous le titre de leur jour : la ligne ne donne que l’heure, comme sur la semaine.
  const joursProchains = [...new Set(prochains.map((m) => jourDeParis(m.debut)))];
  const sectionProchains = `<section class="regarder-section" aria-labelledby="titre-prochains">
  <h2 id="titre-prochains">${e(t.prochains)}</h2>
${prochains.length ? joursProchains.map((j) => `  <h3 class="regarder-jour">${e(capitale(jourEnLettres(Date.parse(`${j}T12:00:00Z`))))}</h3>
  <ul class="regarder-matchs">
${prochains.filter((m) => jourDeParis(m.debut) === j).map((m) => `    ${ligneDeMatch(m, { avecPage: true, heureSeule: true, suite: ` · <span class="regarder-compte">${m.soirees.length ? barsParVille(m.soirees) : e(textes.semaine.pasDeBar)}</span>` })}`).join('\n')}
  </ul>`).join('\n') : `  <p>${e(t.aucunProchain)}</p>`}
  <p class="regarder-suite"><a href="/matchs/">${e(textes.villes.voirLaSemaine)}</a></p>
</section>`;
  // Les villes qui ont leur page : celles qui ont des vrais bars d’abord.
  const villes = pages.filter((p) => p.type === 'ville').map((p) => ({ chemin: p.chemin, nom: p.memoire?.nom ?? p.cle, bars: donnees.bars.filter((b) => b.ville.cle === p.cle).length }))
    .sort((a, b) => b.bars - a.bars || a.nom.localeCompare(b.nom, 'fr'));
  const sectionVilles = villes.length ? `<section class="regarder-section" aria-labelledby="titre-villes">
  <h2 id="titre-villes">${e(t.villes)}</h2>
  <p>${e(t.villesSuite)}</p>
  <ul class="regarder-matchs">
${villes.map((v) => `    ${ligneDeListe(e(remplir(textes.ville.titre, { ville: v.nom })), v.chemin, `<span class="regarder-compte">${e(v.bars ? accorder(v.bars, 'bar') : textes.villes.sansBar)}</span>`)}`).join('\n')}
  </ul>
</section>` : '';

  // ---------- La tête : le jour entier, dans le titre et la description ----------
  const jour = jourEnLettres(maintenant);
  const titrePage = titre(`${t.titre}, ${jour} — Baromatch`, `${t.titre}, ${jour}`);
  const villesDesBars = [...new Set([...soirees].sort(parLieu).map((s) => s.bar.ville.nom))];
  // La description : le jour, puis ce que la page montre ce soir.
  const decrire = () => {
    const debut = `${capitale(jour)} : `;
    if (avecBars.length) {
      const diffusent = `${accorder(nombreDeBars, 'bar')} ${nombreDeBars > 1 ? 'diffusent' : 'diffuse'} un match ${moment.moment} sur Baromatch`;
      return description(
        `${debut}${diffusent}, ${enumerer(villesDesBars.map((v) => `à ${v}`))}. Les adresses et l’heure du coup d’envoi, à l’heure de Paris.`,
        `${debut}${diffusent}. Les adresses et l’heure du coup d’envoi.`,
      );
    }
    const matchs = `${debut}${accorder(ceSoir.length, 'match', 'matchs')} ${moment.moment}, à l’heure de Paris.`;
    if (ceSoir.some((m) => !m.statut)) return description(`${matchs} Pas encore de bar pour ${ceSoir.length > 1 ? 'les' : 'le'} voir sur Baromatch : les prochains matchs et les villes.`);
    // Tous les matchs de ce soir sont reportés ou annulés : la page ne dit pas « pas encore de bar ».
    if (ceSoir.length) return description(`${matchs} Les prochains matchs et les bars qui les diffusent sur Baromatch.`);
    return description(`${debut}${fini ? 'les matchs de ce soir sont finis' : 'pas de match annoncé ce soir'}. Les prochains, à l’heure de Paris, et les bars qui les diffusent sur Baromatch.`);
  };
  const desc = decrire();
  const etapes = [{ nom: textes.fil.accueil, chemin: '/' }, { nom: t.fil, chemin }];
  // La liste des matchs que la page montre d’abord : ceux de ce soir, ou, sans eux, les prochains.
  const listes = ceSoir.length
    ? [listeDesMatchs(moment.matchs, ceSoir.filter(aUnePage))]
    : [listeDesMatchs(t.prochains, prochains)];

  // L’image de partage : tous les matchs de ce jour-là, finis ou pas (pas celui de la veille qui se joue encore après
  // minuit) : elle reste la même toute la journée, tant que les matchs et les bars du jour ne changent pas.
  const partage = { sorte: 'ce-soir', jour: maintenant, matchs: donnees.matchs.filter((m) => jourDeParis(m.debut) === aujourdhui).sort(parDebut) };
  const carte = lignesDeLaCarte(partage, undefined, textes);
  const image = images ? { adresse: adresseDeLImage(chemin), alt: carte.alt } : null;

  const p = {
    type: 'ce-soir', cle: 'ce-soir', date: null, chemin, indexable, titre: titrePage, description: desc, partage,
    jsonld: [pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc }), filDAriane(etapes), ...listes.filter((l) => l.numberOfItems > 0)],
    corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(t.titre)}</h1>
  <p class="regarder-quand">${e(capitale(jour))}</p>
  <p class="regarder-chapeau">${e(t.chapeau)}</p>
</header>
${sectionDuSoir}
${sectionProchains}
${sectionVilles}
${appel(marque, textes)}
${commentCaMarche(textes, marque)}`,
  };
  return { ...p, carte, contenu: page({ cadre, marque, avecPresse, ...p, image }) };
};
