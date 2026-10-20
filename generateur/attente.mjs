// La liste d’attente par ville, sur la page de chaque ville : le formulaire de l’accueil (index.html), sans
// JavaScript. Le navigateur vérifie l’adresse (required, type="email") et l’envoie droit à Formspree, avec la ville
// choisie dans une liste fixe (aucun champ libre) : l’adresse mail et la ville, rien d’autre. Formspree affiche
// ensuite sa propre page de remerciement (la redirection vers le site est réservée à ses offres payantes, et se règle
// dans son tableau de bord : aucun champ « _next »). La phrase sous la ville suit le choix, sans script (:has, dans
// styles.css). tests/liste-attente-villes.spec.mjs vérifie que ce formulaire et celui de l’accueil disent la même chose.
import { echapper as e } from './texte.mjs';

export const ENVOI_DE_LA_LISTE = 'https://formspree.io/f/mqpeedoj';
// Les villes de la liste, dans l’ordre affiché, avec la clé de leur guide (generateur/contenu/villes.json).
export const VILLES_DE_LA_LISTE = [
  { valeur: 'Paris', cle: 'paris' },
  { valeur: 'Lyon', cle: 'lyon' },
  { valeur: 'Marseille', cle: 'marseille' },
  { valeur: 'Lille', cle: 'lille' },
  { valeur: 'Autre', cle: null },
];
const CLES = new Set(VILLES_DE_LA_LISTE.map((v) => v.cle).filter(Boolean));

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// La ville de la liste qui correspond à une page de ville : la sienne, ou « Autre » pour une ville hors de la liste.
export const villeDeLaListe = (cle) => VILLES_DE_LA_LISTE.find((v) => v.cle === cle) ?? VILLES_DE_LA_LISTE.at(-1);

// « Pas de date pour Lyon » : seulement pour une ville sans aucun bar sur Baromatch (Paris, où l’appli est en test,
// n’en a jamais). « Autre » : tant qu’aucun bar n’est hors des villes de la liste.
const phraseDeLaVille = (ville, textes, clesAvecBars) => {
  if (ville.cle === 'paris') return '';
  if (ville.cle) return clesAvecBars.has(ville.cle) ? '' : remplir(textes.pasDeDate, { ville: ville.valeur });
  return [...clesAvecBars].some((cle) => !CLES.has(cle)) ? '' : textes.pasDeDateAutre;
};

// Le formulaire d’une page de ville. cle : la clé de la ville de la page ; nom : son nom ; clesAvecBars : les clés des
// villes qui ont au moins un bar ; ouverte : l’appli est ouverte au public.
export const listeDAttente = ({ cle, nom, textes, clesAvecBars, ouverte }) => {
  const t = textes.attente;
  const choisie = villeDeLaListe(cle);
  const titre = remplir(cle === 'paris' || clesAvecBars.has(cle) ? t.titreOuvre : t.titreArrive, { ville: nom });
  const options = VILLES_DE_LA_LISTE.map((v, i) => `        <label class="attente__ville" for="attente-ville-${i}"><input id="attente-ville-${i}" type="radio" name="ville" value="${v.valeur}"${v === choisie ? ' checked' : ''}><span>${e(v.valeur)}</span></label>`);
  const phrases = VILLES_DE_LA_LISTE.map((v) => [v, phraseDeLaVille(v, t, clesAvecBars)]).filter(([, phrase]) => phrase)
    .map(([v, phrase]) => `    <p class="attente__date" data-ville="${v.valeur}">${e(phrase)}</p>`);
  return `<section class="regarder-section regarder-attente" aria-labelledby="titre-attente">
  <h2 id="titre-attente">${e(titre)}</h2>
  <form class="attente" id="attente" action="${ENVOI_DE_LA_LISTE}" method="POST">
    <fieldset class="attente__villes" aria-describedby="attente-usage">
      <legend>${e(t.villes)}</legend>
      <div class="attente__options">
${options.join('\n')}
      </div>
    </fieldset>
${phrases.join('\n')}${phrases.length ? '\n' : ''}    <label class="attente__etiquette" for="attente-mail">${e(t.etiquette)}</label>
    <div class="attente__ligne">
      <input class="attente__champ" id="attente-mail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="ton@adresse.fr" required>
      <button class="attente__bouton" type="submit">${e(t.bouton)}</button>
    </div>
    <div class="attente__piege" aria-hidden="true"><label for="attente-piege">Laisse ce champ vide</label><input id="attente-piege" type="text" name="_gotcha" tabindex="-1" autocomplete="off"></div>
    <input type="hidden" name="_subject" value="${e(t.sujet)}">
${ouverte ? '' : `    <p class="attente__plateformes">${e(t.plateformes)}</p>\n`}    <p class="attente__note" id="attente-usage">${e(t.note)} <a href="/confidentialite.html#liste-attente">${e(t.lienNote)}</a>.</p>
  </form>
</section>`;
};
