// Loi Evin : ce qui, dans le titre d’une offre de bar, empêche le site de le publier. Le site ne publie le titre d’une
// offre que s’il est sûr qu’elle ne nomme ni n’évoque un alcool et ne pousse pas à boire ; sinon, à sa place, « Une
// offre du bar dans l’appli » (donnees.mjs, offreDe). Cinq lectures indépendantes, chacune suffit à écarter l’offre :
// une de trop n’écarte qu’une offre sans danger (elle reste dans l’appli), une de moins publierait de l’alcool.
//  1. Les caractères (caractereNonPermis) : un titre ne se publie que s’il n’a que des lettres latines (accents
//     français compris), des chiffres, des espaces et une ponctuation simple. Un emoji (« 🍺 »), un symbole, une lettre
//     d’un autre alphabet qui ressemble aux nôtres (« Віère » en cyrillique), une lettre pleine chasse (« Ｂｉèｒｅ »),
//     un caractère invisible l’écartent : ce que le site publie n’a que des caractères qu’il sait lire.
//  2. Les mots qui nomment un alcool, ou l’évoquent (motDAlcool) : la liste de l’appli (décision du 12 octobre 2026 :
//     mots entiers, sans accents ni capitales, pluriel compris ; « demi » avant « tarif » ou « heure » n’est pas une
//     boisson, ni « rouge » après « carton ») et celle, plus longue, du site (boissons en français et en anglais,
//     cocktails, alcools forts, styles de bière, vins, marques, argot, fautes courantes), puis ce qui évoque un verre
//     sans dire ce qu’il y a dedans (« verre », « conso », « drink », « bouteille », « 50 cl »). Un mot est lu comme un
//     humain le lit : en NFKC (pleine chasse, lettres mathématiques, ligatures), sans caractères invisibles, sans
//     accents ni capitales ; puis dans d’autres formes qui défont l’écriture « leet » (« b1ère », « V3rre »), les
//     lettres d’autres alphabets qui ressemblent aux nôtres, et le « l » pris pour un « I » (« PlNTE »). Les lettres
//     répétées (« Bièèère »), les mots coupés (« P i n t e », « B,i,è,r,e », « Kronen-bourg », « Bi ère »), les mots
//     collés (« Craftbeer », « Jägerbomb », par leur racine) et une faute de frappe sur un nom de boisson
//     (« Coktail », « Wisky », « Champange ») sont reconnus.
//  3. Ce qui pousse à boire (incitationABoire) : le deuxième verre, « 2+1 », « 2 pour 1 », « 3 au prix de 2 », « buy
//     one », « BOGO », la gratuité (« free », « offert », « on the house »), l’heure heureuse sous toutes ses formes,
//     « à volonté », « open bar », « sans modération », la tournée, la récompense d’un but ou d’une victoire, les verbes
//     de la boisson (« boire », « trinquer ») et les toasts (« À la vôtre »).
//  4. Une boisson sans nom avec un prix (boissonAvecUnPrix) : « boisson », « consommation », « rafraîchissement »
//     avec un prix (écrit dans le titre, ou celui que le bar a donné, que la page écrit à côté), une remise ou une
//     gratuité. Le site ne sait pas ce qu’il y a dans le verre ; il ne met pas de prix dessus.
//  5. Le prix lui-même (prixOffert) : 0 € (ou moins) est une gratuité, que le site n’écrit pas plus que « offert ».
// Un mot déguisé peut nommer un alcool, jamais l’excuser : « sans alcool » (la seule échappatoire, comme dans l’appli),
// « demi-tarif », « carton rouge » et les exceptions du site ne valent qu’écrits tels quels, lus comme l’appli les lit
// (ni « sans alc00l », ni « sans аlcool » en cyrillique, ni « ｓａｎｓ ａｌｃｏｏｌ »). La liste ne peut qu’écarter plus
// d’offres que l’appli, jamais moins : les exceptions du site (« mousse au chocolat », « carton jaune », « PSG-Monaco »,
// « œufs mimosa ») ne portent que sur des mots que l’appli ne lit pas.

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
  // L’argot de la bière et du vin, les mots d’un comptoir, l’ivresse.
  'binouzes?', 'bibines?', 'girafes?', 'mousses?', 'bulles?', 'mousseux', 'cervoises?', 'futs?', 'tireuses?', 'pinards?',
  'jaja', 'piquettes?', 'pastagas?', 'jaunes?', 'perroquets?', 'mauresques?', 'tangos?', 'monacos?', 'despes?', 'grim',
  'grimb', 'digeos?', 'gnoles?', 'champ', 'arrosee?s?', 'afterworks?', 'soif', 'assoiffee?s?', 'ivres?', 'pompettes?',
  'tchin', 'tchintchin', 'cheers', 'spiritueux', 'rouquins?', 'picrates?', 'communards?', 'litrons?', 'cuvees?',
  'houblons?', 'houblonnee?s?', 'microbrasseries?', 'brasseurs?', 'ivresses?', 'emechee?s?', 'saoule?s?', 'murges?',
  'bourree?s?', 'rousses?', 'bierpong', 'beerpong', 'prost', 'skol', 'chopines?', 'tonneaux?', 'barriques?',
  // La dégustation, la cave, la vigne, la distillerie, le bar à cocktails.
  'degustations?', 'oenologi\\w*', 'sommelier\\w*', 'cavistes?', 'zythologi\\w*', 'vignobles?', 'vigneron\\w*', 'cepages?',
  'millesimee?s?', 'distilleries?', 'distillery', 'mixologi\\w*', 'mixologues?',
  // Des fautes courantes, que la faute de frappe (une lettre) ne rattrape pas.
  'coktails?', 'coctails?', 'cocktels?', 'coquetels?', 'wisky', 'wiskies', 'wiskey', 'tekilas?', 'tequilla', 'vodcas?',
  'wodkas?', 'sprits', 'mohitos?', 'aperitives?', 'aperitifes?', 'liquores?',
  // L’anglais d’un bar.
  'beers?', 'pints?', 'wines?', 'ciders?', 'ales?', 'crafts?', 'drafts?', 'draughts?', 'booze', 'boozy', 'liquors?',
  'bubbly', 'bubbles', 'brandy', 'brandies', 'rums?', 'scotch', 'sherry', 'alcohol', 'alcoholic', 'tipsy', 'drunk',
  'hangovers?', 'brewskis?', 'brewery', 'breweries', 'brewpubs?', 'brewers?', 'taprooms?', 'hops', 'hoppy', 'bevvy',
  'bevvies', 'plonk', 'hooch', 'moonshine', 'spirits', 'nightcaps?', 'sundowners?', 'porters?', 'radlers?', 'shandy',
  'shandies', 'mimosas?', 'boulevardiers?', 'sazeracs?', 'juleps?', 'kamikazes?', 'pornstar', 'cosmos?', 'michelada',
  'calimocho', 'kalimotxo', 'tinto', 'batidas?', 'suds', 'mead', 'dipas?', 'pisang', 'midori', 'amarula', 'sauza',
  // Les bières : styles, langues, marques.
  'birras?', 'cervezas?', 'cervejas?', 'bier', 'pivo', 'piwo', 'ipas?', 'neipas?', 'pils', 'pilsners?', 'pilsens?',
  'krieks?', 'gueuzes?', 'geuzes?', 'lambics?', 'tripels', 'triples?', 'quadrupels?', 'quadruples?', 'dubbels?', 'weiss',
  'weissbier', 'hefeweizen', 'witbier', 'malts?', 'trappistes?', 'gose', 'dunkel', 'helles', 'kolsch', 'altbier',
  'peroni', 'moretti', 'estrella', 'damm', 'mahou', 'amstel', 'tuborg', 'becks?', 'brewdog', 'bavaria', 'jupiler',
  'maes', 'westmalle', 'orval', 'kasteel', 'jenlain', 'anosteke', 'kilkenny', 'smithwicks?', 'magners', 'strongbow',
  'somersby', 'kopparberg', 'rekorderlig', 'bulmers', 'asahi', 'kirin', 'sapporo', 'tsingtao', 'singha', 'kingfisher',
  'coors', 'michelob', 'modelo', 'pacifico', 'tecate', 'quilmes', 'brahma', 'cusquena', 'bud', 'fischer', 'skoll',
  'adelscott', 'lagunitas', 'tourtel', 'kanterbrau', 'meteor', 'franziskaner', 'erdinger', 'weihenstephaner?',
  'augustiner', 'spaten', 'lowenbrau', 'warsteiner', 'bitburger', 'krombacher', 'holsten', 'grolsch', 'hertog', 'vedett',
  'achel', 'budvar', 'staropramen', 'kozel', 'tyskie', 'zywiec', 'efes', 'mythos', 'menabrea', 'ichnusa', 'nastro',
  'cruzcampo', 'sagres', 'fosters', 'tusker', 'carling', 'lindemans', 'timmermans', 'barbar', 'lupulus',
  // Les alcools forts, les liqueurs, et leurs marques.
  'kirsch', 'cachaca', 'pisco', 'soju', 'shochu', 'baijiu', 'sakes?', 'grappas?', 'ouzos?', 'rakis?', 'rakias?',
  'araks?', 'arrack', 'sambucas?', 'limoncellos?', 'amarettos?', 'anisettes?', 'vermouths?', 'portos?', 'xeres',
  'pineaus?', 'pommeaus?', 'ratafias?', 'hypocras', 'chouchen', 'hydromels?', 'muscats?', 'gentianes?', 'calva',
  'genepis?', 'schnapps', 'akvavit', 'aquavit', 'palinka', 'slivovitz', 'tsipouro', 'pulque', 'makgeolli', 'chambord', 'cynar', 'averna', 'ramazzotti', 'fireball', 'floc', 'macvin', 'banyuls', 'rivesaltes', 'chivas',
  'glenfiddich', 'glenlivet', 'lagavulin', 'laphroaig', 'talisker', 'ballantines?', 'johnnie', 'lawsons?', 'nikka',
  'suntory', 'yamazaki', 'hennessy', 'martell', 'courvoisier', 'cointreau', 'marnier', 'kahlua', 'disaronno',
  'frangelico', 'chartreuse', 'benedictine', 'izarra', 'fernet', 'underberg', 'casanis', 'byrrh', 'dubonnet', 'noilly',
  'cinzano', 'pimms?', 'passoa', 'zubrowka', 'eristoff', 'poliakov', 'sobieski', 'ciroc', 'gordons', 'havana', 'kraken',
  'bumbu', 'zacapa', 'neisson', 'glenmorangie', 'macallan', 'ardbeg', 'aberlour', 'bowmore', 'bushmills', 'tullamore',
  'redbreast', 'heine', 'diplomatico', 'damoiseau', 'cuervo', 'olmeca', 'tanqueray', 'hendricks', 'beefeater', 'jager', 'jagerbombs?',
  // Les cocktails.
  'hugo', 'mules?', 'planteurs?', 'caipis?', 'caipiroskas?', 'cosmopolitans?', 'gimlets?', 'grogs?', 'b52', 'tipunchs?',
  'gintonics?',
  // Les vins : langues, régions, appellations, cépages, champagnes.
  'vinos?', 'vinho', 'wein', 'gluhwein', 'spumante', 'sekt', 'bordeaux', 'bourgognes?', 'chablis', 'sancerres?',
  'riojas?', 'chiantis?', 'lambruscos?', 'valpolicella', 'barolo', 'franciacorta', 'tokaji', 'retsina', 'rieslings?',
  'gewurztraminer', 'sylvaner', 'pinots?', 'syrahs?', 'shiraz', 'cabernets?', 'sauvignons?', 'malbecs?', 'gamays?',
  'grenaches?', 'viogniers?', 'chenins?', 'mourvedre', 'carignan', 'cinsault', 'semillon', 'tempranillo', 'sangiovese',
  'nebbiolo', 'primitivo', 'zinfandel', 'albarino', 'verdejo', 'picpoul', 'vouvray', 'medoc', 'pomerol', 'sauternes',
  'gaillac', 'jurancon', 'tavel', 'bandol', 'chateauneuf', 'brouilly', 'morgon', 'pouilly', 'bourgueil', 'hermitage',
  'gigondas', 'vacqueyras', 'cairanne', 'minervois', 'corbieres', 'fitou', 'madiran', 'monbazillac', 'moet', 'chandon',
  'clicquot', 'ruinart', 'taittinger', 'mumm', 'pommery', 'perignon', 'krug', 'bollinger', 'feuillatte',
];
export const MOTS_D_ALCOOL = [...MOTS_DE_L_APPLI, ...MOTS_DU_SITE];
// Ce qui évoque un verre sans dire ce qu’il y a dedans : dans un bar, un verre, une conso, une bouteille, un seau sont
// d’alcool tant que le texte ne dit pas « sans alcool ». Lus après les mots qui nomment un alcool (« Verre de vin »
// nomme le vin).
export const MOTS_D_UN_VERRE = [
  'verres?', 'glass(?:es)?', 'consos?', 'drinks?', 'godets?', 'bouteilles?', 'bottles?', 'seaux?', 'buckets?', 'carafes?',
  'pitchers?', 'jugs?', 'chopes?', 'canettes?', 'cannettes?', 'jeroboams?', 'magnums?', 'kegs?', 'growlers?',
  'tankards?', 'chasers?',
];
// Une boisson qui ne dit pas ce qu’elle est : publiée seule, écartée avec un prix (boissonAvecUnPrix).
export const MOTS_D_UNE_BOISSON = ['boissons?', 'consommations?', 'rafraichissements?', 'breuvages?', 'elixirs?', 'beverages?', 'refreshments?'];

// Le mot sans ses lettres répétées (« bieeere » → « biere ») : comparé à la liste resserrée de la même façon.
const resserrer = (mot) => mot.replace(/(\p{L})\1+/gu, '$1');
const exact = (motifs) => new RegExp(`^(?:${motifs.join('|')})$`);
const liste = (motifs) => ({ mot: exact(motifs), resserre: exact(motifs.map(resserrer)) });
const LISTES = { alcool: liste(MOTS_D_ALCOOL), verre: liste(MOTS_D_UN_VERRE), boisson: liste(MOTS_D_UNE_BOISSON) };
// Les mots qu’une boisson peut porter avant son « sans alcool » : ceux de l’appli, comme elle (« Pinte de bière blonde
// sans alcool »).
const MOT_DE_L_APPLI = exact(MOTS_DE_L_APPLI);
// Une racine d’alcool dans un mot collé à un autre (« Craftbeer », « Superbière », « Jägerbomb », « Bièrepong ») : des
// racines longues, qu’aucun mot sans danger d’une offre ne contient (ni « gingembre », ni « screenshot », ni « pintade »,
// ni « rumsteak », ni « gibier »).
const RACINE = /biere|beer|pinte|vodka|whiske?y|wisky|tequila|tekila|cocktail|coktail|champagne|jager|mojito|spritz|aperol|apero|aperiti|sangria|alcool|alcohol|booze|binouze|heineken|guinness|kronenbourg|ricard|pastis|bacardi|smirnoff|absinth|bourbon|cognac|armagnac|prosecco|liqueur|mezcal|daiquiri|negroni|margarita|caipi|limoncello|amaretto|grappa|cidre|cider|wine|lambrusco|chardonnay|sauvignon|cabernet|merlot|brewdog|desperados|leffe|grimbergen|hoegaarden|carlsberg|budweiser|spiritueux|rhum|gintonic|houblon|brewsk|brewer|taproom/;
// Les noms de boisson assez longs et assez rares pour qu’une faute de frappe d’une lettre (une lettre changée, ajoutée,
// oubliée, ou deux lettres inversées) les nomme encore : « Coktail », « Wisky », « Champange », « Guiness ». Ni les
// couleurs, ni l’argot court (« blanche » est à une lettre de « planche »).
const NOMS_A_UNE_FAUTE_PRES = [
  'biere', 'cocktail', 'champagne', 'tequila', 'whisky', 'whiskey', 'vodka', 'mojito', 'aperitif', 'apero', 'spritz',
  'aperol', 'campari', 'cognac', 'bourbon', 'martini', 'negroni', 'bellini', 'sangria', 'liqueur', 'margarita',
  'caipirinha', 'daiquiri', 'prosecco', 'absinthe', 'limoncello', 'amaretto', 'jagermeister', 'bacardi', 'smirnoff',
  'chardonnay', 'sauvignon', 'cabernet', 'merlot', 'muscadet', 'beaujolais', 'lambrusco', 'calvados', 'armagnac',
  'vermouth', 'hydromel', 'cervoise', 'spiritueux', 'binouze', 'alcool', 'heineken', 'kronenbourg', 'guinness',
  'desperados', 'grimbergen', 'hoegaarden', 'carlsberg', 'budweiser', 'pelforth', 'affligem', 'leffe', 'corona',
];
// Les mots sans danger à une lettre d’un de ces noms : « Pain de campagne », « Tiramisu aux amaretti », « Chez Martin »,
// « fière », « muscade », « bourdon ».
const PROCHES_SANS_DANGER = new Set(['campagne', 'campagnes', 'amaretti', 'martin', 'martine', 'martins', 'fiere', 'fieres', 'muscade', 'muscades', 'bourdon', 'bourdons']);

// Plusieurs mots qui ne nomment un alcool qu’ensemble. Ceux qui sont une boisson échappent à la liste suivis de « sans
// alcool » ; l’heure heureuse, l’afterwork, le cul sec, la gueule de bois jamais.
const EXPRESSIONS_DE_BOISSON = [
  'cuba libre', 'bloody mary', 'long island', 'mai tai', 'sex on the beach', 'irish coffee', 'white russian',
  'black russian', 'old fashioned', 'dark n stormy', 'blue lagoon', 'kir royal', 'cotes du rhone', 'cote du rhone',
  'cotes de provence', 'saint emilion', 'st emilion', 'entre deux mers', 'mort subite', 'blue moon', 'san miguel',
  'gulden draak', 'goose island', 'red stripe', 'dos equis', 'white claw', '33 export', 'jack daniel', 'jack daniels',
  'jack coke', 'jim beam', 'grey goose', 'captain morgan', 'get 27', 'get 31', 'label 5', 'clan campbell', 'remy martin',
  'laurent perrier', 'loic raison', 'licor 43', 'cutty sark', 'famous grouse', 'monkey shoulder', 'poire williams',
  'vieille prune', 'blue curacao', 'creme de cassis', 'creme de mure', 'creme de peche', 'triple sec', 'trou normand',
  'feuille morte', 'eau de vie', 'eaux de vie', 'tord boyaux', 'pousse cafe', 'on tap', 'hard seltzer',
  'seize soixante quatre', 'don papa', 'trois rivieres', 'flip cup', 'grand cru', 'grands crus', 'premier cru',
  'premiers crus', 'cold one', 'cold ones', 'tia maria', 'southern comfort', 'makers mark', 'bombay sapphire', 'monkey 47',
  'don julio',
].map((e) => e.split(' '));
const EXPRESSIONS_QUI_POUSSENT = [
  'happy hour', 'happy hours', 'heure heureuse', 'heures heureuses', 'after work', 'after works', 'cul sec', 'pub crawl',
  'gueule de bois',
].map((e) => e.split(' '));
// Ce qui nomme un alcool sans être un mot : « G&T », « V&T », « J&B », « B-52 », « une 8.6 », « un 51 », « un 102 », et les emoji
// des boissons d’alcool (le premier filet : un emoji ne passe déjà pas la liste des caractères permis).
const MOTIFS_D_ALCOOL = [
  /\b[gvj]\s*&\s*[tb]\b/, /\bb\s*-?\s*52\b/, /\b8[.,]6\b/, /\b(?:un|une|le|du|au|ton|mon) (?:51|102)\b(?!\s*(?:€|eur|%|cl|ans?\b|min))/,
  // « Sans alcool », puis un clin d’œil qui le reprend : « ou pas », « ou presque », « ou avec ».
  /\bsans alcool\W+(?:\w+\W+){0,2}?(?:ou|or) (?:pas|presque|avec|non|not|plus)\b/,
  // Le degré d’alcool : « 5 % vol », « 8 degrés », « 12° ».
  /\b\d+(?:[.,]\d+)?\s*(?:%|°)\s*(?:vol|alc|abv)\b|\babv\b|\b\d+(?:[.,]\d+)?\s*degres?\b/,
];
// Deux mots qui ne sont des alcools qu’avec leur accent (« poire », « soul » sont sans danger).
const AVEC_LEUR_ACCENT = /(?<![\p{L}\p{M}])(?:poirés?|soûle?s?)(?![\p{L}\p{M}])/u;
const EMOJI_D_ALCOOL = /[\u{1F376}-\u{1F37B}\u{1F37E}\u{1F942}\u{1F943}]/u;
// Ce qui évoque un verre sans être un mot : un volume (« 50 cl », « 1 L », « 33cl ») ou « 1/2 » pour un demi (sauf
// « 1/2 finale », « 1/2 tarif »…).
const MOTIFS_D_UN_VERRE = [
  /\b\d+(?:[.,]\d+)?\s*(?:cl|centilitres?|ml|millilitres?|l|litres?|liters?|oz)\b(?!['’])/,
  /\b1\s*\/\s*2\b(?!\s*(?:tarifs?|heures?|prix|finales?|journee|douzaine|portions?|pension|saison|mi[\s-]*temps|baguette|poulet)\b)/,
];

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
// « mimosa » (le cocktail) n’en est pas un après « œufs ».
const MIMOSA_A_MANGER = new Set(['oeuf', 'oeufs', 'œuf', 'œufs']);
// Trois noms de vin qui sont aussi des clubs : ce sont des clubs dans une affiche (« PSG-Monaco », « FC Porto »,
// « Girondins de Bordeaux », « Monaco contre Lens »), pas avant un mot de cocktail (« Porto-tonic »).
const BOISSONS_QUI_SONT_DES_CLUBS = new Set(['porto', 'monaco', 'bordeaux']);
const AVANT_UN_CLUB = new Set(['fc', 'as', 'asm', 'girondins', 'contre', 'vs', 'versus', 'v', 'face']);
const APRES_UN_CLUB = new Set(['contre', 'vs', 'versus', 'v']);
const COCKTAIL_APRES = new Set(['tonic', 'blanc', 'rouge', 'rose', 'flip', 'grenadine', 'menthe', 'citron', 'peche', 'cassis', 'sirop', 'orgeat']);
const AFFICHE = /[-–—/]/;

// ---------- Lire un mot comme un humain le lit ----------

// Les caractères invisibles (de format, de remplissage) qui coupent un mot sans se voir : un espace de largeur nulle, un
// trait d’union conditionnel, un remplissage hangûl, un blanc braille.
const INVISIBLES = /[\p{Cf}\u{34F}\u{115F}\u{1160}\u{17B4}\u{17B5}\u{180E}\u{2800}\u{3164}\u{FFA0}]/gu;
const QUE_DE_L_INVISIBLE = /^[\p{Cf}\u{180E}\u{2800}]+$/u;
// Les lettres que la décomposition Unicode ne sépare pas de leur accent.
const LETTRES = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ı: 'i', ð: 'd', þ: 'th', ħ: 'h', ŀ: 'l' };
// Un mot tel que l’appli le compare : minuscules, sans accents. Seul ce mot-là peut excuser une
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
  ß: 'b',
};
const SOSIE = new RegExp(`[${Object.keys(SOSIES).join('')}]`, 'gu');
const versLeLatin = (texte) => texte.replace(SOSIE, (c) => SOSIES[c]);
// L’écriture « leet » : un chiffre ou un symbole à la place d’une lettre, dans un mot qui a au moins une lettre (« b1ère »,
// « V3rre », « 0ffert », « Bi€re », « $hot », « 8ière », « 6in ») ; un nombre seul (« 1664 », « 5 € ») reste un nombre.
// « 1 » se lit « i » puis « l » (« b1ère », « 1ager »).
const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '€': 'e', '!': 'i', '|': 'l' };
const MOT = /[\p{L}\p{M}\p{N}]+/gu;
const MOT_LEET = /[\p{L}\p{M}\p{N}@$€!|]+/gu;
const deLeet = (mot, un) => (/\p{L}/u.test(mot) ? mot.replace(/[01345-9@$€!|]/g, (c) => (c === '1' ? un : LEET[c])) : mot);
// Un « l » minuscule dans un mot en capitales se lit « I » (« PlNTE », « BlÈRE ») ; un « I » capitale dans un mot qui a
// des minuscules se lit « l » (« Iager », « bIonde »).
const lPourI = (mot) => {
  const autres = mot.replace(/l/g, '');
  if (mot.includes('l') && /\p{Lu}/u.test(autres) && !/\p{Ll}/u.test(autres)) return mot.replace(/l/g, 'I');
  return mot.includes('I') && /\p{Ll}/u.test(mot) ? mot.replace(/I/g, 'l') : mot;
};
const enClair = (mot, un, lEtI = false) => {
  const latin = versLeLatin(mot.normalize('NFKC'));
  return plier(deLeet(lEtI ? lPourI(latin) : latin, un));
};

// Les lectures d’un texte (en NFC, comme l’appli le lit) : { mots, flou }, mots étant une liste de { ecrit, simple,
// propre, avant, debut, fin } : simple est le mot que cette lecture compare aux listes, propre le mot tel que l’appli le
// compare (lui seul excuse une boisson), avant ce qui le précède (espaces, ponctuation, caractères invisibles) ; lire
// redonne la forme comparée d’un morceau de texte (un mot coupé, recollé). La première lecture défait le NFKC, les
// accents et les capitales ; les deux suivantes aussi les sosies et l’écriture « leet » ; les deux dernières prennent
// en plus un « l » pour un « I » et l’inverse (« PlNTE », « Iager »). Une faute de frappe ne se cherche que dans la
// première (flou) : un mot déguisé n’a pas en plus une faute.
const lecturesDe = (texte) => {
  const normal = String(texte).normalize('NFC');
  const lecture = (motif, lire, flou) => {
    const mots = [];
    let fin = 0;
    for (const trouve of normal.matchAll(motif)) {
      const ecrit = trouve[0];
      mots.push({ ecrit, simple: lire(ecrit), propre: commeLAppli(ecrit), avant: normal.slice(fin, trouve.index), debut: trouve.index, fin: trouve.index + ecrit.length });
      fin = trouve.index + ecrit.length;
    }
    return { mots, lire, flou };
  };
  return {
    normal,
    lectures: [
      lecture(MOT, plier, true),
      lecture(MOT_LEET, (m) => enClair(m, 'i'), false),
      lecture(MOT_LEET, (m) => enClair(m, 'l'), false),
      lecture(MOT_LEET, (m) => enClair(m, 'i', true), false),
      lecture(MOT_LEET, (m) => enClair(m, 'l', true), false),
    ],
  };
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
// a et b sont-ils à une faute près : une lettre changée, ajoutée ou oubliée, ou deux lettres voisines inversées ?
const aUneFautePres = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
};
// Le mot (d’au moins cinq lettres, au pluriel ou non) est-il un nom de boisson à une faute près ?
const aUneFauteDUnNom = (simple) => {
  if (simple.length < 5 || PROCHES_SANS_DANGER.has(simple)) return false;
  const singulier = simple.replace(/[sx]$/, '');
  return NOMS_A_UNE_FAUTE_PRES.some((nom) => aUneFautePres(simple, nom) || (singulier !== simple && !PROCHES_SANS_DANGER.has(singulier) && aUneFautePres(singulier, nom)));
};

// Ce qui peut séparer deux mots d’une même boisson : des espaces sur une ligne, ou un trait d’union collé ; rien d’autre.
const MEME_BOISSON = /^(?:[\p{Zs}\t]+|-)$/u;
// Ce qui peut couper un mot en morceaux, sur une ligne : sans espace (« Kronen-bourg », « B.i.è.r.e », « Pin_te »), avec
// des espaces (« P i n t e », « Bi ère », « Kronen bourg »), et, entre des lettres seules, une virgule ou un
// point-virgule aussi (« B,i,è,r,e »).
const COLLE = /^[.\-_*·•'’~–—/+\p{Cf}]{1,3}$/u;
const ESPACE = /^[\p{Zs}\t.\-_*·•'’~–—/+\p{Cf}]{1,3}$/u;
const ENTRE_DES_LETTRES = /^[\p{Zs}\t.,;:\-_*·•'’~–—/+\p{Cf}]{1,3}$/u;
// Les mots-outils, entiers : un mot coupé ne passe pas par eux (« Pomme au four » n’est pas « pommeau »).
const NOMBRE = /^\p{N}+$/u;
const MOTS_OUTILS = new Set(['au', 'aux', 'du', 'des', 'les', 'une', 'et', 'ou', 'en', 'pour', 'avec', 'sur', 'sous', 'par', 'chez', 'dans', 'the', 'of', 'and', 'or', 'with', 'for', 'to', 'at', 'on', 'in']);

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
    if (/^mimosas?$/.test(propre) && MIMOSA_A_MANGER.has(avant)) return true;
    if (BOISSONS_QUI_SONT_DES_CLUBS.has(propre) && !COCKTAIL_APRES.has(apres)) {
      const affiche = AFFICHE.test(mots[debut].avant) || AFFICHE.test(mots[fin + 1]?.avant ?? '');
      if (affiche || AVANT_UN_CLUB.has(avant) || APRES_UN_CLUB.has(apres) || (avant === 'de' && mots[debut - 2]?.propre === 'girondins')) return true;
    }
  }
  return diteSansAlcool(mots, fin);
};

// Dans une lecture, le premier mot de la liste demandée qui n’est pas excusé : un mot entier, une expression, un mot
// coupé en morceaux ou par un caractère invisible, puis (pour les alcools) une racine dans un mot collé et un nom de
// boisson à une faute près. Le mot tel qu’écrit, sans ses caractères invisibles, ou null.
const chercher = (normal, { mots, lire, flou }, liste, alcool) => {
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
  const mot = motCoupe(mots, lire, liste, alcool, flou, trouve);
  if (mot || !alcool) return mot;
  for (let rang = 0; rang < mots.length; rang += 1) {
    const { simple } = mots[rang];
    if (!aUneRacine(simple) && !(flou && aUneFauteDUnNom(simple))) continue;
    const mot = trouve(rang, rang);
    if (mot) return mot;
  }
  return null;
};

// Un mot coupé : de deux à douze morceaux à la suite, recollés tels qu’écrits puis lus (« P 1 n t e » se lit
// « pinte »). Coupé seulement par des caractères invisibles (un seul mot à l’œil : « Kronen », un espace de largeur
// nulle, « bourg ») : un mot de la liste, une racine, une faute de frappe. Coupé sans espace (« Kronen-bourg »,
// « Cock.tail ») : un mot de la liste, une faute de frappe. Lettre par lettre (« V i n », « B,i,è,r,e ») : un mot de la
// liste d’au moins trois lettres, une racine. Avec des espaces (« Bi ère », « Kronen bourg ») : un mot de la liste d’au
// moins cinq lettres, jamais à travers un mot-outil (« Pomme au four » n’est pas « pommeau »). Le plus long mot reconnu
// (« B.i.è.r.e », pas « B.i.è.r »), tel qu’écrit, ou null.
const motCoupe = (mots, lire, liste, alcool, flou, trouve) => {
  for (let debut = 0; debut < mots.length; debut += 1) {
    let brut = mots[debut].ecrit;
    let invisible = true;
    let colle = true;
    let lettres = [...mots[debut].ecrit].length === 1;
    let plusLong = -1;
    for (let fin = debut + 1; fin < Math.min(mots.length, debut + 12); fin += 1) {
      const { avant, ecrit, simple } = mots[fin];
      const seule = [...ecrit].length === 1;
      const cache = QUE_DE_L_INVISIBLE.test(avant);
      const sansEspace = cache || COLLE.test(avant);
      if (!sansEspace && !ESPACE.test(avant) && !(lettres && seule && ENTRE_DES_LETTRES.test(avant))) break;
      if (!sansEspace && (MOTS_OUTILS.has(simple) || MOTS_OUTILS.has(mots[fin - 1].simple))) break;
      // Un nombre n’est un morceau de mot que lettre par lettre (« P 1 n t e », pas « past 15 »).
      if (!(lettres && seule) && (NOMBRE.test(ecrit) || NOMBRE.test(mots[fin - 1].ecrit))) break;
      invisible &&= cache;
      colle &&= sansEspace;
      lettres &&= seule;
      brut += ecrit;
      const ensemble = lire(brut);
      const longueur = colle || lettres ? 3 : 5;
      const reconnu = ensemble.length >= longueur && (deLaListe(ensemble, liste)
        || (alcool && (invisible || lettres) && aUneRacine(ensemble))
        || (alcool && colle && flou && aUneFauteDUnNom(ensemble)));
      if (reconnu) plusLong = fin;
    }
    const mot = plusLong > debut ? trouve(debut, plusLong) : null;
    if (mot) return mot;
  }
  return null;
};

// Le premier mot du texte qui nomme un alcool, ou à défaut qui l’évoque (« verre », « 50 cl »), tel qu’écrit (« Bière »,
// « Happy hour », « b1ère », « P i n t e ») ; null s’il n’y en a aucun.
export const motDAlcool = (texte) => {
  if (!texte) return null;
  const { normal, lectures } = lecturesDe(texte);
  for (const lecture of lectures) {
    const mot = chercher(normal, lecture, LISTES.alcool, true);
    if (mot) return mot;
  }
  const accent = normal.toLowerCase().match(AVEC_LEUR_ACCENT);
  if (accent) return normal.slice(accent.index, accent.index + accent[0].length);
  const emoji = normal.match(EMOJI_D_ALCOOL);
  if (emoji) return emoji[0];
  const formes = formesDe(texte);
  for (const motifs of [MOTIFS_D_ALCOOL, MOTIFS_D_UN_VERRE]) {
    for (const forme of formes) {
      const motif = motifs.find((m) => m.test(forme));
      if (motif) return forme.match(motif)[0];
    }
  }
  for (const lecture of lectures) {
    const mot = chercher(normal, lecture, LISTES.verre, false);
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
const RANG = String.raw`(?:2\s*(?:e|eme|ieme|em|nde?|d)|deuxiemes?|seconde?|3\s*(?:e|eme|ieme)|troisiemes?|third)\b(?!\s*(?:mi[\s-]*temps|periode|half|arr\w*|etage|division|tour|place|ligue|journee)\b)`;
const PRIX_ECRIT = String.raw`(?:\d+(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b|balles?\b|\$|£|dollars?\b)|(?:€|\$|£)\s*\d)`;
// Un nombre, en chiffres ou en lettres : « 2 pour 1 », « deux au prix d’un », « two-for-one ».
const QUANTITE = String.raw`(?:\d+|une?|deux|trois|quatre|cinq|one|two|three|four|five)`;
const PRIX_DE = String.raw`(?:le )?prix d(?:e|')?\s*`;
const GRATUITE = 'elle parle d’une remise ou d’une gratuité';
const POUSSE = 'elle pousse à boire';
// [motif, raison], dans l’ordre où on les cherche ; sans accents ni capitales.
const INCITATIONS = [
  [new RegExp(String.raw`\b(?:${RANG}|next)\s+(?:\w+\s+)?${BOISSONS}\b`), POUSSE],
  [new RegExp(String.raw`\b${RANG}[^.;?]{0,30}?(?:${PRIX_ECRIT}|\bmoitie\b|\bhalf\b|\bof+e?r+t|\bgratuit|\bfree\b|%)`), POUSSE],
  [/\b\d+\s*\+\s*\d+\b/, POUSSE],
  [new RegExp(String.raw`\b(?:\d+|deux|trois|quatre|cinq|two|three|four)[\s-]*(?:pour|for|=|au ${PRIX_DE})[\s-]*(?:${PRIX_DE})?${QUANTITE}\b|\b(?:pour|au) ${PRIX_DE}(?:une?|one|1)\b(?!\s*(?:€|eur))`), POUSSE],
  [/\bbuy\s*(?:\d+|one|two|an?)\b|\bbogof?\b|\bb\s*\d+\s*g\s*\d+\b|\bget\s*(?:\d+|one|an?|the)\b[^.;]{0,20}\bfree\b/, POUSSE],
  [/\bhappy|\bhap+[iy]|\bhh\b|\bh\s*\.\s*h\b|\bheures? (?:heureuses?|joyeuses?)\b|\bhoras? feli(?:z|ces)\b|\bladies'? ?nights?\b|\b5 a 7\b(?!\s*(?:€|eur|ans))/, POUSSE],
  [/\ba volonte\b|\ba gogo\b|\billimite\w*|\bunlimited\b|\bopen[\s-]*bars?\b|\bfree[\s-]*flow\b|\ball you can drink\b|\bbottomless\b|\bsans limites?\b|\bsans moderation\b|\bautant que (?:tu|vous)\b|\bjusqu'?\s*a plus soif\b|\brefills?\b/, POUSSE],
  [/\btournees?\b|\brounds?\b|\bla prochaine est pour\b|\bpay(?:er|e|es|ez|ons) (?:un|une|ta|sa|leur|la|le|ton|son) (?:coup|tournee|verre|godet|canon)\b|\bun coup a boire\b/, POUSSE],
  [/\b(?:a|pour) chaque (?:but|goal|corner|carton|penalty|penalties|essai|victoire|arret)s?\b|\bpar (?:but|goal|corner|carton|penalty)s?\b|\bau (?:1er|premier|1|\d+e|\d+eme|deuxieme) (?:but|goal)s?\b|\b(?:si|quand|des que|des qu') ?(?:\S+ ){0,4}?(?:marque\w*|gagne\w*|bat|battent|l'emporte|egalise\w*|scores?)\b|\b(?:but|goal|victoire|win|essai)s? ?=|\b(?:per|every) goal\b/, POUSSE],
  [/\bboire\b|\bbuv(?:ez|ons)\b|\btrinqu\w*|\bpicol\w*|\bsiroter\b|\bcul sec\b|\bbois (?:un|une|des|ton|ta)\b|\bon boit\b|\ba la (?:votre|tienne|notre|sante)\b|\ba (?:ta|votre|notre) sante\b|\bsante ?!|\bsalud\b/, POUSSE],
  [/\bfree\b|\bfreebies?\b|\bgratis\b|\bgratos\b|\bgratui\w*|\bof+e?r+t\w*|\boffre (?:la|le|une?|ta|ton|sa|son|leur)\b|\b(?:on|bar|maison|patron|nous|je|chef|il|elle) (?:t'|te |vous )?(?:offr|invit)\w*|\bcadeaux?\b|\bkdo\b|\bon the house\b|\b(?:est|c'est) pour (?:nous|moi|la maison|le patron|le bar|nos fesses)\b|\bcomplimentary\b|\baux frais de la maison\b|\ba l'? ?oeil\b|\b(?:maison|patron|bar|on|je|nous|qui) regale\b/, GRATUITE],
  [/\bmoitie prix\b|\bhalf[\s-]*price\b|\breducs?\b|\bremises?\b|\brabais\b|\bpromos?\b|\b\d+\s*% off\b|\bdiscounts?\b|\bdeals?\b|\bsoldes?\b|\bprix (?:casses?|mini|bas|doux)\b|\bpetits? prix\b|\btwo[\s-]*for[\s-]*one\b/, GRATUITE],
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

// ---------- Une boisson sans nom avec un prix ; le prix offert ----------

const PRIX_OU_REMISE = new RegExp(String.raw`${PRIX_ECRIT}|\b(?:un|deux|trois|quatre|cinq|dix) euros?\b|%|\bmoitie\b|\bhalf\b|\bprix\b|\btarifs?\b|\bof+e?r+t|\bgratui|\bfree\b|\bremises?\b|\breduc\w*|\bpromo\w*`);
const euros = (centimes) => `${(centimes / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',')} €`;

// Une boisson dont le titre ne dit pas ce qu’elle est (« boisson », « consommation », « rafraîchissement ») avec un
// prix : écrit dans le titre, ou celui que le bar a donné (la page l’écrit juste après le titre : « Boisson du match ·
// 2 € » se lit comme « Boisson du match 2 € »), une remise ou une gratuité. Le site ne sait pas si c’est de l’alcool ; il
// ne met pas de prix dessus. « Boisson sans alcool » ne compte pas. Sans aucun prix, elle se publie (« Menu burger et
// boisson fraîche »). L’extrait (« Boisson … 2 € »), ou null.
export const boissonAvecUnPrix = (titre, prixCentimes = null) => {
  const { normal, lectures } = lecturesDe(titre);
  const boisson = lectures.map((lecture) => chercher(normal, lecture, LISTES.boisson, false)).find(Boolean);
  if (!boisson) return null;
  const prix = formesDe(titre).map((forme) => forme.match(PRIX_OU_REMISE)).find(Boolean);
  if (prix) return `${boisson} … ${prix[0].trim()}`;
  return Number.isInteger(prixCentimes) ? `${boisson} … ${euros(prixCentimes)}` : null;
};

// Un prix de 0 € (ou moins) est une gratuité : le site ne l’écrit pas, comme « offert » ({ extrait, raison }), ou null.
export const prixOffert = (prixCentimes) => (Number.isInteger(prixCentimes) && prixCentimes <= 0 ? { extrait: euros(prixCentimes), raison: GRATUITE } : null);

// ---------- Les caractères ----------

// Les seuls caractères d’un titre publié : lettres latines (celles du français et de l’Europe de l’Ouest, sans les
// lettres qui ressemblent à d’autres : ni « ß », ni « Ð », ni « Þ »), chiffres, espaces (l’insécable et la fine aussi)
// et une ponctuation simple. Ni « = », ni « ° », ni « @ », ni « * » ; aucun emoji, aucune autre écriture, aucun
// caractère invisible.
const PERMIS = /^[A-Za-z0-9À-ÏÑ-ÖØ-Ýà-ïñ-öø-ýÿŒœŸ \u{A0}\u{2009}\u{202F}.,'’\-–—:;()/+&€%!?«»"“”·…]$/u;

// Le premier caractère du titre que le site ne publie pas (« 🍺 », « В », « Ｂ »), ou null.
export const caractereNonPermis = (titre) => [...String(titre ?? '').normalize('NFC')].find((c) => !PERMIS.test(c)) ?? null;
