// Loi Evin, le filtre des offres de bar (generateur/alcool.mjs, et offreDe dans generateur/donnees.mjs) : quand un bar
// dit qu’une offre est sans alcool (hasAlcohol: false), le site n’écrit son titre que s’il ne nomme ni n’évoque un
// alcool, ne pousse pas à boire, n’a que des caractères permis et ne met pas de prix sur une boisson sans nom. Les
// titres de l’avocat du diable (un mot d’alcool déguisé, écrit dans une autre langue ou une autre écriture, coupé, collé,
// mal orthographié, en emoji ; une incitation à boire), tous écartés ; des offres sans danger, toujours publiées ; celles
// que la prudence écarte quand même, écrites ici pour qu’on sache ce qu’elle coûte. Chaque lecture du filtre écarte
// seule ce qu’elle doit écarter.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { contenuDuScenario } from './outils/site-genere.mjs';
import { lireLaSource } from '../generateur/sources.mjs';
import { preparer } from '../generateur/donnees.mjs';
import { boissonAvecUnPrix, caractereNonPermis, incitationABoire, motDAlcool, prixOffert } from '../generateur/alcool.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');
const contenu = contenuDuScenario();

// L’offre d’une soirée du scénario, réécrite par le bar et cochée « sans alcool » : ce que le site en publie.
const lecteurDOffres = async () => {
  const brut = await lireLaSource(`scenario:${SCENARIO}`);
  const soiree = brut.matchNights.find((n) => n.id === 'n-comptoir-barca');
  return (title, priceCents = 500) => {
    soiree.offer = { title, priceCents, until: null, hasAlcohol: false };
    const donnees = preparer(brut, { maintenant: VENDREDI, ...contenu });
    return donnees.soirees.find((s) => s.id === 'n-comptoir-barca').offre;
  };
};
const ECARTEE = { dansLAppli: true };

// Les titres de l’avocat du diable (deux passages) : publiés par un filtre précédent, tous écartés maintenant.
const DEGUISES = [
  // Un mot d’alcool déguisé : chiffres, lettres répétées, caractères invisibles, coupé, pleine chasse, lettres
  // mathématiques, cyrillique, collé, un « l » pour un « I ».
  'b1ère', 'b1ère à 5 €', 'B1ère pression', 'Bièèère', 'Bi\u{200B}ère', 'Bi\u{AD}ère', 'Bi ère', 'Ｂｉèｒｅ fraîche', 'Ｂｉèｒｅ fraîche 5 €',
  '𝐁𝐢è𝐫𝐞 fraîche', 'Віère (cyrillique)', 'Віère', 'Вeer', 'Рinte', 'Ріntе 5 €', 'B.i.è.r.e', 'P i n t e', 'P-I-N-T-E', 'PINTE', 'PiNtE', 'Pinté',
  'Jägerbomb', 'Craftbeer', 'V3rre offert', 'verre 0ffert', 'P 1 n t e', 'B,i,è,r,e', 'B;i;è;r;e', 'B/i/è/r/e', 'Pin-te', 'Pin te', 'Pi nte', 'Pin.te',
  'Kronen-bourg', 'Kronen bourg', 'Kro-nen-bourg', 'Hein3ken', 'PlNTE', 'BlÈRE', 'Iager', 'ßière', '8ière', '6in tonic', 'Rhumarrangé', 'Gintonic',
  'Bierpong', 'Vodka-redbull', 'Pinte!',
  // Une faute d’orthographe sur un nom de boisson.
  'Coktail maison', 'Cocktel du soir', 'Mojitto', 'Mohito', 'Wisky coca', 'Whiskey', 'Tekila paf', 'Tequilla', 'Champange', 'Vodca', 'Sprits', 'Guiness',
  'Planche apéritive', 'Bièrre fraîche', 'Biére', 'Heinekenn', 'Kronenburg', 'Afflighem', 'Jaegermeister',
  // Des emoji de boisson.
  'Burger + 🍺', 'Formule match : burger + 🍺', 'Burger + 🍷', '🍻 x2', 'Burger + boisson 🍺',
  // L’anglais d’un bar.
  'Pints 6 € all night', 'Pints 6 €', 'Pint of Guinness', 'Beer + burger 15 €', 'Craft beer + burger', 'Craft beer', 'Draft beer 5 €', 'Lager 5 €',
  'Wine by the glass', 'Cider on tap', 'Rum punch', 'Ale', 'beer', 'pints', 'wine', 'cider', 'ale', 'craft', 'draft', 'lager', 'stout', 'Brewski',
  'Hops & burger', 'Taproom', 'Bubbles', 'Hangover brunch', 'Drinks', 'Drink du match', 'Bevvy', 'Plonk', 'Porter', 'Keg', 'Nightcap',
  // Les cocktails, les alcools forts, les vins, l’argot, les autres langues.
  'Moscow mule 8 €', 'Moscow mule', 'mule', 'Cuba libre', 'Long Island', 'Bloody Mary', 'Gin tonic', 'Hugo', 'Caïpi', 'Planteur maison', 'Rhum arrangé',
  'Ti-punch', 'Ti punch', 'Spritz', 'Mojito', 'Virgin mojito', 'Cocktail maison', 'Apéro', 'Mousseux', 'Bulles', 'Une coupe de bulles', 'Une mousse 4 €', 'mousse',
  'Mètre de shooters', 'shooter', 'shot', 'Jäger', 'Pastaga', 'Un jaune', 'Perroquet', 'Mauresque', 'Monaco', 'Picon', 'Panaché', 'Tango', 'Kriek', 'Gueuze',
  'Triple', 'Pils', 'Pils 5 €', 'IPA du moment', 'NEIPA locale', 'Punk IPA', 'Saké', 'Soju', 'Limoncello', 'Amaretto', 'Grappa', 'Ouzo', 'Raki', 'Porto',
  'Vermouth', 'Hydromel', 'Cervoise', 'Bordeaux', 'Chablis', 'Sancerre', 'Côtes du Rhône', 'Côtes-du-Rhône', 'Rioja', 'Champ\'', 'Champagne', 'Prosecco',
  'Crémant', 'Cava', 'Lambrusco', 'Rosé pamplemousse', 'Vin chaud', 'Glühwein', 'Sangria', 'Kir', 'Kir royal', 'Une 8.6', 'G&T 8 €', 'J&B coca',
  'Afterwork jusqu’à 20 h', 'Mimosa', 'Génépi', 'Poire williams', 'Trou normand', 'Blue lagoon', 'White Claw', 'Hard seltzer', 'Spumante', 'Vinho verde',
  'Wein', 'Piwo', 'Poiré', 'Houblon local', 'Microbrasserie', 'Cuvée du patron', 'Un 51', 'Le 51 bien frais', 'Gueule de bois', 'Pompette',
  'Bourré', 'Éméché', 'Murge', 'Saoul', 'Soûl', 'Ivresse', 'Tchin tchin', 'Cheers', 'Flip cup', 'Beer pong', 'Soirée dégustation', 'Grand cru',
  'Œnologie et planche', 'Le vigneron invité', 'Une chopine', 'A cold one', 'Monaco-grenadine', 'Un 102',
  // Les marques.
  'Moretti', 'Peroni', 'Estrella', 'Mort Subite', 'Brewdog', 'Desperados', 'Kro', 'Grim', 'Grimb', '1664', 'Seize-soixante-quatre', 'Une 33 export',
  'Tourtel', 'Kronenbourg 0,0', 'Heineken 0.0', 'Leffe ruby', 'La Chouffe',
  // Ce qu’on sert sans dire quoi : un verre, une conso, une bouteille, un seau, un pichet, un volume, un demi.
  'Un seau de 5', 'Bucket de 5 bouteilles', 'Bouteille', 'Une bouteille achetée...', 'Pichet', 'Planche & pichet', 'Tapas + sangria', 'Consos',
  'Conso du match', 'Une 50 cl', 'Coca 33 cl', 'Pichet 1 L', '1/2 à 3 €', 'Magnum', 'Une 8 degrés', 'Blonde 5 % vol',
  // Ce qui reste écarté, et l’était déjà : nommé par l’appli, ou « sans alcool » qui ne dit que l’autre boisson.
  'Pinte de soda', 'Pinte de Coca', 'Demi pression', 'Bière sans alcool ou pinte', 'Le Rouge et le Noir', 'Rose des sables', 'Blanc de poulet',
  // « sans alcool » ne vaut qu’écrit tel quel, et sans clin d’œil après.
  'B1ère sans alc00l', 'Bière sans аlcool', 'Alcohol-free beer', 'Bière 0 %', 'Bière zéro alcool', 'Bière sans alcol', 'Bière sans alcool ou pas',
  'Bière sans alcool (ou pas)', 'Mojito sans alcool… ou presque', 'Bière sans alcool, ou avec',
];
const QUI_POUSSENT = [
  // Le deuxième verre, la quantité, l’achat groupé.
  'Deuxième verre à 1 €', 'Un verre acheté, le second à 1 €', '2e pinte à moitié prix', '2nde boisson -50%', '2e verre à 2 €', 'Deuxième verre offert',
  'Second verre à moitié prix', 'Deuxième boisson à 1 €', 'Le 2e menu à 5 €', '2+1', '2 + 1', '1+1', '2+1 sur la carte', 'Formule 2+1', '2 achetées = 1 offerte',
  'Buy one get one free', 'Buy one get one', 'Buy one', 'Buy 1 get 1', 'BOGO', 'bogo', 'BOGOF', 'Buy 2 get 1', 'Two for one', 'Two-for-one', '2-for-1',
  '2 pour 1', '3 pour 2', 'Deux pour une', '2=1', '3 pour le prix de 2', '2 au prix d’1', 'Deux au prix d’un', '2e verre', 'Deuxième verre', 'Second verre',
  'Second drink', '2nd round', 'Seconde boisson', '2ème conso', 'Next drink', 'La deuxième est pour nous', 'Le 2e est offert', 'Achetez-en 2, la 3e offerte',
  // La gratuité, sous toutes ses formes.
  'Free nachos', 'Free', 'FREE', 'Fr€€', 'Free refill', 'Gratuit', 'Gratos', 'Offert', 'Offerts', '0ffert', 'Of3rt', 'Ofert au 1er but', 'Kdo du patron',
  'C’est cadeau', 'Le patron t’invite', 'Le patron régale', 'L’apéro est offert', 'Shot offert', 'Shots offerts', 'Shot gratuit', 'Sh0t offert',
  'Verre offert', 'Verres offerts', 'Verre 0ffert', 'Conso offerte', 'Boisson fraîche offerte', 'Réduc sur présentation du ticket', 'Tarif supporter -2 €',
  // L’heure heureuse, la quantité sans fin, la tournée, la récompense d’un but, les toasts.
  'Heure heureuse', 'Heure heureuse jusqu’à 20h', 'Heure heureuse jusqu\'à 20h', 'heure heureuse', 'Heures heureuses', 'L’heure heureuse', 'Happy hour',
  'Happy-hour', 'Happy hours', 'HappyHour', 'Happy  hour', 'H4ppy hour', 'H@ppy hour', 'Hαppy hour', 'Hapy hour', 'Happi hour', 'H.H. 18h-20h', 'Hora feliz',
  'Happy', 'Ladies night', 'Apéro à volonté', 'À volonté', 'A volonte', 'Open bar', '0pen bar', 'Fût à volonté', 'Boisson à volonté', 'Bottomless brunch',
  'Recharge illimitée', 'Remplissage gratuit', 'Sans modération', 'Refill soda', 'Tournée générale', 'Tournee du patron', 'Tournée', 'T0urnée',
  'Payer un coup', 'Boisson 50 % off', 'Conso offerte au 1er but', 'Un shot par but', 'Si Paris gagne, dessert pour tous', 'Un but = une tournée',
  'Victoire = nachos', 'Chaque but : -1 €', 'Viens boire un coup', 'À la vôtre', 'Santé !',
];
// Une boisson sans nom (« boisson », « consommation », « rafraîchissement ») avec un prix : dans le titre, ou celui que
// le bar donne (la page l’écrit juste après le titre ; le lecteur met 5 € par défaut).
const BOISSONS_AVEC_UN_PRIX = ['Boisson 2 €', 'Menu burger + boisson 15 €', 'Boisson du match', 'Boisson fraîche', 'Une boisson au choix',
  'Rafraîchissement 2 €', 'Consommation du soir', 'Refreshments', 'Beverage 3 €', 'B o i s s o n du match', 'Breuvage du match'];

// Des offres sans danger, publiées telles quelles (dont des mots proches d’un alcool : « Pintade », « Gingembre »,
// « Mousse au chocolat », « Carton jaune », « Triple cheeseburger », « PSG-Monaco », « gluten free », « Pain de
// campagne », « Pomme au four », « Pinces de crabe », « Œufs mimosa », « Rumsteak »).
const SANS_DANGER = [
  'Burger frites 12 €', 'Planche à partager', 'Menu du match 15 €', 'Menu burger et frites maison', 'Bière sans alcool et burger', 'Mojito sans alcool',
  'Cocktail sans alcool', 'Pinte de bière sans alcool', 'Bière blonde sans alcool', 'Boisson sans alcool', 'Demi-finale', 'Demi-finale : planche du soir',
  'Carton rouge', 'Carton rouge : planche du chef', 'Carton jaune : nachos du soir', 'Nachos maison', 'Nachos maison !', 'Menu du match ?', 'Hot-dog et frites',
  'Croque-monsieur 8 €', 'Croque-madame', 'Planche de charcuterie', 'Planche mixte', 'Assiette de fromages', 'Café ou thé', 'Café 2 €', 'Cappuccino',
  'Limonade maison', 'Citronnade', 'Soft 3 €', 'Softs', 'Jus de pomme bio', 'Jus d’orange pressé', 'Smoothie fraise banane', 'Milkshake vanille', 'Bubble tea',
  'Cold brew', 'Coca 3 €', 'Coca-Cola', 'Diabolo menthe', 'Sirop à l’eau', 'Kombucha', 'Wings de poulet 9 €', 'Chicken wings', 'Pizza du match',
  'Pizza margherita 11 €', 'Pizza 4 fromages', 'Fish & chips 13 €', 'Fish and chips', 'Menu enfant 9 €', 'Menu étudiant 10 €', 'Mousse au chocolat',
  'Menu PSG-Monaco 15 €', 'Planche spéciale PSG – Porto', 'Planche du chef (pour 2)', 'Menu « Classico » 18 €', 'Burger « maison »', 'Burger "maison"',
  'Burger 100 % maison', 'Croque, salade : 11 €', 'Bagel saumon-avocat', 'Burger de l’Ouest', 'Burger de l\'Ouest', 'Salade César', 'Salade de chèvre chaud',
  'Menu Ligue des champions 16 €', 'Gâteau basque', 'Crêpe au sucre', 'Crêpe Suzette', 'Tacos 10 €', 'Chili con carne', 'Sandwich jambon-beurre 6 €',
  'Pop-corn pour le match', 'Smash burger 13 €', 'Bretzels', 'Brunch du dimanche 22 €', 'Pintade rôtie 16 €', 'Chocolat chaud 3 €', 'Thé glacé maison',
  'Café gourmand 7 €', 'Croissant et café 3 €', 'Steak frites 15 €', 'Rumsteak frites', 'Menu pour 2 à 25 €', 'Menu duo 25 €', '2 burgers + 2 frites 24 €',
  'Burger du match · frites maison', 'Burger – frites – dessert', 'Burger / frites', 'Triple cheeseburger 14 €', 'Double cheeseburger', 'Poulet curry jaune 13 €',
  'Gingembre frais', 'Burgers pas chers', 'Menu de la 2e mi-temps 12 €', 'Menu de mi-temps', 'Burger gluten free 13 €', 'Burger + frites + soft 14 €',
  'Jalapeños 6 €', 'Tiramisu maison', 'Tiramisu aux amaretti', 'Écran géant et nachos', 'Pain de campagne', 'Terrine de campagne', 'Pomme au four',
  'Tarte pomme au four', 'Moules frites', 'Pinces de crabe', 'Calamars frits', 'Œufs mimosa', 'Oeufs mimosa', 'Gibier du chef', 'Pastas du chef', 'Pain perdu',
  'Riz au lait', 'Île flottante', 'Paris-Brest', 'Bœuf-carottes', 'Bœuf bourguignon', 'Pot-au-feu', 'Quiche lorraine', 'Tarte flambée', 'Raclette', 'Tartiflette',
  'Choucroute', 'Cassoulet', 'Lasagnes maison', 'Risotto aux champignons', 'Soupe à l’oignon', 'Patatas bravas', 'Onion rings', 'Mozzarella sticks', 'Houmous et pita',
  'Falafels', 'Accras de morue', 'Olives marinées', 'Chips maison', 'Crème brûlée', 'Fondant au chocolat', 'Cheesecake', 'Tarte tatin', 'Profiteroles', 'Churros',
  'Gaufre chantilly', 'Glace vanille', 'Sorbet citron', 'Ambiance stade', 'Quiz foot à la mi-temps', 'Venez en maillot', 'Supporters bienvenus',
  'Terrasse chauffée', 'Jusqu’à la fin du match', 'Menu 3 plats 20 €', 'Formule midi', 'Formule du soir 16 €', 'Menu au prix de 15 €', 'Planche & frites',
  'Wings + frites', 'Hot-dog : 5 €', 'Frites (grande portion)', 'Tapas à partager', 'Bruschetta', 'Burrata', 'Pulled pork', 'Ribs barbecue', 'Poke bowl',
];
// Sans danger, mais écartées par prudence : le prix de cette prudence (elles restent dans l’appli). Un mot de la liste
// dans un plat, une boisson sans nom avec un prix, un caractère hors de la liste, un prix de 0 €.
const ECARTEES_PAR_PRUDENCE = [
  ['Glace vanille bourbon', 500], ['Coq au vin', 500], ['Ginger beer', 500], ['Bouteille d’eau', 500], ['Menu n°2', 500],
  ['Menu burger et boisson fraîche', 1500], ['Menu burger + boisson', 1200], ['Nachos du match', 0], ['Entrée libre', 0], ['Mocktail maison', 500],
];

test.describe('loi Evin : les offres cochées « sans alcool »', () => {
  test('chaque titre de l’avocat du diable est écarté : ni titre, ni prix', async () => {
    const offreDu = await lecteurDOffres();
    const publies = [...DEGUISES, ...QUI_POUSSENT, ...BOISSONS_AVEC_UN_PRIX].filter((titre) => offreDu(titre).dansLAppli !== true);
    expect(publies).toEqual([]);
  });

  test('une offre sans danger reste publiée telle que le bar l’a écrite, avec son prix', async () => {
    const offreDu = await lecteurDOffres();
    for (const titre of SANS_DANGER) expect(offreDu(titre), titre).toEqual({ titre, prixCentimes: 500, jusqua: null });
    // Une boisson sans nom se publie sans aucun prix ; avec un prix, écrit ou donné par le bar, non.
    expect(offreDu('Menu burger et boisson fraîche', null)).toEqual({ titre: 'Menu burger et boisson fraîche', prixCentimes: null, jusqua: null });
    expect(offreDu('Menu burger et boisson fraîche', 1500)).toEqual(ECARTEE);
    expect(offreDu('Menu burger et boisson fraîche 15 €', null)).toEqual(ECARTEE);
    // Un prix de 0 € est une gratuité : écarté, comme « offert ».
    expect(offreDu('Nachos du match', 0)).toEqual(ECARTEE);
    expect(offreDu('Nachos du match', 900)).toEqual({ titre: 'Nachos du match', prixCentimes: 900, jusqua: null });
  });

  test('la prudence écarte aussi quelques offres sans danger : elles restent dans l’appli', async () => {
    const offreDu = await lecteurDOffres();
    for (const [titre, prix] of ECARTEES_PAR_PRUDENCE) expect(offreDu(titre, prix), titre).toEqual(ECARTEE);
  });

  test('ce qui pousse à boire laisse un avertissement, comme avant', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const soiree = brut.matchNights.find((n) => n.id === 'n-comptoir-barca');
    const avertissements = (title, priceCents = 500) => {
      soiree.offer = { title, priceCents, until: null, hasAlcohol: false };
      return preparer(brut, { maintenant: VENDREDI, ...contenu }).avertissements.filter((a) => a.startsWith('Offre'));
    };
    // Ceux des autres soirées du scénario (la « happy hour » d’une autre soirée du même bar) ne comptent pas.
    const ailleurs = avertissements('Nachos maison');
    const avertissementDe = (title, priceCents) => avertissements(title, priceCents).filter((a) => !ailleurs.includes(a));
    expect(avertissementDe('Formule 2+1')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« 2+1 »), ce que le site ne publie pas']);
    expect(avertissementDe('Heure heureuse jusqu’à 20h')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« heure heureuse »), ce que le site ne publie pas']);
    expect(avertissementDe('Free nachos')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle parle d’une remise ou d’une gratuité (« free »), ce que le site ne publie pas']);
    expect(avertissementDe('Nachos du match', 0)).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle parle d’une remise ou d’une gratuité (« 0 € »), ce que le site ne publie pas']);
    // Un alcool nommé, un emoji, une boisson sans nom : écartés sans avertissement (une offre d’alcool est dans l’appli,
    // avec sa mention).
    expect(avertissementDe('Craft beer')).toEqual([]);
    expect(avertissementDe('Burger + 🍺')).toEqual([]);
    expect(avertissementDe('Boisson du match')).toEqual([]);
  });

  test('chaque lecture écarte seule ce qu’elle doit écarter', () => {
    // 1. Les caractères : rien que des lettres latines, des chiffres, des espaces et une ponctuation simple (« ! » et
    // « ? » compris).
    expect(['Burger + 🍺', 'Віère', 'Ｂｉèｒｅ', '𝐁𝐢è𝐫𝐞', 'Burger + frites = 12 €', 'Menu n°2', 'Pinte\u{3164}', 'Bière 5°', 'ßière', 'Burger*', '@bar'].map(caractereNonPermis))
      .toEqual(['🍺', 'В', 'Ｂ', '𝐁', '=', '°', '\u{3164}', '°', 'ß', '*', '@']);
    for (const titre of SANS_DANGER) expect(caractereNonPermis(titre), titre).toBeNull();
    expect(caractereNonPermis('Crème brûlée, œuf cocotte : 9,50 € (« fait maison »)\u{A0}? Oui !')).toBeNull();
    // 2. Les mots : NFKC, sosies, « leet », un « l » pour un « I », lettres répétées, mots coupés (sans espace, avec
    // des espaces, lettre par lettre), mots collés, fautes de frappe, emoji, accents ; un mot sans danger proche d’un
    // alcool reste.
    expect(['Ｂｉèｒｅ fraîche', '𝐁𝐢è𝐫𝐞', 'Віère', 'b1ère', '1ager', 'Bi€re', '$hot', '8ière', 'PlNTE', 'Iager', 'Bièèère', 'Beeeer', 'Bi ère', 'B.i.è.r.e',
      'B,i,è,r,e', 'Kronen-bourg', 'Kronen bourg', 'Jägerbomb', 'Superbière', 'Coktail', 'Wisky', 'Champange', 'Burger + 🍺', 'Poiré'].map(motDAlcool))
      .toEqual(['Ｂｉèｒｅ', '𝐁𝐢è𝐫𝐞', 'Віère', 'b1ère', '1ager', 'Bi€re', '$hot', '8ière', 'PlNTE', 'Iager', 'Bièèère', 'Beeeer', 'Bi ère', 'B.i.è.r.e',
        'B,i,è,r,e', 'Kronen-bourg', 'Kronen bourg', 'Jägerbomb', 'Superbière', 'Coktail', 'Wisky', 'Champange', '🍺', 'Poiré']);
    for (const titre of ['Pintade rôtie', 'Gingembre frais', 'Screenshot du score', 'Mousse au chocolat', 'Carton jaune', 'Triple cheeseburger', 'Menu PSG-Monaco',
      'Girondins de Bordeaux', 'Burgers pas chers', 'Mickey Mouse', 'Ça va être chaud', 'Pomme au four', 'Pain de campagne', 'Pinces de crabe', 'Œufs mimosa',
      'Tiramisu aux amaretti', 'Chez Martin', 'Rumsteak', 'Gibier', 'Tarte aux poires', 'Soul food', 'Menu 1/2 finale', 'Menu à 10 l’unité', 'Assemblée']) {
      expect(motDAlcool(titre), titre).toBeNull();
    }
    // Un mot qui nomme un alcool passe avant celui qui l’évoque : « Verre de vin » nomme le vin ; « Verre de jus », un
    // volume, un demi évoquent.
    expect(['Verre de vin rouge', 'Verre de jus', 'Bouteille d’eau', 'Seau de 5', 'Drink du match', 'Coca 50 cl', '1/2 à 3 €', 'Un 51'].map(motDAlcool))
      .toEqual(['vin', 'Verre', 'Bouteille', 'Seau', 'Drink', '50 cl', '1/2', 'un 51']);
    // « sans alcool » écrit tel quel est la seule échappatoire, et un clin d’œil après le reprend.
    expect(['Bière sans alcool', 'Bi ère sans alcool', 'Verre sans alcool', 'Cuba libre sans alcool'].map(motDAlcool)).toEqual([null, null, null, null]);
    expect(['B1ère sans alc00l', 'Bière sans аlcool', 'Bière sans alcohol', 'Bière 0 %', 'Bièresansalcool', 'Bière sans alcol'].map(motDAlcool))
      .toEqual(['B1ère', 'Bière', 'Bière', 'Bière', 'Bièresansalcool', 'Bière']);
    expect(motDAlcool('Bière sans alcool (ou pas)')).toBe('sans alcool (ou pas');
    // Un mot déguisé nomme un alcool, il ne l’excuse jamais : ni « ｓａｎｓ ａｌｃｏｏｌ », ni « ｄｅｍｉ-tarif », ni un
    // caractère invisible avant « sans alcool ».
    expect(['Bière ｓａｎｓ ａｌｃｏｏｌ', 'Ｄｅｍｉ-tarif', 'Demi-ｔａｒｉｆ', 'Carton ｒｏｕｇｅ', 'Bière\u{200B} sans alcool', 'Kronen\u{200B}bourg', 'Bi\u{AD}ère'].map(motDAlcool))
      .toEqual(['Bière', 'Ｄｅｍｉ', 'Demi', 'ｒｏｕｇｅ', 'Bière', 'Kronenbourg', 'Bière']);
    // 3. Ce qui pousse à boire, sans aucun mot d’alcool.
    for (const titre of ['Formule 2+1', '2 for 1', '2-for-1', '3 pour le prix de 2', '2 au prix d’1', 'Buy one get one', 'BOGO', 'B1G1', 'Free nachos', 'Fr33 nachos',
      'Heure heureuse', 'H4ppy', 'Hapy hour', 'H.H.', 'Hora feliz', 'Ladies night', 'Bottomless brunch', 'Sans modération', 'Refill', 'Si le PSG marque, dessert',
      'Victoire = dessert', 'Le second à 1 €', 'Deuxième boisson', 'La deuxième est pour nous', 'Viens boire un coup', 'Payer un coup', 'À la vôtre',
      'Le patron régale', 'Le patron t’invite', 'Kdo', 'Ofert', 'Réduc', 'On the house']) {
      expect(incitationABoire(titre), titre).not.toBeNull();
    }
    for (const titre of ['Menu pour 2 à 25 €', 'Menu au prix de 15 €', 'Burger gluten free', 'Menu de la 2e mi-temps 12 €', 'L’offre du soir : planche',
      'Régalez-vous', 'Planche à partager', 'Menu duo 25 €', '2 burgers + 2 frites', 'Menu enfant (2-10 ans)']) {
      expect(incitationABoire(titre), titre).toBeNull();
    }
    // 4. Une boisson sans nom et un prix : écrit, donné par le bar, une remise, une gratuité ; « sans alcool », ou aucun
    // prix, la laisse passer.
    expect(['Boisson 2 €', 'Consommation à 3 €', 'Boissons à moitié prix', 'Boisson offerte'].map((t) => boissonAvecUnPrix(t)))
      .toEqual(['Boisson … 2 €', 'Consommation … 3 €', 'Boissons … moitie', 'Boisson … offert']);
    expect([['Boisson du match', 250], ['Menu burger et boisson fraîche', 1500], ['Rafraîchissement', 0]].map(([t, prix]) => boissonAvecUnPrix(t, prix)))
      .toEqual(['Boisson … 2,50 €', 'boisson … 15 €', 'Rafraîchissement … 0 €']);
    expect([['Menu burger et boisson fraîche', null], ['Boisson sans alcool 3 €', 300], ['Soft 3 €', 300], ['Burger 12 €', 1200]].map(([t, prix]) => boissonAvecUnPrix(t, prix)))
      .toEqual([null, null, null, null]);
    // 5. Le prix : 0 € (ou moins) est une gratuité.
    expect([0, -100, 500, null, undefined].map((prix) => prixOffert(prix)?.extrait ?? null)).toEqual(['0 €', '-1 €', null, null, null]);
  });

  test('sur les pages : un titre déguisé n’est écrit nulle part', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const soiree = brut.matchNights.find((n) => n.id === 'n-comptoir-barca');
    soiree.offer = { title: 'Ｂｉèｒｅ fraîche 5 €', priceCents: 500, until: null, hasAlcohol: false };
    const site = await construireEnMemoire({ brut, maintenant: VENDREDI, racine, contenu });
    for (const p of site.pages) expect(p.contenu, p.chemin).not.toMatch(/Ｂｉèｒｅ|Bière fraîche|fraîche 5 €/);
    const carte = site.pages.find((p) => p.chemin === '/bar/le-comptoir-du-canal-paris-10/').contenu.split('id="soiree-psg-barca-2026-10-24"')[1].split('</li>')[0];
    expect(carte).toContain('<p class="regarder-offre__texte">Une offre du bar dans l’appli</p>');
  });
});
