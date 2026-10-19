// Toutes les pages d’un passage, en mémoire, avant toute écriture : la semaine (/matchs/), une page par match des
// 14 prochains jours (/matchs/<slug>/), les villes (/regarder-le-match/ et une page par ville), une page par vrai bar
// (/bar/<slug>/). Les pages déjà publiées restent : un match passé garde la sienne 30 jours après son coup d’envoi
// (« Ce match est passé », sans score, vers le prochain match d’un des deux clubs), un bar qui n’est plus là aussi
// (vers sa ville). Chaque page dit si elle est indexable ; les règles sont ici, et seulement ici. Chaque page dit aussi
// quels bars elle nomme (barsNommes, gardé dans l’état) : une page refusée qui nommerait un bar retiré ne reste pas.
import { DUREE_MATCH_MS, JOUR_MS } from './donnees.mjs';
import { dateCourte, heureDuJour, jourDeParis, jourEnLettres, heureDeParis } from './heure.mjs';
import { accorder, capitale, echapper as e, enumerer } from './texte.mjs';
import {
  adresseDe, cheminDeLaVille, cheminDuBar, cheminDuMatch, evenementDeLaSoiree, filDAriane, listeDesBars, pageWeb, questions, ancreDeLaSoiree,
  barOuPub,
} from './jsonld.mjs';
import { aSonFichier, blocDuMatch, clubsDeLigue1, lienVersLAgenda } from './agenda.mjs';
import { lignesDuBadge } from './badge.mjs';
import { listeDAttente } from './attente.mjs';
import { appel, carteDuBar, commentCaMarche, fil, ligneDeMatch, offre, page, quand, tuTiensUnBar, atouts } from './gabarits.mjs';
import { adresseDeLImage, lignesDeLaCarte } from './partage.mjs';

export const FENETRE_MS = 14 * JOUR_MS;
export const SEMAINE_JOURS = 7;
export const CONSERVATION_MS = 30 * JOUR_MS;
// La page d’une ville liste ses 20 prochaines soirées ; les autres matchs diffusés n’y ont qu’un lien.
const SOIREES_PAR_VILLE = 20;
// Les seuils d’indexation, contre les pages minces : en dessous, la page existe (lisible, utile au visiteur) mais
// porte noindex et reste hors du plan du site. Les bars comptés sont les vrais bars publiés (bars-publies.json).
export const SEUILS = {
  // Une page de match : au moins 2 bars qui le diffusent (un seul bar, c’est une fiche, pas une page de choix).
  barsParMatch: 2,
  // Une page de ville : avec un guide écrit (villes.json), dès son premier bar ; sans guide, à partir de 3 bars.
  barsParVilleAvecGuide: 1,
  barsParVilleSansGuide: 3,
  // Une page de bar : noindex après 60 jours sans soirée annoncée.
  joursSansSoireePourUnBar: 60,
  // La semaine (/matchs/) : indexable dès qu’il existe un vrai bar publié actif, même sans soirée cette semaine (pour
  // ne pas entrer et sortir de l’index d’une semaine à l’autre).
  barsPourLaSemaine: 1,
};

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// Un texte trop long coupé proprement : à la fin d’un mot, sans ponctuation pendante, terminé par « … ».
export const couper = (texte, max) => {
  if (texte.length <= max) return texte;
  const debut = texte.slice(0, max - 1);
  const espace = debut.lastIndexOf(' ');
  return `${(espace > max / 2 ? debut.slice(0, espace) : debut).replace(/[\s,;:.–—-]+$/u, '')}…`;
};
// Le premier texte dont la longueur va (un titre de 15 à 60 caractères, une description de 70 à 160). Si aucun ne va
// (un nom de club ou de bar très long), le dernier, coupé proprement ; trop court, il prend la suite donnée. Le
// contrôle des pages vérifie ensuite ces bornes.
const choisir = (candidats, min, max, suite) => {
  const juste = candidats.find((t) => t.length >= min && t.length <= max);
  if (juste) return juste;
  const dernier = candidats.at(-1);
  return couper(dernier.length < min ? `${dernier}${suite}` : dernier, max);
};
export const titre = (...candidats) => choisir(candidats, 15, 60, ' — Baromatch');
export const description = (...candidats) => choisir(candidats, 70, 160, ' Les bars qui diffusent le match, sur Baromatch.');

const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const quandCourt = (m) => (m.heureConfirmee ? `${jourEnLettres(m.debut)} à ${heureDeParis(m.debut)}` : `${jourEnLettres(m.debut)}, heure à confirmer`);

// « 2 bars à Paris, 1 bar à Lyon », chaque décompte un lien vers la page de sa ville.
export const barsParVille = (soirees) => {
  const villes = new Map();
  for (const s of soirees) {
    const ville = villes.get(s.bar.ville.cle) ?? { ville: s.bar.ville, n: 0 };
    ville.n += 1;
    villes.set(s.bar.ville.cle, ville);
  }
  return [...villes.values()].sort((a, b) => b.n - a.n || a.ville.nom.localeCompare(b.ville.nom, 'fr'))
    .map(({ ville, n }) => `<a href="${cheminDeLaVille(ville)}">${e(`${accorder(n, 'bar')} à ${ville.nom}`)}</a>`).join(', ');
};

// Les bars, groupés par ville puis par arrondissement (dans l’ordre des arrondissements), puis dans l’ordre
// alphabétique de leur nom, quel que soit l’ordre reçu : c’est l’ordre que « Comment on choisit les bars » annonce.
// Aucun bar ne passe devant un autre pour une autre raison.
const grouperParLieu = (recus, barDe) => {
  const elements = [...recus].sort((a, b) => barDe(a).nom.localeCompare(barDe(b).nom, 'fr'));
  const villes = new Map();
  for (const element of elements) {
    const bar = barDe(element);
    if (!villes.has(bar.ville.cle)) villes.set(bar.ville.cle, { ville: bar.ville, quartiers: new Map() });
    const quartiers = villes.get(bar.ville.cle).quartiers;
    const cle = bar.arrondissement ? bar.arrondissement.numero : 0;
    if (!quartiers.has(cle)) quartiers.set(cle, { arrondissement: bar.arrondissement, elements: [] });
    quartiers.get(cle).elements.push(element);
  }
  return [...villes.values()].sort((a, b) => a.ville.nom.localeCompare(b.ville.nom, 'fr'))
    .map(({ ville, quartiers }) => ({ ville, quartiers: [...quartiers.entries()].sort((a, b) => a[0] - b[0]).map(([, q]) => q) }));
};

// afficheDuBar : le lien de la page d’un bar vers son affiche à imprimer (affiche.mjs), quand les affiches sont écrites ;
// afficheDeLaSemaine : de même, le lien de la semaine vers l’affiche de ses matchs.
export const fabriquerLesPages = ({
  donnees, contenu, cadre, avecPresse = false, anciens = { matchs: [], bars: [] }, images = false, afficheDuBar = null, afficheDeLaSemaine = null,
}) => {
  const { maintenant } = donnees;
  const { textes, marque, villes: guides } = contenu;
  const enCoursOuAVenir = (m) => m.debut + DUREE_MATCH_MS > maintenant;
  const pages = [];
  const commun = { cadre, marque, avecPresse };
  // Une page qui se partage (partage : un match, une ville ou un bar) : ce que dit son image (carte), et l’image en
  // aperçu quand le rendu des images est là (images).
  const ajouter = (p) => {
    const carte = p.partage ? lignesDeLaCarte(p.partage, undefined, textes) : null;
    const image = carte && images ? { adresse: adresseDeLImage(p.chemin), alt: carte.alt } : null;
    pages.push({ ...p, carte, contenu: page({ ...commun, ...p, image }) });
  };
  const accueil = { nom: textes.fil.accueil, chemin: '/' };
  const semaine = { nom: textes.fil.matchs, chemin: '/matchs/' };
  const lesVilles = { nom: textes.fil.villes, chemin: '/regarder-le-match/' };
  // « Les places qui restent sont dans l’appli » : seulement quand l’appli est ouverte (sinon, aucune place promise).
  const places = marque.appli?.ouverte ? `  <p class="regarder-note">${e(textes.places)}</p>\n` : '';

  // ---------- Quels matchs ont une page ----------
  const anciensParSlug = new Map(anciens.matchs.map((m) => [m.slug, m]));
  const avecPage = donnees.matchs.filter((m) => (enCoursOuAVenir(m) && m.debut <= maintenant + FENETRE_MS)
    || (anciensParSlug.has(m.slug) && m.debut + CONSERVATION_MS > maintenant));
  const slugsAvecPage = new Set(avecPage.map((m) => m.slug));
  // Les pages d’avant dont le match n’est plus dans les données : passées, ou plus au programme.
  const disparus = anciens.matchs.filter((m) => !slugsAvecPage.has(m.slug) && m.debut + CONSERVATION_MS > maintenant);
  for (const m of disparus) slugsAvecPage.add(m.slug);
  const aUnePage = (m) => slugsAvecPage.has(m.slug);
  // Les clubs qui ont leur agenda (agenda.mjs) : la page d’un match y mène.
  const clubsSuivis = new Set(clubsDeLigue1(donnees.matchs).map((c) => c.cle));
  const prochainsDe = (match) => donnees.matchs
    .filter((m) => m.slug !== match.slug && m.debut > Math.max(match.debut, maintenant - DUREE_MATCH_MS)
      && [m.domicile.cle, m.exterieur.cle].some((cle) => cle === match.domicile.cle || cle === match.exterieur.cle))
    .sort((a, b) => a.debut - b.debut);

  // ---------- Les pages des matchs ----------
  for (const match of [...avecPage, ...disparus]) {
    const chemin = cheminDuMatch(match);
    const nom = nomCourt(match);
    const etapes = [accueil, semaine, { nom, chemin }];
    const vivant = donnees.matchs.includes(match);
    const passe = !enCoursOuAVenir(match);
    const soirees = vivant ? match.soirees.filter(() => !passe) : [];
    const indexable = vivant && !passe && soirees.length >= SEUILS.barsParMatch;
    const prochains = prochainsDe(match).filter((m) => enCoursOuAVenir(m));
    const memoire = { slug: match.slug, ids: match.ids, debut: new Date(match.debut).toISOString(), heureConfirmee: match.heureConfirmee, competition: match.competition, domicile: match.domicile, exterieur: match.exterieur };
    // « Ajouter à mon agenda » : un match à venir, ni reporté ni annulé ; son fichier s’écrit à côté de la page.
    const evenement = vivant && aSonFichier(match, maintenant);
    const enTete = `<header class="regarder-tete">
  <p class="regarder-surtitre">${e(match.competition)}</p>
  <h1 class="regarder-titre">${e(nom)}${passe ? '' : ' : les bars qui diffusent le match'}</h1>
  <p class="regarder-affiche">${e(match.domicile.nom)} – ${e(match.exterieur.nom)}</p>
  <p class="regarder-quand">${quand(match)}</p>
${match.heureConfirmee || passe ? '' : `  <p class="regarder-note">${e(textes.match.heureAConfirmer)}</p>\n`}${match.statut ? `  <p class="regarder-note"><strong>${e(textes.match[match.statut])}.</strong> ${e(textes.match.statutSuite)}</p>\n` : ''}  ${blocDuMatch(match, { clubsSuivis, fichier: evenement })}
</header>`;

    if (passe || !vivant) {
      // Le match est passé (ou n’est plus au programme) : la page le dit, sans score, et renvoie vers la suite.
      const suivant = prochains[0];
      const deplace = !passe && donnees.matchs.find((m) => m.ids.some((id) => match.ids.includes(id)) && aUnePage(m));
      const suite = deplace
        ? `<p><a href="${cheminDuMatch(deplace)}">${e(nomCourt(deplace))}</a>, ${quand(deplace)}.</p>`
        : suivant
          ? `<p>${e(remplir(textes.match.passeSuite, { club: [suivant.domicile.cle, suivant.exterieur.cle].includes(match.domicile.cle) ? match.domicile.court : match.exterieur.court }))} ${aUnePage(suivant) ? `<a href="${cheminDuMatch(suivant)}">${e(nomCourt(suivant))}</a>` : e(nomCourt(suivant))}, ${quand(suivant)}.</p>${aUnePage(suivant) ? '' : `\n  <p><a href="/matchs/">${e(textes.fil.matchs)}</a></p>`}`
          : `<p>${e(textes.match.passeSansSuite)} <a href="/matchs/">${e(textes.fil.matchs)}</a></p>`;
      const titrePage = titre(`${nom} du ${dateCourte(match.debut)} : match passé — Baromatch`, `${nom} du ${dateCourte(match.debut)} : match passé`, `${nom} : match passé`);
      const desc = description(
        `${nom} (${match.competition}), ${quandCourt(match)}. ${passe ? textes.match.passe : textes.match.plusAnnonce} : le prochain match des deux clubs et les bars qui le diffusent.`,
        `${nom}, ${quandCourt(match)}. ${passe ? textes.match.passe : textes.match.plusAnnonce} : les matchs à venir et les bars qui les diffusent.`,
      );
      ajouter({
        type: 'match', cle: match.slug, date: memoire.debut, memoire, chemin, indexable: false, titre: titrePage, description: desc,
        jsonld: [pageWeb({ chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
        corps: `${fil(etapes)}
${enTete}
<section class="regarder-section regarder-passe" aria-labelledby="titre-passe">
  <h2 id="titre-passe">${e(passe ? textes.match.passe : textes.match.plusAnnonce)}</h2>
  ${suite}
</section>`,
      });
      continue;
    }

    const groupes = grouperParLieu(soirees, (s) => s.bar);
    const villesDuMatch = groupes.map((g) => g.ville.nom);
    const titrePage = titre(`${nom}, ${dateCourte(match.debut)} : les bars qui diffusent le match — Baromatch`, `${nom}, ${dateCourte(match.debut)} : les bars qui diffusent le match`,
      `${nom}, ${dateCourte(match.debut)} : où voir le match`, `${nom} : où voir le match`);
    const desc = soirees.length
      ? description(
        `${nom} (${match.competition}), ${quandCourt(match)}. ${accorder(soirees.length, 'bar')} le ${soirees.length > 1 ? 'diffusent' : 'diffuse'} sur Baromatch, à ${enumerer(villesDuMatch)} : les adresses et l’heure.`,
        `${nom}, ${quandCourt(match)}. ${accorder(soirees.length, 'bar')} le ${soirees.length > 1 ? 'diffusent' : 'diffuse'} sur Baromatch : les adresses et l’heure.`,
      )
      : description(
        `${nom} (${match.competition}), ${quandCourt(match)}. Aucun bar ne le diffuse encore sur Baromatch : les prochains matchs des deux clubs.`,
        `${nom}, ${quandCourt(match)}. Aucun bar ne le diffuse encore sur Baromatch : les prochains matchs des deux clubs.`,
      );
    const listeDesSoirees = groupes.map(({ ville, quartiers }) => `  <h3 class="regarder-ville"><a href="${cheminDeLaVille(ville)}">${e(ville.nom)}</a></h3>
${quartiers.map(({ arrondissement, elements }) => `${arrondissement ? `  <h4 class="regarder-quartier">${e(arrondissement.libelle)}</h4>\n` : ''}  <ul class="regarder-cartes">
    ${elements.map((s) => carteDuBar(s.bar, textes, { soiree: s, niveau: arrondissement ? 5 : 4 })).join('\n    ')}
  </ul>`).join('\n')}`).join('\n');
    const sectionBars = soirees.length
      ? `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(textes.match.titreBars)}</h2>
  <p class="regarder-compte">${barsParVille(soirees)}</p>
${listeDesSoirees}
${places}  ${appel(marque, textes)}
</section>`
      : `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(textes.match.titreBars)}</h2>
  <p class="regarder-vide">${e(textes.match.sansBar)}.</p>
  ${tuTiensUnBar(textes)}
  ${appel(marque, textes)}
</section>`;
    const clubs = `${match.domicile.court} et ${match.exterieur.court}`;
    const sectionProchains = `<section class="regarder-section" aria-labelledby="titre-prochains">
  <h2 id="titre-prochains">${e(remplir(textes.match.prochains, { clubs }))}</h2>
${prochains.length ? `  <ul class="regarder-matchs">
${prochains.slice(0, 6).map((m) => `    ${ligneDeMatch(m, { avecPage: aUnePage(m) })}`).join('\n')}
  </ul>` : `  <p>${e(textes.match.aucunProchain)}</p>`}
</section>`;
    ajouter({
      // Reporté ou annulé : la page reste lisible (pas de noindex forcé si des bars l’annonçaient), hors du plan du site.
      type: 'match', cle: match.slug, date: memoire.debut, memoire, chemin, indexable, horsPlan: Boolean(match.statut), titre: titrePage, description: desc,
      barsNommes: soirees.map((s) => s.bar.id), evenement: evenement ? match : null,
      partage: { sorte: 'match', match, soirees },
      jsonld: [pageWeb({ chemin, titre: titrePage, description: desc }), filDAriane(etapes), ...soirees.map((s) => evenementDeLaSoiree(s, contenu))],
      corps: `${fil(etapes)}
${enTete}
${sectionBars}
${sectionProchains}
${commentCaMarche(textes, marque)}`,
    });
  }

  // ---------- La semaine ----------
  {
    const chemin = '/matchs/';
    const aujourdhui = jourDeParis(maintenant);
    // Les sept jours de Paris à partir d’aujourd’hui, comptés sur les dates (un jour de changement d’heure dure 23 ou
    // 25 heures : ajouter 24 heures à un instant sauterait ou répéterait un jour).
    const midi = Date.parse(`${aujourdhui}T12:00:00Z`);
    const jours = Array.from({ length: SEMAINE_JOURS }, (_, i) => new Date(midi + i * JOUR_MS).toISOString().slice(0, 10));
    const dansLaSemaine = donnees.matchs.filter((m) => enCoursOuAVenir(m) && jours.includes(jourDeParis(m.debut))).sort((a, b) => a.debut - b.debut);
    const indexable = donnees.bars.length >= SEUILS.barsPourLaSemaine;
    // Chaque liste est sous le titre de son jour : la ligne ne donne que l’heure.
    const ligne = (m) => `    ${ligneDeMatch(m, { avecPage: aUnePage(m), heureSeule: true, suite: ` · <span class="regarder-compte">${m.soirees.length ? barsParVille(m.soirees) : e(textes.semaine.pasDeBar)}</span>` })}`;
    const ceSoir = dansLaSemaine.filter((m) => jourDeParis(m.debut) === aujourdhui);
    // Le premier bloc : « Aujourd’hui, vendredi 23 octobre » avant 17 h, « Ce soir, … » ensuite ; quand tous les matchs
    // du jour ont commencé depuis plus de trois heures, « Fini pour ce soir », et la suite commence au lendemain.
    const fini = ceSoir.length === 0 && donnees.matchs.some((m) => jourDeParis(m.debut) === aujourdhui && !m.statut);
    const leSoir = heureDuJour(maintenant) >= 17;
    const titreDuJour = fini ? textes.semaine.fini : remplir(leSoir ? textes.semaine.ceSoir : textes.semaine.aujourdhui, { jour: jourEnLettres(maintenant) });
    const rienDuJour = fini ? textes.semaine.finiSuite : leSoir ? textes.semaine.rienCeSoir : textes.semaine.rienAujourdhui;
    const autres = jours.slice(1).map((jour) => ({ jour, matchs: dansLaSemaine.filter((m) => jourDeParis(m.debut) === jour) })).filter((j) => j.matchs.length);
    const dernierJour = jourEnLettres(Date.parse(`${jours.at(-1)}T12:00:00Z`));
    // Les matchs qui ont déjà leur page, après ces sept jours (la fenêtre des pages est de 14 jours) : la semaine d’après,
    // une ligne chacun, pour qu’aucune page de match ne reste sans lien depuis la semaine.
    const ensuite = donnees.matchs.filter((m) => enCoursOuAVenir(m) && aUnePage(m) && !dansLaSemaine.includes(m) && jourDeParis(m.debut) > jours.at(-1))
      .sort((a, b) => a.debut - b.debut);
    const etapes = [accueil, { nom: textes.fil.matchs, chemin }];
    const titrePage = textes.semaine.titrePage;
    const desc = description(
      `${dansLaSemaine.length ? accorder(dansLaSemaine.length, 'match', 'matchs') : 'Aucun match'} d’ici ${dernierJour}, à l’heure de Paris : la compétition et les bars qui diffusent chaque match sur Baromatch.`,
      `${dansLaSemaine.length ? accorder(dansLaSemaine.length, 'match', 'matchs') : 'Aucun match'} cette semaine, à l’heure de Paris, et les bars qui les diffusent sur Baromatch.`,
    );
    ajouter({
      type: 'semaine', cle: 'semaine', date: null, chemin, indexable, titre: titrePage, description: desc,
      jsonld: [pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(textes.semaine.titre)}</h1>
  <p class="regarder-chapeau">${e(textes.semaine.chapeau)}</p>
</header>
<section class="regarder-section regarder-ce-soir" aria-labelledby="titre-ce-soir">
  <h2 id="titre-ce-soir">${e(titreDuJour)}</h2>
${ceSoir.length ? `  <ul class="regarder-matchs">\n${ceSoir.map(ligne).join('\n')}\n  </ul>` : `  <p>${e(rienDuJour)}</p>`}
  <p class="regarder-suite"><a href="/ce-soir/">${e(textes.ceSoir.lien)}</a></p>
</section>
${autres.length ? autres.map(({ jour, matchs }) => `<section class="regarder-section" aria-labelledby="jour-${jour}">
  <h2 id="jour-${jour}">${e(capitale(jourEnLettres(Date.parse(`${jour}T12:00:00Z`))))}</h2>
  <ul class="regarder-matchs">
${matchs.map(ligne).join('\n')}
  </ul>
</section>`).join('\n') : `<p>${e(textes.semaine.rienCetteSemaine)}</p>`}
${ensuite.length ? `<section class="regarder-section" aria-labelledby="titre-ensuite">
  <h2 id="titre-ensuite">${e(textes.semaine.ensuite)}</h2>
  <ul class="regarder-matchs">
${ensuite.map((m) => `    ${ligneDeMatch(m, { avecPage: true, suite: ` · <span class="regarder-compte">${m.soirees.length ? barsParVille(m.soirees) : e(textes.semaine.pasDeBar)}</span>` })}`).join('\n')}
  </ul>
</section>\n` : ''}${afficheDeLaSemaine ? `${afficheDeLaSemaine()}\n` : ''}<p class="regarder-retour"><a href="/regarder-le-match/">${e(textes.semaine.toutesLesVilles)}</a></p>
${appel(marque, textes)}
${commentCaMarche(textes, marque)}`,
    });
  }

  // ---------- Les villes ----------
  const villes = new Map();
  for (const [cle, guide] of Object.entries(guides)) if (!cle.startsWith('_')) villes.set(cle, { cle, nom: guide.nom, guide });
  for (const bar of [...donnees.bars].sort((a, b) => a.ville.nom.localeCompare(b.ville.nom, 'fr'))) {
    if (!villes.has(bar.ville.cle)) villes.set(bar.ville.cle, { cle: bar.ville.cle, nom: bar.ville.nom, guide: null });
  }
  const avertissements = [];
  // La liste d’attente d’une ville (attente.mjs) : les villes où Baromatch a déjà un bar.
  const clesAvecBars = new Set(donnees.bars.map((b) => b.ville.cle));
  for (const ville of villes.values()) {
    ville.bars = donnees.bars.filter((b) => b.ville.cle === ville.cle).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    ville.soirees = ville.bars.flatMap((b) => b.soirees).filter((s) => enCoursOuAVenir(s.match)).sort((a, b) => a.match.debut - b.match.debut || a.bar.nom.localeCompare(b.bar.nom, 'fr'));
    ville.indexable = ville.bars.length >= (ville.guide ? SEUILS.barsParVilleAvecGuide : SEUILS.barsParVilleSansGuide);
    ville.quartiers = [...new Set(ville.bars.map((b) => b.quartier))];
    if (!ville.guide) avertissements.push(`Ville sans guide : ${ville.nom} (${accorder(ville.bars.length, 'bar')}). Son guide s’écrit dans generateur/contenu/villes.json.`);
  }

  for (const ville of villes.values()) {
    const chemin = cheminDeLaVille(ville);
    const etapes = [accueil, lesVilles, { nom: ville.nom, chemin }];
    const nomVille = ville.nom;
    const titrePage = titre(`Bars foot à ${nomVille} : où regarder le match — Baromatch`, `Bars foot à ${nomVille} : où regarder le match`, `Où regarder le match à ${nomVille}`);
    const quartiers = ville.quartiers.filter((q) => q !== nomVille);
    const resume = ville.bars.length
      ? `${accorder(ville.bars.length, 'bar')} de ${nomVille} ${ville.bars.length > 1 ? 'diffusent' : 'diffuse'} le match sur Baromatch${quartiers.length ? ` (${enumerer(quartiers)})` : ''}.`
      : '';
    const desc = ville.bars.length
      ? description(
        `${resume} ${ville.guide ? 'Les prochaines soirées, les adresses et le guide des soirs de match.' : 'Les prochaines soirées et les adresses.'}`,
        `${accorder(ville.bars.length, 'bar')} de ${nomVille} ${ville.bars.length > 1 ? 'diffusent' : 'diffuse'} le match sur Baromatch : les prochaines soirées et les adresses.`,
      )
      : description(ville.guide.accroche, `Où regarder le match à ${nomVille} : le guide des soirs de match, et les bars de la ville dès qu’ils sont sur Baromatch.`);
    const groupes = grouperParLieu(ville.bars, (b) => b);
    const sectionBars = ville.bars.length
      ? `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(remplir(textes.ville.titreBars, { ville: nomVille }))}</h2>
${groupes.flatMap((g) => g.quartiers).map(({ arrondissement, elements }) => `${arrondissement ? `  <h3 class="regarder-quartier" id="${arrondissement.ancre}">${e(arrondissement.libelle)}</h3>\n` : ''}  <ul class="regarder-cartes">
    ${elements.map((b) => carteDuBar(b, textes, { niveau: arrondissement ? 4 : 3 })).join('\n    ')}
  </ul>`).join('\n')}
</section>`
      : `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(remplir(textes.ville.titreBars, { ville: nomVille }))}</h2>
  <p class="regarder-vide">${e(remplir(textes.ville.sansBar, { ville: nomVille }))}</p>
  ${tuTiensUnBar(textes)}
</section>`;
    // Au-delà des premières soirées, les autres matchs qui ont leur page, une fois chacun : la ville mène à chacun.
    const listes = new Set(ville.soirees.slice(0, SOIREES_PAR_VILLE).map((s) => s.match.slug));
    const autresMatchs = [...new Map(ville.soirees.filter((s) => !listes.has(s.match.slug) && aUnePage(s.match)).map((s) => [s.match.slug, s.match])).values()];
    const sectionSoirees = `<section class="regarder-section" aria-labelledby="titre-soirees">
  <h2 id="titre-soirees">${e(remplir(textes.ville.titreSoirees, { ville: nomVille }))}</h2>
${ville.soirees.length ? `  <ul class="regarder-matchs">
${ville.soirees.slice(0, SOIREES_PAR_VILLE).map((s) => `    <li>${aUnePage(s.match) ? `<a href="${cheminDuMatch(s.match)}">${e(nomCourt(s.match))}</a>` : e(nomCourt(s.match))} · ${quand(s.match)} · <a href="${cheminDuBar(s.bar)}#${ancreDeLaSoiree(s.match)}">${e(s.bar.nom)}</a>, ${e(s.bar.quartier)}</li>`).join('\n')}
  </ul>` : `  <p>${e(textes.ville.sansSoiree)}</p>`}
${autresMatchs.length ? `  <h3 class="regarder-jour">${e(remplir(textes.ville.aussi, { ville: nomVille }))}</h3>
  <ul class="regarder-matchs">
${autresMatchs.map((m) => `    ${ligneDeMatch(m, { avecPage: true })}`).join('\n')}
  </ul>\n` : ''}  <p class="regarder-suite"><a href="/ce-soir/">${e(textes.ceSoir.lien)}</a></p>
  ${lienVersLAgenda()}
</section>`;
    // Une ville sans guide écrit : un paragraphe fait de ses vraies données (bars, quartiers, prochaines soirées).
    const prochaineSoiree = ville.soirees[0];
    const sectionGuide = ville.guide
      ? `<section class="regarder-section regarder-guide" aria-labelledby="titre-guide">
  <h2 id="titre-guide">${e(ville.guide.titreGuide)}</h2>
${ville.guide.guide.map((paragraphe) => `  <p>${e(paragraphe)}</p>`).join('\n')}
</section>`
      : `<section class="regarder-section regarder-guide" aria-labelledby="titre-guide">
  <h2 id="titre-guide">${e(remplir(textes.ville.titreSansGuide, { ville: nomVille }))}</h2>
  <p>${e(resume)} ${ville.soirees.length ? e(`${accorder(ville.soirees.length, 'soirée annoncée', 'soirées annoncées')}, la prochaine ${quandCourt(prochaineSoiree.match)} : ${nomCourt(prochaineSoiree.match)}, ${prochaineSoiree.bar.nom}.`) : e(textes.ville.sansSoiree)}</p>
</section>`;
    // La FAQ commence par une question vraie, faite des données : Baromatch est-il dans cette ville, et l’appli.
    const estIci = {
      question: remplir(textes.ville.estIci, { ville: nomVille }),
      reponse: `${ville.bars.length ? remplir(ville.bars.length > 1 ? textes.ville.estIciOuiPluriel : textes.ville.estIciOui, { bars: accorder(ville.bars.length, 'bar'), ville: nomVille }) : remplir(textes.ville.estIciNon, { ville: nomVille })} ${marque.appli?.ouverte ? textes.ville.appliOuverte : textes.ville.appliFermee}`,
    };
    const faq = [estIci, ...(ville.guide?.faq ?? [])];
    const sectionFaq = faq.length
      ? `<section class="regarder-section regarder-faq" aria-labelledby="titre-faq">
  <h2 id="titre-faq">${e(textes.ville.titreFaq)}</h2>
${faq.map(({ question, reponse }) => `  <details>
    <summary>${e(question)}</summary>
    <p>${e(reponse)}</p>
  </details>`).join('\n')}
</section>`
      : '';
    const principal = faq.length
      ? pageWeb({ type: 'FAQPage', chemin, titre: titrePage, description: desc, mainEntity: questions(faq) })
      : pageWeb({ chemin, titre: titrePage, description: desc });
    ajouter({
      type: 'ville', cle: ville.cle, date: null, chemin, indexable: ville.indexable, titre: titrePage, description: desc,
      barsNommes: ville.bars.map((b) => b.id),
      partage: { sorte: 'ville', ville },
      memoire: { nom: ville.nom },
      jsonld: [principal, filDAriane(etapes), ...(ville.bars.length ? [listeDesBars(remplir(textes.ville.titreBars, { ville: nomVille }), ville.bars)] : [])],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(remplir(textes.ville.titre, { ville: nomVille }))}</h1>
  <p class="regarder-chapeau">${e(ville.guide ? ville.guide.accroche : resume)}</p>
</header>
${sectionBars}
${sectionSoirees}
${sectionGuide}
${!marque.appli?.ouverte || !ville.bars.length ? listeDAttente({ cle: ville.cle, nom: nomVille, textes, clesAvecBars, ouverte: marque.appli?.ouverte }) : appel(marque, textes)}
${commentCaMarche(textes, marque)}
${sectionFaq}
<p class="regarder-retour"><a href="/regarder-le-match/">${e(textes.ville.toutesLesVilles)}</a></p>`,
    });
  }

  // ---------- L’index des villes ----------
  {
    const chemin = '/regarder-le-match/';
    const etapes = [accueil, { nom: textes.fil.villes, chemin }];
    const liste = [...villes.values()];
    const indexable = liste.some((v) => v.indexable);
    const titrePage = `${textes.villes.titre} — Baromatch`;
    const noms = liste.map((v) => v.nom);
    const desc = description(
      `${enumerer(noms)} : les bars qui diffusent le match sur Baromatch, ville par ville, et le guide des soirs de match.`,
      `${enumerer(noms.slice(0, 4))} et d’autres villes : les bars qui diffusent le match sur Baromatch, ville par ville.`,
    );
    ajouter({
      type: 'villes', cle: 'villes', date: null, chemin, indexable, titre: titrePage, description: desc,
      jsonld: [pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(textes.villes.titre)}</h1>
  <p class="regarder-chapeau">${e(textes.villes.chapeau)}</p>
</header>
<section class="regarder-section" aria-labelledby="titre-villes">
  <h2 id="titre-villes" class="visuellement-cache">Les villes</h2>
  <ul class="regarder-cartes">
${liste.map((v) => `    <li class="regarder-carte">
      <h3 class="regarder-carte__nom"><a href="${cheminDeLaVille(v)}">${e(v.nom)}</a></h3>
      <p class="regarder-carte__lieu">${v.bars.length ? e(accorder(v.bars.length, 'bar')) : e(textes.villes.sansBar)}</p>
      ${v.guide ? `<p>${e(v.guide.accroche)}</p>` : ''}
    </li>`).join('\n')}
  </ul>
</section>
<p class="regarder-retour"><a href="/matchs/">${e(textes.villes.voirLaSemaine)}</a></p>
${appel(marque, textes)}
${commentCaMarche(textes, marque)}`,
    });
  }

  // ---------- Les bars ----------
  // Un bar qui sort (retiré de la liste des bars publiés, exclu, ou disparu des données) : sa page reste 30 jours, en
  // noindex, sans son nom, son adresse ni sa position (« Ce bar n’est plus sur Baromatch. », vers sa ville), puis
  // disparaît. L’état ne garde de lui que son identifiant, sa ville et la date de sa sortie.
  const reels = new Set(donnees.bars.map((b) => b.slug));
  const anciensBars = new Map(anciens.bars.map((b) => [b.slug, b]));
  const partis = anciens.bars.filter((b) => !reels.has(b.slug) && b.ville?.cle
    && Date.parse(b.disparu ?? new Date(maintenant).toISOString()) + CONSERVATION_MS > maintenant);
  for (const bar of donnees.bars) {
    const chemin = cheminDuBar(bar);
    const etapes = [accueil, lesVilles, { nom: bar.ville.nom, chemin: cheminDeLaVille(bar.ville) }, { nom: bar.nom, chemin }];
    const soirees = bar.soirees.filter((s) => enCoursOuAVenir(s.match));
    const prochaine = soirees[0];
    // Sa dernière soirée annoncée (ou, sans aucune, le jour où il est arrivé) : 60 jours sans soirée, et sa page sort
    // de l’index.
    const reperes = [...bar.soirees.map((s) => s.match.debut), Date.parse(anciensBars.get(bar.slug)?.derniereSoiree ?? '')].filter(Number.isFinite);
    const derniereSoiree = reperes.length ? Math.max(...reperes) : maintenant;
    const indexable = derniereSoiree + SEUILS.joursSansSoireePourUnBar * JOUR_MS > maintenant;
    const titrePage = titre(`${bar.nom}, ${bar.quartier} : les matchs diffusés — Baromatch`, `${bar.nom}, ${bar.quartier} — Baromatch`, `${bar.nom} : les matchs diffusés`, `${bar.nom} — Baromatch`, bar.nom.slice(0, 60));
    const desc = prochaine
      ? description(
        `${bar.nom}, ${bar.adresse}. ${accorder(soirees.length, 'soirée de match annoncée', 'soirées de match annoncées')} sur Baromatch, la prochaine : ${nomCourt(prochaine.match)}, ${quandCourt(prochaine.match)}.`,
        `${bar.nom}, ${bar.quartier}. ${accorder(soirees.length, 'soirée de match annoncée', 'soirées de match annoncées')} sur Baromatch, la prochaine : ${nomCourt(prochaine.match)}.`,
        `${bar.nom.slice(0, 80)}, ${bar.quartier} : les soirées de match annoncées sur Baromatch, avec l’heure de Paris.`,
      )
      : description(
        `${bar.nom}, ${bar.adresse} : un bar qui diffuse le match, sur Baromatch. ${textes.bar.sansSoiree}`,
        `${bar.nom.slice(0, 80)}, ${bar.quartier} : un bar qui diffuse le match, sur Baromatch. ${textes.bar.sansSoiree}`,
      );
    const listeSoirees = soirees.length
      ? `  <ul class="regarder-cartes">
${soirees.map((s) => `    <li class="regarder-carte" id="${ancreDeLaSoiree(s.match)}">
      <h3 class="regarder-carte__nom">${aUnePage(s.match) ? `<a href="${cheminDuMatch(s.match)}">${e(nomCourt(s.match))}</a>` : e(nomCourt(s.match))}</h3>
      <p class="regarder-carte__lieu">${quand(s.match)} · ${e(s.match.competition)}</p>
      ${offre(s.offre, textes)}
    </li>`).join('\n')}
  </ul>
${places.trimEnd()}`
      : `  <p>${e(textes.bar.sansSoiree)}</p>`;
    const ce = atouts(bar, textes);
    const { apercu } = lignesDuBadge({ bar, soiree: prochaine ?? null, maintenant, marque, textes });
    ajouter({
      type: 'bar', cle: bar.slug, date: null, chemin, indexable, titre: titrePage, description: desc, bar, soirees, barsNommes: [bar.id],
      partage: { sorte: 'bar', bar, prochaine },
      memoire: { id: bar.id, ville: bar.ville, derniereSoiree: new Date(derniereSoiree).toISOString() },
      jsonld: [
        pageWeb({ chemin, titre: titrePage, description: desc, about: { '@id': `${adresseDe(chemin)}#bar` } }),
        barOuPub(bar),
        filDAriane(etapes),
        ...soirees.map((s) => evenementDeLaSoiree(s, contenu)),
      ],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <p class="regarder-surtitre">${e(bar.quartier)}</p>
  <h1 class="regarder-titre">${e(bar.nom)}</h1>
  <p class="regarder-affiche">${e(bar.adresse)}</p>
</header>
${ce ? `<section class="regarder-section" aria-labelledby="titre-atouts">
  <h2 id="titre-atouts">${e(textes.bar.titreAtouts)}</h2>
  ${ce}
</section>\n` : ''}<section class="regarder-section" aria-labelledby="titre-soirees">
  <h2 id="titre-soirees">${e(textes.bar.titreSoirees)}</h2>
${listeSoirees}
  ${appel(marque, textes)}
</section>
${codeDuBadge(bar, textes, apercu)}${afficheDuBar ? `\n${afficheDuBar(bar)}` : ''}`,
    });
  }
  for (const bar of partis) {
    const chemin = `/bar/${bar.slug}/`;
    const ville = { cle: bar.ville.cle, nom: bar.ville.nom };
    const etapes = [accueil, lesVilles, { nom: ville.nom, chemin: cheminDeLaVille(ville) }, { nom: textes.bar.partiFil, chemin }];
    const titrePage = textes.bar.parti.replace(/\.$/, '');
    const desc = description(`${textes.bar.parti} ${remplir(textes.bar.partiSuite, { ville: ville.nom })}`, `${textes.bar.parti} Les bars qui diffusent le match sont sur la page de leur ville, sur Baromatch.`);
    ajouter({
      type: 'bar', cle: bar.slug, date: null, chemin, indexable: false, titre: titrePage, description: desc, parti: true, bar: null,
      memoire: { id: bar.id, ville, disparu: bar.disparu ?? new Date(maintenant).toISOString() },
      jsonld: [pageWeb({ chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(textes.bar.parti)}</h1>
</header>
<section class="regarder-section regarder-passe" aria-labelledby="titre-parti">
  <h2 id="titre-parti">${e(remplir(textes.ville.titre, { ville: ville.nom }))}</h2>
  <p>${e(remplir(textes.bar.partiSuite, { ville: ville.nom }))} <a href="${cheminDeLaVille(ville)}">${e(remplir(textes.ville.titre, { ville: ville.nom }))}</a></p>
</section>`,
    });
  }

  return { pages, avertissements };
};

// Le code à coller pour le badge du bar : une image qui pointe vers sa page, sans aucun paramètre de suivi ; le texte
// de remplacement et le lien portent le nom du bar. L’aperçu, sur la page, dit ce que le badge affiche aujourd’hui.
export const codeDuBadge = (bar, textes, apercu) => {
  const adresse = adresseDe(cheminDuBar(bar));
  const nom = `${bar.nom} sur Baromatch`;
  const code = `<a href="${adresse}" title="${e(nom)}"><img src="${adresse}badge.svg" width="360" height="72" alt="${e(nom)}"></a>`;
  return `<details class="regarder-badge">
  <summary>${e(textes.bar.badgeTitre)}</summary>
  <p>${e(textes.bar.badgeTexte)}</p>
  <img class="regarder-badge__image" src="${cheminDuBar(bar)}badge.svg" width="360" height="72" alt="${e(apercu)}">
  <label class="regarder-badge__etiquette" for="code-badge">${e(textes.bar.badgeCode)}</label>
  <textarea class="regarder-badge__code" id="code-badge" readonly rows="4">${e(code)}</textarea>
</details>`;
};
