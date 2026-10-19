// Loi Evin : le mot qui, dans le texte d’une offre de bar, nomme un alcool. La liste et la lecture sont celles de
// l’appli (apps/api/src/modules/bars/offerAlcohol.ts du dépôt de l’appli, décision du 12 octobre 2026 : mots entiers,
// sans accents ni capitales, pluriel compris ; « sans alcool » dit de la boisson est la seule échappatoire, « demi »
// avant « tarif » ou « heure » n’est pas une boisson, ni « rouge » après « carton »). Le site y ajoute quelques mots
// d’argot que l’appli n’a pas : la liste ne peut qu’écarter plus d’offres, jamais moins.
// Sur le site, une offre dont le texte nomme un alcool ne montre ni son titre ni son prix (donnees.mjs).

// La liste de l’appli, dans son ordre (relue le 19 octobre 2026). Une mise à jour de l’appli se recopie ici.
const MOTS_DE_L_APPLI = [
  'pintes?', 'demis?', 'bieres?', 'vins?', 'roses?', 'champagnes?', 'cocktails?', 'spritz', 'shots?', 'shooters?',
  'whiske?y', 'whiskies', 'rhums?', 'vodkas?', 'gins?', 'pastis', 'cidres?', 'aperos?', 'aperitifs?',
  'alcools?', 'alcoolisee?s?', 'pressions?', 'pichets?', 'blondes?', 'brunes?', 'ambrees?', 'blanches?', 'galopins?',
  'bocks?', 'ipa', 'lagers?', 'stouts?', 'tripel', 'weizen', 'mojitos?', 'margaritas?', 'caipirinhas?', 'daiquiris?',
  'coladas?', 'negronis?', 'bellinis?', 'sangrias?', 'tequilas?', 'mezcals?', 'bourbons?', 'cognacs?', 'armagnacs?',
  'calvados', 'liqueurs?', 'digestifs?', 'absinthes?', 'schnaps', 'kirs?', 'punchs?', 'proseccos?', 'cremants?',
  'cavas?', 'muscadets?', 'chardonnays?', 'merlots?', 'beaujolais',
  'heineken', 'leffe', 'kronenbourg', '1664', 'grimbergen', 'desperados', 'corona', 'guinness', 'carlsberg', 'pelforth',
  'affligem', 'hoegaarden', 'stella', 'chouffe', 'duvel', 'chimay', 'karmeliet', 'kwak', 'delirium', 'goudale',
  'paulaner', 'budweiser', 'ricard', 'pernod', 'aperol', 'campari', 'picon', 'suze', 'lillet', 'martini',
  'jagermeister', 'bacardi', 'smirnoff', 'absolut', 'jameson', 'baileys', 'malibu',
  'rouges?', 'blancs?', 'kro', 'panaches?',
  'happyhours?',
];
// L’argot de la bière que l’appli ne lit pas encore (une binouze, une bibine, une girafe de trois litres).
const MOTS_DU_SITE = ['binouzes?', 'bibines?', 'girafes?'];

export const MOTS_D_ALCOOL = [...MOTS_DE_L_APPLI, ...MOTS_DU_SITE];

const MOT_D_ALCOOL = new RegExp(`^(?:${MOTS_D_ALCOOL.join('|')})$`);
// Deux mots qui ne nomment un alcool qu’ensemble.
const EXPRESSIONS = [['happy', 'hour'], ['happy', 'hours']];
// « demi » n’est pas une boisson avant ces mots : « demi-tarif », « demi-heure », « demi-finale »…
const PAS_UNE_BOISSON_APRES_DEMI = new Set(['tarif', 'tarifs', 'heure', 'heures', 'prix', 'finale', 'finales', 'journee', 'douzaine', 'portion', 'portions', 'pension', 'saison']);
// Une couleur après « carton » est le carton de l’arbitre : « Carton rouge ».
const PAS_UNE_BOISSON_APRES_CARTON = /^(?:rouges?|blancs?)$/;
// Ce qui peut séparer deux mots d’une même boisson : des espaces sur une ligne, ou un trait d’union collé ; rien d’autre.
const MEME_BOISSON = /^(?:[\p{Zs}\t]+|-)$/u;

// Un mot tel qu’on le compare : minuscules, sans accents.
const simple = (mot) => mot.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Les mots d’un texte, tels qu’écrits et tels que comparés, chacun avec ce qui le précède (espaces, ponctuation).
const motsDe = (texte) => {
  const normal = texte.normalize('NFC');
  const motif = /[\p{L}\p{M}\p{N}]+/gu;
  const mots = [];
  let fin = 0;
  for (let trouve = motif.exec(normal); trouve; trouve = motif.exec(normal)) {
    mots.push({ ecrit: trouve[0], simple: simple(trouve[0]), avant: normal.slice(fin, trouve.index) });
    fin = trouve.index + trouve[0].length;
  }
  return mots;
};

// La boisson nommée au mot `rang` est-elle dite sans alcool : « sans alcool » juste après elle, ou après d’autres mots de
// la même boisson (« Pinte de bière sans alcool », « Bière blonde sans alcool ») ? Un autre mot, une ponctuation, un
// trait d’union entre espaces ou un retour à la ligne finit la boisson (« Pinte ou soft sans alcool » nomme la pinte).
const diteSansAlcool = (mots, rang) => {
  const lie = (i) => i < mots.length && MEME_BOISSON.test(mots[i].avant);
  let suivant = rang + 1;
  while (suivant <= rang + 3 && lie(suivant) && (mots[suivant].simple === 'de' || MOT_D_ALCOOL.test(mots[suivant].simple))) suivant += 1;
  return lie(suivant) && mots[suivant].simple === 'sans' && lie(suivant + 1) && mots[suivant + 1].simple === 'alcool';
};

// Le premier mot du texte qui nomme un alcool, tel qu’écrit (« Bière », « Happy hour ») ; null s’il n’y en a aucun.
export const motDAlcool = (texte) => {
  if (!texte) return null;
  const mots = motsDe(String(texte));
  for (let rang = 0; rang < mots.length; rang += 1) {
    const mot = mots[rang].simple;
    const apres = mots[rang + 1]?.simple ?? '';
    if (EXPRESSIONS.some(([premier, second]) => mot === premier && apres === second)) return `${mots[rang].ecrit} ${mots[rang + 1].ecrit}`;
    if (!MOT_D_ALCOOL.test(mot)) continue;
    if (mot.startsWith('alcool') && mots[rang - 1]?.simple === 'sans') continue;
    if (mot.startsWith('demi') && PAS_UNE_BOISSON_APRES_DEMI.has(apres)) continue;
    if (PAS_UNE_BOISSON_APRES_CARTON.test(mot) && /^cartons?$/.test(mots[rang - 1]?.simple ?? '')) continue;
    if (diteSansAlcool(mots, rang)) continue;
    return mots[rang].ecrit;
  }
  return null;
};
