// La feuille à laisser au patron d’un bar (/matchs/affiche/pour-le-patron/) : la troisième entrée du moteur des
// affiches (affiche.mjs, affiche.css), pour le jour où un patron dit « plus tard » à qui vient lui parler de Baromatch
// (le fondateur, ou un fan). Une feuille à imprimer et à laisser au comptoir.
// - La feuille : « Remplis ton bar les soirs de match. », quatre lignes que la page des bars (pour-les-bars.html) et
//   « Comment on choisit les bars » disent déjà (feuille-du-patron.json : aucune promesse de plus), la ligne « Où on en
//   est » de l’état de l’appli (marque.json), puis le pied : l’appel, l’adresse de contact, « Laissée par : » et sa
//   ligne vide à remplir au stylo (un dessin, qu’un lecteur d’écran ne lit pas : rien n’est tapé, rien n’est envoyé), la
//   date et le verre de la marque ; à droite, un QR code vers le formulaire de la page des bars, sans paramètre de
//   suivi, son adresse écrite en clair dessous.
// - Le papier, sans fixer sa taille (@page size bloquerait le choix dans la fenêtre d’impression) : A4, deux feuilles
//   l’une au-dessus de l’autre, à couper au milieu (la seconde est une copie, que ni l’écran ni un lecteur d’écran ne
//   montrent), ou A5, une feuille.
// - Une page utilitaire, comme l’affiche d’un bar : noindex, hors du plan du site. Sans l’encodeur des QR codes, ou
//   sans la phrase « Où on en est » de l’état de l’appli, aucune feuille (affiche.mjs ne fait alors aucun lien vers
//   elle) ; le journal dit pourquoi.
// Aucun script, aucun formulaire, aucun champ de texte, rien sur l’alcool.
import {
  CHEMIN_DE_L_AFFICHE, CHEMIN_DE_LA_FEUILLE_DU_PATRON, FEUILLE_DE_STYLE, feuilleDuPatronEcrite, ouEnEstDuPatron, TEXTES_DE_LA_FEUILLE_DU_PATRON as T,
  TEXTES_DES_AFFICHES, VERRE,
} from './affiche.mjs';
import { fil, page } from './gabarits.mjs';
import { jourEnLettres } from './heure.mjs';
import { adresseDe, filDAriane, pageWeb } from './jsonld.mjs';
import { svgDuQr } from './qr.mjs';
import { echapper as e } from './texte.mjs';

// L’adresse du QR code : le formulaire de la page des bars, telle quelle (aucun paramètre de suivi).
export const ADRESSE_DU_QR_DU_PATRON = `${adresseDe('/pour-les-bars.html')}#proposer`;

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// La feuille. copie : la seconde de l’A4, pour l’impression seulement : cachée aux lecteurs d’écran, sans titre de
// section, et son verre a son propre identifiant.
const laFeuille = ({ copie, marque, maintenant, svg }) => {
  const f = T.feuille;
  const titre = copie ? `<p class="affiche-titre">${e(f.titre)}</p>` : `<h3 class="affiche-titre">${e(f.titre)}</h3>`;
  const verre = copie ? VERRE.replaceAll('affiche-bol', 'affiche-bol-copie') : VERRE;
  return `  <div class="affiche affiche--patron${copie ? ' affiche--copie" aria-hidden="true' : ''}">
  <div class="affiche-tete">
    <p class="affiche-patron__surtitre">${e(f.surtitre)}</p>
    ${titre}
  </div>
  <ul class="affiche-patron__lignes">
${f.lignes.map((ligne) => `    <li>${e(ligne)}</li>`).join('\n')}
  </ul>
  <p class="affiche-patron__etat"><strong>${e(f.ouEnEst.titre)}</strong> ${e(ouEnEstDuPatron(marque))}</p>
  <div class="affiche-pied">
    <div class="affiche-pied__texte">
      <p class="affiche-appel">${e(f.appel)}</p>
      <p class="affiche-appel__suite">${e(remplir(f.contact, { contact: marque.contact }))}</p>
      <p class="affiche-laissee" aria-hidden="true">${e(f.stylo)}<span class="affiche-laissee__trait"></span></p>
      <p class="affiche-prepare">${verre}<span>${e(remplir(f.prepare, { jour: jourEnLettres(maintenant) }))}</span></p>
    </div>
    <figure class="affiche-qr">
      ${svg}
      <figcaption class="affiche-qr__adresse">${e(f.adresse)}</figcaption>
    </figure>
  </div>
  </div>`;
};

// Le choix du papier : deux boutons radio, sans formulaire. L’A4 imprime la feuille et sa copie (affiche.css) ; le
// papier lui-même se choisit dans la fenêtre d’impression.
const choixDuPapier = () => `<fieldset class="affiche-format">
    <legend>${e(T.format.legende)}</legend>
    <label class="affiche-format__choix"><input type="radio" name="patron-papier" id="patron-a4" value="a4" checked> ${e(T.format.a4)}</label>
    <label class="affiche-format__choix"><input type="radio" name="patron-papier" id="patron-a5" value="a5"> ${e(T.format.a5)}</label>
  </fieldset>`;

// Rend { pages, avertissements } : la page (ou aucune), et ce que le journal doit dire.
export const fabriquerLaFeuilleDuPatron = ({ donnees, contenu, cadre, avecPresse = false, qr }) => {
  const { marque, textes } = contenu;
  if (!feuilleDuPatronEcrite({ qr, marque })) {
    // Sans l’encodeur, le journal le dit déjà pour toutes les affiches (construire.mjs).
    const cle = marque.appli?.ouverte ? 'ouverte' : 'fermee';
    return {
      pages: [],
      avertissements: qr ? [`feuille du patron : sa ligne « Où on en est » pour l’appli ${marque.appli?.ouverte ? 'ouverte' : 'pas encore ouverte'} est vide (generateur/contenu/feuille-du-patron.json, « ${cle} ») ; la feuille n’est pas écrite.`] : [],
    };
  }
  const chemin = CHEMIN_DE_LA_FEUILLE_DU_PATRON;
  const etapes = [
    { nom: textes.fil.accueil, chemin: '/' }, { nom: textes.fil.matchs, chemin: '/matchs/' },
    { nom: TEXTES_DES_AFFICHES.ouverte.fil, chemin: CHEMIN_DE_L_AFFICHE }, { nom: T.fil, chemin },
  ];
  const svg = svgDuQr(qr.matrice(ADRESSE_DU_QR_DU_PATRON), { etiquette: T.feuille.qr });
  const feuille = { marque, maintenant: donnees.maintenant, svg };
  const corps = `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(T.titre)}</h1>
  <p class="regarder-chapeau">${e(T.chapeau)}</p>
</header>
<section class="regarder-section affiche-mode" aria-labelledby="titre-mode">
  <h2 id="titre-mode">${e(T.modeTitre)}</h2>
  <ol class="regarder-etapes">
${T.etapes.map((etape) => `    <li>${e(etape)}</li>`).join('\n')}
  </ol>
  <p class="regarder-note">${e(T.marges)}</p>
  ${choixDuPapier()}
</section>
<section class="regarder-section affiche-zone" aria-labelledby="titre-feuille">
  <h2 id="titre-feuille">${e(T.titreFeuille)}</h2>
${laFeuille({ ...feuille, copie: false })}
${laFeuille({ ...feuille, copie: true })}
</section>`;
  // Une page utilitaire, à imprimer : jamais dans l’index ni dans le plan du site.
  const base = {
    type: 'affiche-patron', cle: 'pour-le-patron', date: null, chemin, indexable: false, titre: T.titrePage, description: T.description, barsNommes: [],
    jsonld: [pageWeb({ chemin, titre: T.titrePage, description: T.description }), filDAriane(etapes)],
    corps,
  };
  return { pages: [{ ...base, contenu: page({ cadre, marque, avecPresse, ...base, feuilles: [FEUILLE_DE_STYLE] }) }], avertissements: [] };
};
