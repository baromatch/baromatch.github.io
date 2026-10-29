// Le contraste des petits textes, mesuré tel qu’il est peint, sur les fonds clairs d’une page « jour » (<html class="jour">,
// styles.css) : l’accueil (tests/accueil-semaine.spec.mjs) et « Pour les bars » (tests/pour-les-bars-jour.spec.mjs).
//
// mesurerLesTextes lit la page ouverte : chaque élément qui porte du texte visible, hors des moments de nuit (que la page
// nomme dans `nuit` : un sélecteur CSS), la couleur de son texte posée sur son vrai fond (les fonds translucides empilés
// jusqu’au premier fond plein), et sa taille. Le texte de remplacement des champs (::placeholder) aussi. Les petits
// textes (moins de 24 px, ou 18,66 px en gras) doivent faire 4,5:1 ; ici, on l’exige de tous.

// Ce qui n’est jamais du texte à mesurer, où que ce soit : le texte caché pour les lecteurs d’écran, le lien d’évitement
// (posé hors de l’écran).
export const TOUJOURS_HORS_JEU = '.visuellement-cache, .lien-evitement';

export const mesurerLesTextes = (page, nuit) => page.evaluate((horsJeu) => {
  const lire = (css) => { const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number); return { r, v, b, a }; };
  const poser = (dessus, dessous) => ({ r: dessus.r * dessus.a + dessous.r * (1 - dessus.a), v: dessus.v * dessus.a + dessous.v * (1 - dessus.a), b: dessus.b * dessus.a + dessous.b * (1 - dessus.a), a: 1 });
  const lum = ({ r, v, b }) => [r, v, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const rapport = (x, y) => { const [c, s] = [lum(x), lum(y)].sort((m, n) => n - m); return (c + 0.05) / (s + 0.05); };
  const fondDe = (element) => {
    const couches = [];
    for (let e = element; e; e = e.parentElement) {
      const f = lire(getComputedStyle(e).backgroundColor);
      if (f.a > 0) couches.push(f);
      if (f.a === 1) break;
    }
    return couches.reverse().reduce((dessous, dessus) => poser(dessus, dessous), { r: 255, v: 255, b: 255, a: 1 });
  };
  const hex = ({ r, v, b }) => `#${[r, v, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const mesures = [];
  for (const element of document.querySelectorAll('body *')) {
    if (element.closest(horsJeu) || !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const texte = [...element.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const style = getComputedStyle(element);
    const champ = element.matches('input[placeholder]') ? getComputedStyle(element, '::placeholder') : null;
    if (!texte && !champ) continue;
    const fond = fondDe(element);
    const couleur = lire((champ ?? style).color);
    const peinte = poser(couleur, fond);
    const taille = parseFloat(style.fontSize);
    mesures.push({
      quoi: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.split(' ')[0]}` : ''}${champ ? '::placeholder' : ''} « ${(texte || element.placeholder).slice(0, 28)} »`,
      rapport: Math.round(rapport(peinte, fond) * 100) / 100, texte: hex(peinte), fond: hex(fond), petit: taille < 24 && !(taille >= 18.66 && Number(style.fontWeight) >= 700), taille,
    });
  }
  return mesures;
}, `${nuit}, ${TOUJOURS_HORS_JEU}`);

// Les textes sous 4,5:1, une ligne chacun, sans doublon.
export const textesTropFaibles = (mesures, seuil = 4.5) => [...new Set(mesures.filter((m) => m.rapport < seuil)
  .map((m) => `${m.quoi} : ${m.rapport}:1 (${m.texte} sur ${m.fond}, ${m.taille} px)`))];

// Le rapport de la PR : chaque couple de couleurs des petits textes, et son contraste le plus faible (du plus faible au plus fort).
export const lesCouples = (mesures) => {
  const couples = new Map();
  for (const m of mesures.filter((x) => x.petit)) {
    const cle = `${m.texte} sur ${m.fond}`;
    if (!couples.has(cle) || couples.get(cle).rapport > m.rapport) couples.set(cle, m);
  }
  return [...couples.entries()].sort((a, b) => a[1].rapport - b[1].rapport);
};

// Les couples, pour l’annotation d’un test (infos.annotations.push({ type: 'contraste', description })).
export const decrireLesCouples = (mesures) => lesCouples(mesures).map(([cle, m]) => `${m.rapport}:1 ${cle} (${m.quoi})`).join(' | ');
