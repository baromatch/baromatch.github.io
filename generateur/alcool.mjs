// Loi Evin : ce qui, dans le titre d’une offre de bar, empêche le site de le publier. Le site ne publie le titre d’une
// offre que s’il est sûr qu’elle ne nomme ni n’évoque un alcool et ne pousse pas à boire ; sinon, à sa place, « Une
// offre du bar dans l’appli » (donnees.mjs, offreDe). Quatre lectures indépendantes, chacune suffit à écarter l’offre :
// une de trop n’écarte qu’une offre sans danger, une de moins publierait de l’alcool.
//  1. Les caractères (caractereNonPermis) : un titre ne se publie que s’il n’a que des lettres latines (accents
//     français compris), des chiffres, des espaces et une ponctuation simple. Un emoji (« 🍺 »), un symbole, une lettre
//     d’un autre alphabet qui ressemble aux nôtres (« Віère » en cyrillique), une lettre pleine chasse (« Ｂｉèｒｅ »),
//     un caractère invisible l’écartent : ce que le site publie n’a que des caractères qu’il sait lire.
//  2. Les mots qui nomment un alcool, ou l’évoquent (motDAlcool) : la liste de l’appli (décision du 12 octobre 2026 :
//     mots entiers, sans accents ni capitales, pluriel compris ; « demi » avant « tarif » ou « heure » n’est pas une
//     boisson, ni « rouge » après « carton ») et celle, plus longue, du site (boissons en français et en anglais,
//     cocktails, alcools forts, styles de bière, vins, marques, argot), puis les mots qui évoquent un verre sans dire
//     ce qu’il y a dedans (« verre », « bouteille », « seau »). Un mot est lu comme un humain le lit : en NFKC (pleine
//     chasse, lettres mathématiques, ligatures), sans caractères invisibles, sans accents ni capitales ; puis dans une
//     seconde forme qui défait l’écriture « leet » (« b1ère », « V3rre ») et les lettres d’autres alphabets qui
//     ressemblent aux nôtres. Les lettres répétées (« Bièèère »), les mots coupés (« P i n t e », « B.i.è.r.e »,
//     « Bi ère ») et les mots collés (« Craftbeer », « Jägerbomb », par leur racine) sont reconnus.
//  3. Ce qui pousse à boire (incitationABoire) : le deuxième verre, « 2+1 », « 2 pour 1 », « buy one », « BOGO », la
//     gratuité (« free », « offert », « on the house »), l’heure heureuse sous toutes ses formes, « à volonté », « open
//     bar », la tournée, la récompense d’un but ou d’une victoire, les verbes de la boisson (« boire », « trinquer »).
//  4. Une boisson sans nom avec un prix (boissonAvecUnPrix) : « boisson », « conso », « drink » avec un prix écrit
//     dans le titre, une remise ou une gratuité, ou un prix de 0 € (« Boisson à 2 € », « Conso du match » à 0 €).
// Un mot déguisé peut nommer un alcool, jamais l’excuser : « sans alcool » (la seule échappatoire, comme dans l’appli),
// « demi-tarif », « carton rouge » et les exceptions du site ne valent qu’écrits tels quels, lus comme l’appli les lit
// (ni « sans alc00l », ni « sans аlcool » en cyrillique, ni « ｓａｎｓ ａｌｃｏｏｌ »). La liste ne peut qu’écarter plus
// d’offres que l’appli, jamais moins : les exceptions du site (« mousse au chocolat », « carton jaune », « PSG-Monaco »)
// ne portent que sur des mots que l’appli ne lit pas.

// ---------- Les mots ----------

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
// Ce que le site ajoute : large exprès (une offre sans danger écartée reste dans l’appli ; un alcool publié est un
// risque). Sans accents ni capitales.
const MOTS_DU_SITE = [
  // L’argot de la bière et du vin, et les mots d’un comptoir.
  'binouzes?', 'bibines?', 'girafes?', 'mousses?', 'bulles?', 'mousseux', 'cervoises?', 'futs?', 'tireuses?', 'pinards?',
  'jaja', 'piquettes?', 'pastagas?', 'jaunes?', 'perroquets?', 'mauresques?', 'tangos?', 'monacos?', 'despes?', 'grim',
  'grimb', 'digeos?', 'gnoles?', 'champ', 'arrosee?s?', 'afterworks?', 'soif', 'assoiffee?s?', 'ivres?', 'pompettes?',
  'tchin', 'tchintchin', 'cheers', 'spiritueux',
  // L’anglais d’un bar.
  'beers?', 'pints?', 'wines?', 'ciders?', 'ales?', 'crafts?', 'drafts?', 'draughts?', 'booze', 'boozy', 'liquors?',
  'bubbly', 'brandy', 'brandies', 'rums?', 'scotch', 'sherry', 'alcohol', 'alcoholic', 'tipsy',
  // Les bières : styles, langues, marques.
  'birras?', 'cervezas?', 'cervejas?', 'bier', 'pivo', 'ipas?', 'neipas?', 'pils', 'pilsners?', 'pilsens?', 'krieks?',
  'gueuzes?', 'geuzes?', 'lambics?', 'tripels', 'triples?', 'quadrupels?', 'dubbels?', 'weiss', 'weissbier',
  'hefeweizen', 'witbier', 'malts?', 'trappistes?', 'peroni', 'moretti', 'estrella', 'damm', 'mahou', 'amstel', 'tuborg',
  'becks?', 'brewdog', 'bavaria', 'jupiler', 'maes', 'westmalle', 'orval', 'kasteel', 'jenlain', 'anosteke', 'kilkenny',
  'smithwicks?', 'magners', 'strongbow', 'somersby', 'kopparberg', 'rekorderlig', 'asahi', 'kirin', 'tsingtao',
  'singha', 'coors', 'michelob', 'modelo', 'pacifico', 'bud', 'fischer', 'skoll', 'adelscott', 'lagunitas',
  // Les alcools forts, les liqueurs, et leurs marques.
  'kirsch', 'cachaca', 'pisco', 'soju', 'shochu', 'baijiu', 'sakes?', 'grappas?', 'ouzos?', 'rakis?', 'araks?',
  'sambucas?', 'limoncellos?', 'amarettos?', 'anisettes?', 'vermouths?', 'portos?', 'xeres', 'pineaus?', 'pommeaus?',
  'ratafias?', 'hypocras', 'chouchen', 'hydromels?', 'muscats?', 'gentianes?', 'calva', 'chivas', 'glenfiddich',
  'glenlivet', 'lagavulin', 'laphroaig', 'talisker', 'ballantines?', 'johnnie', 'hennessy', 'martell', 'courvoisier',
  'cointreau', 'marnier', 'kahlua', 'disaronno', 'frangelico', 'chartreuse', 'benedictine', 'izarra', 'fernet',
  'underberg', 'casanis', 'byrrh', 'dubonnet', 'noilly', 'cinzano', 'pimms?', 'passoa', 'zubrowka', 'eristoff',
  'poliakov', 'sobieski', 'havana', 'kraken', 'diplomatico', 'damoiseau', 'cuervo', 'olmeca', 'tanqueray', 'hendricks',
  'beefeater', 'jager', 'jagerbombs?',
  // Les cocktails.
  'hugo', 'mules?', 'planteurs?', 'caipis?', 'caipiroskas?', 'cosmopolitans?', 'gimlets?', 'grogs?', 'b52', 'tipunchs?',
  // Les vins : régions, appellations, cépages, champagnes.
  'vinos?', 'bordeaux', 'bourgognes?', 'chablis', 'sancerres?', 'riojas?', 'chiantis?', 'lambruscos?', 'valpolicella',
  'barolo', 'rieslings?', 'gewurztraminer', 'sylvaner', 'pinots?', 'syrahs?', 'cabernets?', 'sauvignons?', 'malbecs?',
  'gamays?', 'grenaches?', 'viogniers?', 'chenins?', 'picpoul', 'vouvray', 'medoc', 'pomerol', 'sauternes', 'gaillac',
  'jurancon', 'tavel', 'bandol', 'chateauneuf', 'brouilly', 'morgon', 'moet', 'chandon', 'clicquot', 'ruinart',
  'taittinger', 'mumm', 'pommery', 'perignon', 'krug', 'bollinger', 'feuillatte',
];
export const MOTS_D_ALCOOL = [...MOTS_DE_L_APPLI, ...MOTS_DU_SITE];
// Les mots qui évoquent un verre sans dire ce qu’il y a dedans : dans un bar, un verre, une bouteille, un seau sont
// d’alcool tant que le texte ne dit pas « sans alcool ». Lus après les mots qui nomment un alcool (« Verre de vin »
// nomme le vin).
export const MOTS_D_UN_VERRE = [
  'verres?', 'glass(?:es)?', 'godets?', 'bouteilles?', 'bottles?', 'seaux?', 'buckets?', 'carafes?', 'pitchers?', 'jugs?',
  'chopes?', 'canettes?', 'cannettes?', 'jeroboams?',
];

// Le mot sans ses lettres répétées (« bieeere » → « biere ») : comparé à la liste resserrée de la même façon.
const resserrer = (mot) => mot.replace(/(\p{L})\1+/gu, '$1');
const exact = (motifs) => new RegExp(`^(?:${motifs.join('|')})$`);
const LISTES = {
  alcool: { mot: exact(MOTS_D_ALCOOL), resserre: exact(MOTS_D_ALCOOL.map(resserrer)) },
  verre: { mot: exact(MOTS_D_UN_VERRE), resserre: exact(MOTS_D_UN_VERRE.map(resserrer)) },
};
// Les mots qu’une boisson peut porter avant son « sans alcool » : ceux de l’appli, comme elle (« Pinte de bière blonde
// sans alcool »).
const MOT_DE_L_APPLI = exact(MOTS_DE_L_APPLI);
// Une racine d’alcool dans un mot collé à un autre (« Craftbeer », « Superbière », « Jägerbomb », « Bièrepong ») : des
// racines longues, qu’aucun mot sans danger d’une offre ne contient (ni « gingembre », ni « screenshot », ni « pintade »).
const RACINE = /biere|beer|pinte|vodka|whiske?y|tequila|cocktail|champagne|jager|mojito|spritz|aperol|apero|aperitif|sangria|alcool|alcohol|booze|binouze|heineken|guinness|kronenbourg|ricard|pastis|bacardi|smirnoff|absinth|bourbon|cognac|armagnac|prosecco|liqueur|mezcal|daiquiri|negroni|margarita|caipi|limoncello|amaretto|grappa|cidre|cider|wine|lambrusco|chardonnay|sauvignon|cabernet|merlot|brewdog|desperados|leffe|grimbergen|hoegaarden|carlsberg|budweiser|spiritueux/;

// Plusieurs mots qui ne nomment un alcool qu’ensemble. Ceux qui sont une boisson échappent à la liste suivis de « sans
// alcool » ; l’heure heureuse, l’afterwork, le cul sec jamais.
const EXPRESSIONS_DE_BOISSON = [
  'cuba libre', 'bloody mary', 'long island', 'mai tai', 'sex on the beach', 'irish coffee', 'white russian',
  'black russian', 'old fashioned', 'dark n stormy', 'cotes du rhone', 'cote du rhone', 'cotes de provence',
  'saint emilion', 'st emilion', 'mort subite', 'blue moon', 'san miguel', 'gulden draak', 'jack daniel',
  'jack daniels', 'jack coke', 'jim beam', 'grey goose', 'captain morgan', 'get 27', 'get 31', 'label 5',
  'clan campbell', 'remy martin', 'laurent perrier', 'loic raison', 'eau de vie', 'eaux de vie', 'pousse cafe',
  'on tap', 'hard seltzer', 'seize soixante quatre', 'don papa', 'trois rivieres',
].map((e) => e.split(' '));
const EXPRESSIONS_QUI_POUSSENT = ['happy hour', 'happy hours', 'heure heureuse', 'heures heureuses', 'after work', 'after works', 'cul sec', 'pub crawl']
  .map((e) => e.split(' '));
// Ce qui nomme un alcool sans être un mot : « G&T », « V&T », « B-52 », « une 8.6 », et les emoji des boissons
// d’alcool (le premier filet : un emoji ne passe déjà pas la liste des caractères permis).
const MOTIFS_D_ALCOOL = [/\b[gv]\s*&\s*t\b/, /\bb\s*-?\s*52\b/, /\b8[.,]6\b/];
const EMOJI_D_ALCOOL = /[\u{1F376}-\u{1F37B}\u{1F37E}\u{1F942}\u{1F943}]/u;

// Les exceptions, toutes sur des mots que l’appli ne lit pas, sauf les deux de l’appli (« demi », « carton »).
// « demi » n’est pas une boisson avant ces mots : « demi-tarif », « demi-heure », « demi-finale »…
const PAS_UNE_BOISSON_APRES_DEMI = new Set(['tarif', 'tarifs', 'heure', 'heures', 'prix', 'finale', 'finales', 'journee', 'douzaine', 'portion', 'portions', 'pension', 'saison']);
// Une couleur après « carton » est le carton de l’arbitre : « Carton rouge », « Carton jaune ».
const PAS_UNE_BOISSON_APRES_CARTON = /^(?:rouges?|blancs?|jaunes?)$/;
// « jaune » (le pastis) n’en est pas un après ces mots (« maillot jaune », « curry jaune ») ni avant « d’œuf ».
const JAUNE_SANS_PASTIS = new Set(['maillot', 'maillots', 'gilet', 'gilets', 'curry', 'poivron', 'poivrons', 'citron', 'citrons', 'riz', 'sauce', 'cheddar']);
// « mousse » (la bière) n’en est pas une avant ces mots : « mousse au chocolat », « mousse de canard ».
const MOUSSE_A_MANGER = new Set(['au', 'aux', 'de', 'd', 'du', 'des']);
// « triple » (la bière belge) n’en est pas une avant ces mots : « triple cheeseburger ».
const TRIPLE_A_MANGER = new Set(['burger', 'burgers', 'cheese', 'cheeseburger', 'cheeseburgers', 'smash', 'steak', 'steaks', 'bacon', 'chocolat', 'cheddar', 'patty', 'decker', 'combo', 'menu']);
// Trois noms de vin qui sont aussi des clubs : ce sont des clubs dans une affiche (« PSG-Monaco », « FC Porto »,
// « Girondins de Bordeaux », « Monaco contre Lens »), pas avant un mot de cocktail (« Porto-tonic »).
const BOISSONS_QUI_SONT_DES_CLUBS = new Set(['porto', 'monaco', 'bordeaux']);
const AVANT_UN_CLUB = new Set(['fc', 'as', 'asm', 'girondins', 'contre', 'vs', 'versus', 'v', 'face']);
const APRES_UN_CLUB = new Set(['contre', 'vs', 'versus', 'v']);
const COCKTAIL_APRES = new Set(['tonic', 'blanc', 'rouge', 'rose', 'flip']);
const AFFICHE = /[-–—/]/;

// ---------- Lire un mot comme un humain le lit ----------

// Les caractères invisibles (de format, de remplissage) qui coupent un mot sans se voir : un espace de largeur nulle, un
// trait d’union conditionnel, un remplissage hangûl, un blanc braille.
const INVISIBLES = /[\p{Cf}\u{34F}\u{115F}\u{1160}\u{17B4}\u{17B5}\u{180E}\u{2800}\u{3164}\u{FFA0}]/gu;
const QUE_DE_L_INVISIBLE = /^[\p{Cf}\u{180E}\u{2800}]+$/u;
// Les lettres que la décomposition Unicode ne sépare pas de leur accent.
const LETTRES = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ı: 'i', ð: 'd', þ: 'th', ħ: 'h', ŀ: 'l' };
// Un mot tel que l’appli le compare (offerAlcohol.ts) : minuscules, sans accents. Seul ce mot-là peut excuser une
// boisson (« sans alcool », « demi-tarif »).
const commeLAppli = (mot) => mot.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Un texte tel que le site le compare pour trouver un alcool : en NFKC (« Ｂｉèｒｅ », « 𝐁𝐢è𝐫𝐞 » deviennent « Bière »),
// sans caractères invisibles, en minuscules, sans accents, « œ », « ø », « ß »… dépliés.
const plier = (texte) => texte.normalize('NFKC').replace(INVISIBLES, '').toLowerCase()
  .replace(/[øæœßłđıðþħŀ]/g, (l) => LETTRES[l]).normalize('NFD').replace(/\p{M}/gu, '');
// Les lettres d’autres alphabets qui ressemblent aux nôtres (cyrillique, grec, petites capitales), une pour une.
const SOSIES = {
  А: 'A', В: 'B', Е: 'E', Ё: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', Ѕ: 'S', І: 'I', Ї: 'I', Ј: 'J', Ԛ: 'Q', Ԝ: 'W', Һ: 'H',
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', о: 'o', п: 'n', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', ь: 'b', ѕ: 's', і: 'i', ї: 'i', ј: 'j', ԁ: 'd', һ: 'h', ԛ: 'q', ԝ: 'w', ӏ: 'l',
  Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X',
  α: 'a', β: 'b', γ: 'y', ε: 'e', η: 'n', ι: 'i', κ: 'k', μ: 'u', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
  ɑ: 'a', ɡ: 'g', ɩ: 'i', ɪ: 'i', ʟ: 'l', ʀ: 'r', ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ɢ: 'g', ʜ: 'h', ᴊ: 'j', ᴋ: 'k', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
};
const SOSIE = new RegExp(`[${Object.keys(SOSIES).join('')}]`, 'gu');
const versLeLatin = (texte) => texte.replace(SOSIE, (c) => SOSIES[c]);
// L’écriture « leet » : un chiffre ou un symbole à la place d’une lettre, dans un mot qui a au moins une lettre (« b1ère »,
// « V3rre », « 0ffert », « Bi€re », « $hot ») ; un nombre seul (« 1664 », « 5 € ») reste un nombre. « 1 » se lit « i »
// puis « l » (« b1ère », « 1ager »).
const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '€': 'e', '!': 'i', '|': 'l' };
const MOT = /[\p{L}\p{M}\p{N}]+/gu;
const MOT_LEET = /[\p{L}\p{M}\p{N}@$€!|]+/gu;
const deLeet = (mot, un) => (/\p{L}/u.test(mot) ? mot.replace(/[013457@$€!|]/g, (c) => (c === '1' ? un : LEET[c])) : mot);
const enClair = (mot, un) => plier(deLeet(versLeLatin(mot.normalize('NFKC')), un));

// Les lectures d’un texte (en NFC, comme l’appli le lit), chacune une liste de mots { ecrit, simple, propre, avant,
// debut, fin } : simple est le mot que cette lecture compare aux listes, propre le mot tel que l’appli le compare (lui
// seul excuse une boisson), avant ce qui le précède (espaces, ponctuation, caractères invisibles). La première lecture
// défait le NFKC, les accents et les capitales ; les deux autres aussi les sosies et l’écriture « leet ».
const lecturesDe = (texte) => {
  const normal = String(texte).normalize('NFC');
  const lire = (motif, comparer) => {
    const mots = [];
    let fin = 0;
    for (const trouve of normal.matchAll(motif)) {
      const ecrit = trouve[0];
      mots.push({ ecrit, simple: comparer(ecrit), propre: commeLAppli(ecrit), avant: normal.slice(fin, trouve.index), debut: trouve.index, fin: trouve.index + ecrit.length });
      fin = trouve.index + ecrit.length;
    }
    return mots;
  };
  return { normal, lectures: [lire(MOT, plier), lire(MOT_LEET, (m) => enClair(m, 'i')), lire(MOT_LEET, (m) => enClair(m, 'l'))] };
};

// Le mot est-il de la liste, tel quel, ses lettres répétées ramenées à une ou deux (« bieeere », « beeeer »), ou
// resserré quand il a une lettre doublée (« bièère » → « biere », s’il garde au moins cinq lettres : « allée » ne
// devient pas « ale », et « chers », sans lettre doublée, n’est pas « cheers » resserré) ? La forme reconnue, ou null.
const deLaListe = (simple, liste) => {
  for (const forme of [simple, simple.replace(/(\p{L})\1{2,}/gu, '$1'), simple.replace(/(\p{L})\1{2,}/gu, '$1$1')]) if (liste.mot.test(forme)) return forme;
  const resserre = resserrer(simple);
  return resserre !== simple && resserre.length >= 5 && liste.resserre.test(resserre) ? resserre : null;
};
const aUneRacine = (simple) => RACINE.test(simple) || RACINE.test(simple.replace(/(\p{L})\1{2,}/gu, '$1'));

// Ce qui peut séparer deux mots d’une même boisson : des espaces sur une ligne, ou un trait d’union collé ; rien d’autre.
const MEME_BOISSON = /^(?:[\p{Zs}\t]+|-)$/u;
// Ce qui peut couper un mot en morceaux (« P i n t e », « B.i.è.r.e », « P-I-N-T-E », « Bi ère ») : peu de chose, sur une
// ligne, sans virgule.
const MORCEAUX = /^[\p{Zs}\t.\-_*·•'’~–—/+\p{Cf}]{1,3}$/u;

// La boisson nommée jusqu’au mot `fin` est-elle dite sans alcool : « sans alcool » juste après elle, ou après d’autres
// mots de la même boisson (« Pinte de bière sans alcool », « Bière blonde sans alcool ») ? Un autre mot, une
// ponctuation, un trait d’union entre espaces ou un retour à la ligne finit la boisson (« Pinte ou soft sans alcool »
// nomme la pinte). Les mots de la boisson et « sans alcool » sont lus comme l’appli les lit.
const diteSansAlcool = (mots, fin) => {
  const lie = (i) => i < mots.length && MEME_BOISSON.test(mots[i].avant);
  let suivant = fin + 1;
  while (suivant <= fin + 3 && lie(suivant) && (mots[suivant].propre === 'de' || MOT_DE_L_APPLI.test(mots[suivant].propre))) suivant += 1;
  return lie(suivant) && mots[suivant].propre === 'sans' && lie(suivant + 1) && mots[suivant + 1].propre === 'alcool';
};

// Le mot (ou les mots) du rang `debut` au rang `fin` est-il excusé : pas une boisson à cet endroit (« demi-tarif »,
// « carton rouge », « mousse au chocolat », « PSG-Monaco »), ou dit sans alcool ? Une exception ne vaut que pour un
// mot entier écrit tel quel, entre des mots écrits tels quels.
const excuse = (mots, debut, fin) => {
  if (debut === fin) {
    const { propre } = mots[debut];
    const avant = mots[debut - 1]?.propre ?? '';
    const apres = mots[fin + 1]?.propre ?? '';
    if (propre.startsWith('alcool') && avant === 'sans') return true;
    if (propre.startsWith('demi') && PAS_UNE_BOISSON_APRES_DEMI.has(apres)) return true;
    if (PAS_UNE_BOISSON_APRES_CARTON.test(propre) && /^cartons?$/.test(avant)) return true;
    if (/^jaunes?$/.test(propre) && (JAUNE_SANS_PASTIS.has(avant) || apres === 'd' || apres === 'œuf' || apres === 'oeuf')) return true;
    if (/^mousses?$/.test(propre) && MOUSSE_A_MANGER.has(apres)) return true;
    if (/^triples?$/.test(propre) && TRIPLE_A_MANGER.has(apres)) return true;
    if (BOISSONS_QUI_SONT_DES_CLUBS.has(propre) && !COCKTAIL_APRES.has(apres)) {
      const affiche = AFFICHE.test(mots[debut].avant) || AFFICHE.test(mots[fin + 1]?.avant ?? '');
      if (affiche || AVANT_UN_CLUB.has(avant) || APRES_UN_CLUB.has(apres) || (avant === 'de' && mots[debut - 2]?.propre === 'girondins')) return true;
    }
  }
  return diteSansAlcool(mots, fin);
};

// Dans une lecture, le premier mot de la liste demandée qui n’est pas excusé : un mot entier, une expression, un mot
// coupé en morceaux ou par un caractère invisible, puis (pour les alcools) une racine dans un mot collé. Le mot tel
// qu’écrit, sans ses caractères invisibles, ou null.
const chercher = (normal, mots, liste, alcool) => {
  const ecrit = (debut, fin) => normal.slice(mots[debut].debut, mots[fin].fin).replace(INVISIBLES, '');
  const trouve = (debut, fin) => (excuse(mots, debut, fin) ? null : ecrit(debut, fin));
  const suite = (expression, rang) => expression.every((mot, i) => mots[rang + i]?.simple === mot);
  for (let rang = 0; rang < mots.length; rang += 1) {
    if (alcool) {
      const pousse = EXPRESSIONS_QUI_POUSSENT.find((expression) => suite(expression, rang));
      if (pousse) return mots.slice(rang, rang + pousse.length).map((m) => m.ecrit).join(' ');
      for (const expression of EXPRESSIONS_DE_BOISSON.filter((e) => suite(e, rang))) {
        const mot = trouve(rang, rang + expression.length - 1);
        if (mot) return mot;
      }
    }
    if (deLaListe(mots[rang].simple, liste)) {
      const mot = trouve(rang, rang);
      if (mot) return mot;
    }
  }
  // Un mot coupé : de deux à douze morceaux à la suite, séparés de presque rien, dont un d’une à trois lettres, qui font
  // ensemble un mot de la liste d’au moins cinq lettres ; ou séparés seulement par des caractères invisibles (un seul
  // mot à l’œil : « Kronen », un espace de largeur nulle, « bourg »), quels qu’ils soient.
  for (let debut = 0; debut < mots.length; debut += 1) {
    let ensemble = mots[debut].simple;
    let court = ensemble.length <= 3;
    let colle = true;
    for (let fin = debut + 1; fin < Math.min(mots.length, debut + 12); fin += 1) {
      const invisible = QUE_DE_L_INVISIBLE.test(mots[fin].avant);
      if (!invisible && !MORCEAUX.test(mots[fin].avant)) break;
      colle &&= invisible;
      ensemble += mots[fin].simple;
      court ||= mots[fin].simple.length <= 3;
      if (!colle && (!court || ensemble.length < 5)) continue;
      if (deLaListe(ensemble, liste) || (alcool && colle && aUneRacine(ensemble))) {
        const mot = trouve(debut, fin);
        if (mot) return mot;
      }
    }
  }
  if (!alcool) return null;
  for (let rang = 0; rang < mots.length; rang += 1) {
    if (!aUneRacine(mots[rang].simple)) continue;
    const mot = trouve(rang, rang);
    if (mot) return mot;
  }
  return null;
};

// Le premier mot du texte qui nomme un alcool, ou à défaut qui l’évoque (« verre »), tel qu’écrit (« Bière », « Happy
// hour », « b1ère », « P i n t e ») ; null s’il n’y en a aucun.
export const motDAlcool = (texte) => {
  if (!texte) return null;
  const { normal, lectures } = lecturesDe(texte);
  for (const mots of lectures) {
    const mot = chercher(normal, mots, LISTES.alcool, true);
    if (mot) return mot;
  }
  const emoji = normal.match(EMOJI_D_ALCOOL);
  if (emoji) return emoji[0];
  for (const forme of formesDe(texte)) {
    const motif = MOTIFS_D_ALCOOL.find((m) => m.test(forme));
    if (motif) return forme.match(motif)[0];
  }
  for (const mots of lectures) {
    const mot = chercher(normal, mots, LISTES.verre, false);
    if (mot) return mot;
  }
  return null;
};

// ---------- Ce qui pousse à boire ----------

// Le texte entier tel qu’on le compare : plié (NFKC, sans invisibles, sans accents ni capitales), apostrophes et tirets
// ramenés à un seul signe ; puis le même sans sosies ni écriture « leet » (« verre 0ffert », « fr33 », « H4ppy hour »).
const comparable = (texte) => plier(texte).replace(/[’‘ʼ`´]/g, '\'').replace(/[‐‑‒–—―]/g, '-').replace(/\s+/g, ' ').trim();
const formesDe = (texte) => {
  const latin = versLeLatin(String(texte ?? '').normalize('NFKC').replace(INVISIBLES, ''));
  return [comparable(String(texte ?? '')), comparable(latin.replace(MOT_LEET, (m) => deLeet(m, 'i'))), comparable(latin.replace(MOT_LEET, (m) => deLeet(m, 'l')))];
};

const BOISSONS = String.raw`(?:verres?|boissons?|consos?|consommations?|drinks?|glass(?:es)?|pintes?|pints?|bieres?|beers?|demis?|cocktails?|shots?|shooters?|bouteilles?|bottles?|pichets?|godets?|tournees?|rounds?|softs?|cafes?)`;
// Le deuxième (ou le troisième) d’une même chose, sauf la deuxième mi-temps, le 2e arrondissement, la 2e place…
const RANG = String.raw`(?:2\s*(?:e|eme|ieme|em|nde?)|deuxiemes?|seconde?|3\s*(?:e|eme|ieme)|troisiemes?|third)\b(?!\s*(?:mi[\s-]*temps|periode|half|arr\w*|etage|division|tour|place|ligue|journee)\b)`;
const PRIX_ECRIT = String.raw`(?:\d+(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b|balles?\b|\$|£|dollars?\b)|(?:€|\$|£)\s*\d)`;
const GRATUITE = 'elle parle d’une remise ou d’une gratuité';
const POUSSE = 'elle pousse à boire';
// [motif, raison], dans l’ordre où on les cherche ; sans accents ni capitales.
const INCITATIONS = [
  [new RegExp(String.raw`\b(?:${RANG}|next)\s+(?:\w+\s+)?${BOISSONS}\b`), POUSSE],
  [new RegExp(String.raw`\b${RANG}[^.;?]{0,30}?(?:${PRIX_ECRIT}|\bmoitie\b|\bhalf\b|\boffert|\bgratuit|\bfree\b|%)`), POUSSE],
  [/\b\d+\s*\+\s*\d+\b/, POUSSE],
  [/\b(?:\d+|deux|trois|quatre|cinq|two|three|four)\s*(?:pour|for|=)\s*(?:le prix d['\s]*)?(?:\d+|une?|deux|trois|quatre|one|two|three)\b|\bpour le prix d['\s]*une?\b/, POUSSE],
  [/\bbuy\s*(?:\d+|one|two|an?)\b|\bbogof?\b|\bb\s*\d+\s*g\s*\d+\b|\bget\s*(?:\d+|one|an?|the)\b[^.;]{0,20}\bfree\b/, POUSSE],
  [/\bhappy|\bhh\b|\bheures? (?:heureuses?|joyeuses?)\b/, POUSSE],
  [/\ba volonte\b|\ba gogo\b|\billimite\w*|\bunlimited\b|\bopen[\s-]*bars?\b|\bfree[\s-]*flow\b|\ball you can drink\b|\bbottomless\b|\bsans limites?\b|\bautant que (?:tu|vous)\b|\bjusqu'?\s*a plus soif\b/, POUSSE],
  [/\btournees?\b|\brounds?\b|\bla prochaine est pour\b/, POUSSE],
  [/\b(?:a|pour) chaque (?:but|goal|corner|carton|penalty|penalties|essai|victoire|arret)s?\b|\bpar (?:but|goal|corner|carton|penalty)s?\b|\bau (?:1er|premier|1|\d+e|\d+eme|deuxieme) (?:but|goal)s?\b|\b(?:si|quand|des que|des qu') ?(?:\S+ ){0,4}?(?:marque\w*|gagne\w*|bat|battent|l'emporte|egalise\w*|scores?)\b|\b(?:but|goal) ?=|\b(?:per|every) goal\b/, POUSSE],
  [/\bboire\b|\bbuv(?:ez|ons)\b|\btrinqu\w*|\bpicol\w*|\bsiroter\b|\bcul sec\b|\bbois (?:un|une|des|ton|ta)\b|\bon boit\b/, POUSSE],
  [/\bfree\b|\bfreebies?\b|\bgratis\b|\bgratos\b|\bgratuite?s?\b|\boffert\w*|\boffre (?:la|le|une?|ta|ton|sa|son|leur)\b|\b(?:on|bar|maison|patron|nous|je|chef) (?:t'|te |vous )?offr\w*|\bcadeaux?\b|\bon the house\b|\bcomplimentary\b|\baux frais de la maison\b|\ba l'? ?oeil\b|\b(?:maison|patron|bar|on|je|nous|qui) regale\b/, GRATUITE],
  [/\bmoitie prix\b|\bhalf[\s-]*price\b|\b\d+\s*% off\b|\bdiscounts?\b|\bdeals?\b|\bsoldes?\b|\bprix (?:casses?|mini|bas|doux)\b|\bpetits? prix\b|\btwo for one\b/, GRATUITE],
];
// « gluten free », « sugar free » ne sont pas gratuits.
const SANS_QUELQUE_CHOSE = /\b(?:gluten|sugar|lactose|dairy|nut|meat|fat|cage)[\s-]*free\b/g;

// Ce qui, dans le titre d’une offre, pousse à boire ({ extrait, raison }), ou null. Lu aussi sans sosies ni « leet ».
export const incitationABoire = (titre) => {
  for (const forme of formesDe(titre).map((f) => f.replace(SANS_QUELQUE_CHOSE, ' '))) {
    for (const [motif, raison] of INCITATIONS) {
      const trouve = forme.match(motif);
      if (trouve) return { extrait: trouve[0].trim(), raison };
    }
  }
  return null;
};

// ---------- Une boisson sans nom avec un prix ----------

const BOISSON_SANS_NOM = /\b(?:verres?|boissons?|consos?|consommations?|drinks?|glass(?:es)?|rafraichissements?)\b/;
const PRIX_OU_REMISE = new RegExp(String.raw`${PRIX_ECRIT}|\b(?:un|deux|trois|quatre|cinq|dix) euros?\b|%|\bmoitie\b|\bhalf\b|\bprix\b|\btarifs?\b|\boffert|\bgratuit|\bfree\b|\bremises?\b|\breduc\w*|\bpromo\w*`);

// Une boisson dont le titre ne dit pas ce qu’elle est (« boisson », « conso », « drink »), avec un prix écrit dans le
// titre, une remise, une gratuité, ou un prix de 0 € : « Boisson à 2 € », « Deuxième conso à moitié prix », « Conso du
// match » à 0 €. Le site ne sait pas si c’est de l’alcool ; il ne l’écrit pas. « Menu burger et boisson fraîche » à
// 15 € se publie : le prix est celui du menu. L’extrait, ou null.
export const boissonAvecUnPrix = (titre, prixCentimes = null) => {
  for (const forme of formesDe(titre)) {
    const boisson = forme.match(BOISSON_SANS_NOM);
    if (!boisson) continue;
    const prix = forme.match(PRIX_OU_REMISE);
    if (prix) return `${boisson[0]} … ${prix[0].trim()}`;
    if (prixCentimes === 0) return `${boisson[0]} … 0 €`;
  }
  return null;
};

// ---------- Les caractères ----------

// Les seuls caractères d’un titre publié : lettres latines (celles du français et de l’Europe de l’Ouest, sans les
// lettres qui ressemblent à d’autres : ni « Ð », ni « Þ »), chiffres, espaces (l’insécable et la fine aussi) et une
// ponctuation simple. Ni « ! », ni « = », ni « ° », ni « @ » ; aucun emoji, aucune autre écriture, aucun caractère
// invisible.
const PERMIS = /^[A-Za-z0-9À-ÏÑ-ÖØ-Ýß-ïñ-öø-ýÿŒœŸ \u{A0}\u{2009}\u{202F}.,'’\-–—:;()/+&€%?«»"“”·…]$/u;

// Le premier caractère du titre que le site ne publie pas (« 🍺 », « В », « Ｂ »), ou null.
export const caractereNonPermis = (titre) => [...String(titre ?? '').normalize('NFC')].find((c) => !PERMIS.test(c)) ?? null;
