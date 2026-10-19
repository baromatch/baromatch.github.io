// Les affiches à imprimer : un seul moteur (la feuille, ses lignes de matchs, son pied et son QR code, affiche.css),
// deux entrées.
// - L’affiche de la semaine (/matchs/affiche/), ouverte à tous les bars, même ceux qui ne sont pas sur Baromatch : les
//   matchs des sept jours de /matchs/ (mêmes jours, heure de Paris), sans les matchs reportés ou annulés. Le patron
//   coche ceux qu’il diffuse et imprime : seules les lignes cochées s’impriment, ou toutes si rien n’est coché. Tout
//   se fait en HTML et en CSS (:has() et @media print), sans script ni formulaire, sans aucun champ de texte : rien
//   n’est envoyé, rien n’est gardé, et rien ne peut y parler d’alcool. En pied : « Programme préparé sur
//   baromatch.fr » et un QR code vers l’accueil, sans paramètre de suivi.
// - L’affiche d’un bar publié (/bar/<bar>/affiche/) : « on diffuse le match », sa prochaine soirée annoncée, ses autres
//   soirées des sept jours, et un QR code vers sa page. Jamais pour un bar qui n’est pas publié : sa page disparaît
//   avec lui (aucune affiche n’est écrite, l’état l’efface). Aucune offre : rien sur l’alcool.
// À l’impression : papier blanc, encre noire, une seule touche d’ambre (le verre de la marque) ; A4 ou A3 au choix, sans
// fixer la taille du papier (@page size bloquerait le choix dans la fenêtre d’impression).
// Les QR codes sont dessinés au passage du générateur (qr.mjs) : sans l’encodeur, aucune affiche n’est écrite.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { DUREE_MATCH_MS, JOUR_MS } from './donnees.mjs';
import { fil, page } from './gabarits.mjs';
import { heureDeParis, heureDuJour, jourDeParis, jourEnLettres } from './heure.mjs';
import { adresseDe, cheminDeLaVille, cheminDuBar, debutDe, filDAriane, pageWeb } from './jsonld.mjs';
import { description as decrire, SEMAINE_JOURS, titre as intituler } from './pages.mjs';
import { svgDuQr } from './qr.mjs';
import { capitale, echapper as e } from './texte.mjs';

export const CHEMIN_DE_L_AFFICHE = '/matchs/affiche/';
export const cheminDeLAfficheDuBar = (bar) => `${cheminDuBar(bar)}affiche/`;
// Ce que tient une feuille (A4 comme A3, l’A3 en plus grand) ; au-delà, l’affiche passe sur deux pages.
export const LIGNES_PAR_FEUILLE = 14;
export const TEXTES_DES_AFFICHES = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'affiche.json'), 'utf8'));
// L’adresse du QR code de l’affiche ouverte : l’accueil, telle quelle (aucun paramètre de suivi).
export const ADRESSE_DU_QR = adresseDe('/');
export const FEUILLE_DE_STYLE = '/affiche.css';

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const midiDe = (jour) => Date.parse(`${jour}T12:00:00Z`);

// Les sept jours de Paris à partir de celui du passage, comptés sur les dates (comme /matchs/, pages.mjs).
export const joursDeLaSemaine = (maintenant) => {
  const midi = midiDe(jourDeParis(maintenant));
  return Array.from({ length: SEMAINE_JOURS }, (_, i) => new Date(midi + i * JOUR_MS).toISOString().slice(0, 10));
};

// Les matchs de l’affiche : ceux de /matchs/ (en cours ou à venir, dans les sept jours), sans les reportés ni les
// annulés, dans l’ordre des coups d’envoi (le même que /matchs/).
export const matchsDeLAffiche = (donnees) => {
  const jours = joursDeLaSemaine(donnees.maintenant);
  return donnees.matchs
    .filter((m) => m.debut + DUREE_MATCH_MS > donnees.maintenant && jours.includes(jourDeParis(m.debut)) && !m.statut)
    .sort((a, b) => a.debut - b.debut);
};

// « Du vendredi 23 au jeudi 29 octobre », « Du vendredi 30 octobre au jeudi 5 novembre ».
const lesDates = (jours) => {
  const [debut, fin] = [jours[0], jours.at(-1)].map((j) => jourEnLettres(midiDe(j)));
  const memeMois = jours[0].slice(0, 7) === jours.at(-1).slice(0, 7);
  return remplir(TEXTES_DES_AFFICHES.feuille.dates, { debut: memeMois ? debut.split(' ').slice(0, 2).join(' ') : debut, fin });
};

// ---------- Le moteur : la feuille ----------

// Le verre de la marque, pour le papier : le bord en noir, le liquide en ambre (la seule couleur de l’affiche).
const VERRE = '<svg class="affiche-verre" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><clipPath id="affiche-bol"><circle cx="100" cy="100" r="67"/></clipPath><g clip-path="url(#affiche-bol)"><path d="M-200 108 q35 -6 70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0 V215 H-200 Z" fill="#FFB13D"/></g><path d="M68.3 28.7 A78 78 0 1 0 131.7 28.7" fill="none" stroke="#0A0B10" stroke-width="16" stroke-linecap="round"/></svg>';

// L’heure d’une ligne : « 20:45 » ; une heure provisoire n’est pas écrite (« Heure à confirmer »).
const heureDeLaLigne = (m) => `<time class="affiche-heure${m.heureConfirmee ? '' : ' affiche-heure--a-confirmer'}" datetime="${debutDe(m)}">${e(m.heureConfirmee ? heureDeParis(m.debut) : TEXTES_DES_AFFICHES.feuille.heureAConfirmer)}</time>`;

// Une ligne : l’heure, le match, la compétition. cochable : une case la précède, et l’étiquette est la ligne entière.
const ligne = (m, { cochable }) => {
  const texte = `${heureDeLaLigne(m)} <span class="affiche-match">${e(nomCourt(m))}</span> <span class="affiche-competition">${e(m.competition)}</span>`;
  if (!cochable) return `      <li class="affiche-ligne"><span class="affiche-ligne__texte">${texte}</span></li>`;
  const id = `affiche-${m.slug}`;
  return `      <li class="affiche-ligne"><input class="affiche-case" type="checkbox" id="${id}" aria-describedby="jour-${jourDeParis(m.debut)}"><label class="affiche-ligne__texte" for="${id}">${texte}</label></li>`;
};

// Les matchs groupés par jour : le jour à gauche (« Vendredi 23 »), ses matchs à droite. niveau : celui du titre du jour.
const lesJours = (matchs, { cochable, niveau = 4 }) => {
  const jours = [...new Set(matchs.map((m) => jourDeParis(m.debut)))];
  return jours.map((jour) => {
    const [nom, numero] = jourEnLettres(midiDe(jour)).split(' ');
    return `  <section class="affiche-jour" aria-labelledby="jour-${jour}">
    <h${niveau} class="affiche-jour__nom" id="jour-${jour}"><time datetime="${jour}">${e(`${capitale(nom)} ${numero}`)}</time></h${niveau}>
    <ul class="affiche-lignes">
${matchs.filter((m) => jourDeParis(m.debut) === jour).map((m) => ligne(m, { cochable })).join('\n')}
    </ul>
  </section>`;
  }).join('\n');
};

// Le pied : à gauche, les deux lignes à remplir au stylo (blanc), l’appel (l’affiche d’un bar) et la phrase de
// préparation avec le verre ; à droite, le QR code et l’adresse qu’il ouvre, écrite en clair. Les lignes vides sont un
// dessin : un lecteur d’écran ne les lit pas.
const piedDeLaFeuille = ({ phrase, svg, adresse, appel = '', blanc = false }) => `  <div class="affiche-pied">
    <div class="affiche-pied__texte">
${blanc ? '      <ul class="affiche-blanc" aria-hidden="true"><li></li><li></li></ul>\n' : ''}${appel}      <p class="affiche-prepare">${VERRE}<span>${e(phrase)}</span></p>
    </div>
    <figure class="affiche-qr">
      ${svg}
      <figcaption class="affiche-qr__adresse">${e(adresse)}</figcaption>
    </figure>
  </div>`;

// Le choix du papier : deux boutons radio, sans formulaire. L’A3 agrandit tout (affiche.css) ; le papier lui-même se
// choisit dans la fenêtre d’impression.
const choixDuFormat = () => {
  const t = TEXTES_DES_AFFICHES.format;
  return `<fieldset class="affiche-format">
    <legend>${e(t.legende)}</legend>
    <label class="affiche-format__choix"><input type="radio" name="affiche-format" id="affiche-a4" value="a4" checked> ${e(t.a4)}</label>
    <label class="affiche-format__choix"><input type="radio" name="affiche-format" id="affiche-a3" value="a3"> ${e(t.a3)}</label>
  </fieldset>`;
};

const modeDEmploi = (etapes, notes) => `<section class="regarder-section affiche-mode" aria-labelledby="titre-mode">
  <h2 id="titre-mode">${e(TEXTES_DES_AFFICHES.ouverte.modeTitre)}</h2>
  <ol class="regarder-etapes">
${etapes.map((etape) => `    <li>${e(etape)}</li>`).join('\n')}
  </ol>
${notes.map((note) => `  <p class="regarder-note">${e(note)}</p>`).join('\n')}
  ${choixDuFormat()}
</section>`;

const avecLaFeuille = (pageDeBase, { cadre, marque, avecPresse }) => ({
  ...pageDeBase,
  contenu: page({ cadre, marque, avecPresse, ...pageDeBase, feuilles: [FEUILLE_DE_STYLE] }),
});

// ---------- L’affiche de la semaine, pour tous les bars ----------

export const fabriquerLAfficheOuverte = ({ donnees, contenu, cadre, avecPresse = false, qr }) => {
  const { maintenant } = donnees;
  const t = TEXTES_DES_AFFICHES.ouverte;
  const f = TEXTES_DES_AFFICHES.feuille;
  const chemin = CHEMIN_DE_L_AFFICHE;
  const matchs = matchsDeLAffiche(donnees);
  const etapes = [{ nom: contenu.textes.fil.accueil, chemin: '/' }, { nom: contenu.textes.fil.matchs, chemin: '/matchs/' }, { nom: t.fil, chemin }];
  const titrePage = t.titrePage;
  const desc = t.description;
  // La phrase pour les bars inscrits : seulement quand il en existe au moins un vrai, publié.
  const inscrits = donnees.bars.length > 0 ? `\n  <p>${e(t.barInscrit)}</p>` : '';
  const corps = `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(t.titre)}</h1>
  <p class="regarder-chapeau">${e(t.chapeau)}</p>
</header>
${modeDEmploi(t.etapes, [t.deuxPages])}
<section class="regarder-section affiche-zone" aria-labelledby="titre-feuille">
  <h2 id="titre-feuille">${e(t.titreFeuille)}</h2>
  <div class="affiche${matchs.length ? '' : ' affiche--vide'}">
  <div class="affiche-tete">
    <h3 class="affiche-titre">${e(f.titre)}</h3>
    <p class="affiche-dates">${e(lesDates(joursDeLaSemaine(maintenant)))}</p>
  </div>
${matchs.length ? lesJours(matchs, { cochable: true }) : `  <p class="affiche-vide">${e(t.sansMatch)}</p>`}
${piedDeLaFeuille({ phrase: remplir(f.prepare, { jour: jourEnLettres(maintenant) }), svg: svgDuQr(qr.matrice(ADRESSE_DU_QR), { etiquette: f.qr }), adresse: f.adresse, blanc: true })}
  </div>
</section>
<section class="regarder-section" aria-labelledby="titre-apres">
  <h2 id="titre-apres">${e(t.titreApres)}</h2>
  <p>${e(t.droits)}</p>
  <p class="regarder-suite"><a href="/pour-les-bars.html">${e(t.proposer)}</a></p>${inscrits}
</section>`;
  // Indexable même sans aucun vrai bar publié : c’est un outil, fait des vrais matchs de la semaine (leurs vraies
  // heures), qui ne dit d’aucun bar qu’il est sur Baromatch. Exception à la règle « pas de vrai bar, pas d’index »,
  // validée par le lead (tests/affiche.spec.mjs la vérifie).
  return avecLaFeuille({
    type: 'affiche', cle: 'affiche', date: null, chemin, indexable: true, titre: titrePage, description: desc, barsNommes: [],
    jsonld: [pageWeb({ chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
    corps,
  }, { cadre, marque: contenu.marque, avecPresse });
};

// ---------- L’affiche d’un bar publié ----------

// « Ce soir, on diffuse le match. » le jour même (« Aujourd’hui » pour un coup d’envoi avant 17 h ou une heure à
// confirmer), sinon « Ici, on diffuse le match. », vrai tant que l’affiche reste au mur. Le jour et l’heure du match
// sont toujours écrits dessous, en entier : une affiche du jour même, encore au mur le lendemain, ne trompe personne.
const annonce = (soiree, maintenant) => {
  const t = TEXTES_DES_AFFICHES.bar;
  if (!soiree || jourDeParis(soiree.match.debut) !== jourDeParis(maintenant)) return t.ici;
  return soiree.match.heureConfirmee && heureDuJour(soiree.match.debut) >= 17 ? t.ceSoir : t.aujourdhui;
};

export const fabriquerLAfficheDuBar = ({ bar, donnees, contenu, cadre, avecPresse = false, qr }) => {
  const { maintenant } = donnees;
  const { marque, textes } = contenu;
  const t = TEXTES_DES_AFFICHES.bar;
  const chemin = cheminDeLAfficheDuBar(bar);
  const jours = joursDeLaSemaine(maintenant);
  // Ses soirées à venir (ou en cours), sans les matchs reportés ou annulés.
  const soirees = bar.soirees.filter((s) => s.match.debut + DUREE_MATCH_MS > maintenant && !s.match.statut).sort((a, b) => a.match.debut - b.match.debut);
  const prochaine = soirees[0] ?? null;
  const suivantes = soirees.slice(1).filter((s) => jours.includes(jourDeParis(s.match.debut))).slice(0, LIGNES_PAR_FEUILLE / 2).map((s) => s.match);
  const etapes = [
    { nom: textes.fil.accueil, chemin: '/' }, { nom: textes.fil.villes, chemin: '/regarder-le-match/' },
    { nom: bar.ville.nom, chemin: cheminDeLaVille(bar.ville) }, { nom: bar.nom, chemin: cheminDuBar(bar) }, { nom: t.fil, chemin },
  ];
  const nom = remplir(t.titrePage, { bar: bar.nom });
  const titrePage = intituler(`${nom} — Baromatch`, nom, `${bar.nom.slice(0, 40)} : son affiche`);
  const desc = decrire(
    `${nom}, ${bar.quartier} : ${prochaine ? `sa prochaine soirée de match (${nomCourt(prochaine.match)}, ${jourEnLettres(prochaine.match.debut)})` : 'ses soirées de match'} et un QR code vers sa page Baromatch, en A4 ou en A3.`,
    `L’affiche à imprimer de ${bar.nom.slice(0, 60)} : ses soirées de match et un QR code vers sa page Baromatch, en A4 ou en A3.`,
  );
  const ouverte = Boolean(marque.appli?.ouverte);
  const appel = `      <p class="affiche-appel">${e(ouverte ? t.ouverte : t.fermee)}</p>
      <p class="affiche-appel__suite">${e(ouverte ? t.ouverteSuite : t.fermeeSuite)}</p>
`;
  const adresse = adresseDe(cheminDuBar(bar));
  const corps = `${fil(etapes)}
<header class="regarder-tete">
  <p class="regarder-surtitre">${e(bar.quartier)}</p>
  <h1 class="regarder-titre">${e(remplir(t.titre, { bar: bar.nom }))}</h1>
  <p class="regarder-chapeau">${e(t.chapeau)}</p>
</header>
${modeDEmploi(t.etapes, [t.miseAJour])}
<section class="regarder-section affiche-zone" aria-labelledby="titre-feuille">
  <h2 id="titre-feuille">${e(t.titreFeuille)}</h2>
  <div class="affiche affiche--bar">
  <div class="affiche-tete">
    <p class="affiche-bar">${e(bar.nom)}</p>
    <h3 class="affiche-titre">${e(annonce(prochaine, maintenant))}</h3>
${prochaine ? `    <p class="affiche-prochain"><span class="affiche-prochain__match">${e(nomCourt(prochaine.match))}</span> <span class="affiche-prochain__quand">${e(capitale(jourEnLettres(prochaine.match.debut)))} · ${heureDeLaLigne(prochaine.match)}</span> <span class="affiche-competition">${e(prochaine.match.competition)}</span></p>\n` : ''}  </div>
${suivantes.length ? `  <h4 class="affiche-sous-titre">${e(t.suivantes)}</h4>\n${lesJours(suivantes, { cochable: false, niveau: 5 })}\n` : ''}${piedDeLaFeuille({ phrase: remplir(t.prepare, { jour: jourEnLettres(maintenant) }), svg: svgDuQr(qr.matrice(adresse), { etiquette: remplir(t.qr, { bar: bar.nom }) }), adresse: adresse.replace(/^https:\/\//, ''), appel })}
  </div>
</section>`;
  // Une page utilitaire, à imprimer : jamais dans l’index ni dans le plan du site (la page du bar, elle, y est).
  return avecLaFeuille({
    type: 'affiche-bar', cle: bar.slug, date: null, chemin, indexable: false, titre: titrePage, description: desc, barsNommes: [bar.id],
    jsonld: [pageWeb({ chemin, titre: titrePage, description: desc }), filDAriane(etapes)],
    corps,
  }, { cadre, marque, avecPresse });
};

// Le lien de la page d’un bar vers son affiche (pages.mjs le reçoit seulement quand les affiches sont écrites).
export const lienVersLAffiche = (bar) => `<p class="regarder-suite"><a href="${cheminDeLAfficheDuBar(bar)}">${e(TEXTES_DES_AFFICHES.bar.lien)}</a></p>`;
// Le lien de la semaine (/matchs/) vers l’affiche de ses matchs, un lien seul (pages.mjs, de même).
export const lienVersLAfficheDeLaSemaine = () => `<p class="regarder-suite"><a href="${CHEMIN_DE_L_AFFICHE}">${e(TEXTES_DES_AFFICHES.ouverte.lienSemaine)}</a></p>`;

// Toutes les affiches d’un passage : l’affiche ouverte et celle de chaque vrai bar publié. Sans encodeur de QR code
// (qr null), aucune.
export const fabriquerLesAffiches = ({ donnees, contenu, cadre, avecPresse = false, qr }) => {
  if (!qr) return [];
  return [
    fabriquerLAfficheOuverte({ donnees, contenu, cadre, avecPresse, qr }),
    ...donnees.bars.map((bar) => fabriquerLAfficheDuBar({ bar, donnees, contenu, cadre, avecPresse, qr })),
  ];
};
