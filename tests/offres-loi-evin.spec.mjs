// Loi Evin, le filtre des offres de bar (generateur/alcool.mjs, et offreDe dans generateur/donnees.mjs) : quand un bar
// dit qu’une offre est sans alcool (hasAlcohol: false), le site n’écrit son titre que s’il ne nomme ni n’évoque un
// alcool, ne pousse pas à boire et n’a que des caractères permis. Les titres de l’avocat du diable (un mot d’alcool
// déguisé, écrit dans une autre langue ou une autre écriture, coupé, collé, en emoji ; une incitation à boire), tous
// écartés ; des offres sans danger, toujours publiées. Chaque lecture du filtre écarte seule ce qu’elle doit écarter.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { contenuDuScenario } from './outils/site-genere.mjs';
import { lireLaSource } from '../generateur/sources.mjs';
import { preparer } from '../generateur/donnees.mjs';
import { boissonAvecUnPrix, caractereNonPermis, incitationABoire, motDAlcool } from '../generateur/alcool.mjs';
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

// Les titres de l’avocat du diable : tous publiés par l’ancien filtre (ou tous écartés pour la seule raison d’une
// remise), tous écartés maintenant.
const DEGUISES = [
  // Un mot d’alcool déguisé : chiffres, lettres répétées, caractères invisibles, coupé, pleine chasse, lettres
  // mathématiques, cyrillique, collé.
  'b1ère', 'b1ère à 5 €', 'B1ère pression', 'Bièèère', 'Bi\u{200B}ère', 'Bi\u{AD}ère', 'Bi ère', 'Ｂｉèｒｅ fraîche', 'Ｂｉèｒｅ fraîche 5 €',
  '𝐁𝐢è𝐫𝐞 fraîche', 'Віère (cyrillique)', 'Віère', 'Вeer', 'Рinte', 'Ріntе 5 €', 'B.i.è.r.e', 'P i n t e', 'P-I-N-T-E', 'PINTE', 'PiNtE', 'Pinté',
  'Jägerbomb', 'Craftbeer', 'V3rre offert', 'verre 0ffert',
  // Des emoji de boisson.
  'Burger + 🍺', 'Formule match : burger + 🍺', 'Burger + 🍷', '🍻 x2', 'Burger + boisson 🍺',
  // L’anglais d’un bar.
  'Pints 6 € all night', 'Pints 6 €', 'Pint of Guinness', 'Beer + burger 15 €', 'Craft beer + burger', 'Craft beer', 'Draft beer 5 €', 'Lager 5 €',
  'Wine by the glass', 'Cider on tap', 'Rum punch', 'Ale', 'beer', 'pints', 'wine', 'cider', 'ale', 'craft', 'draft', 'lager', 'stout',
  // Les cocktails, les alcools forts, les vins, l’argot.
  'Moscow mule 8 €', 'Moscow mule', 'mule', 'Cuba libre', 'Long Island', 'Bloody Mary', 'Gin tonic', 'Hugo', 'Caïpi', 'Planteur maison', 'Rhum arrangé',
  'Ti-punch', 'Ti punch', 'Spritz', 'Mojito', 'Virgin mojito', 'Cocktail maison', 'Apéro', 'Mousseux', 'Bulles', 'Une coupe de bulles', 'Une mousse 4 €', 'mousse',
  'Mètre de shooters', 'shooter', 'shot', 'Jäger', 'Pastaga', 'Un jaune', 'Perroquet', 'Mauresque', 'Monaco', 'Picon', 'Panaché', 'Tango', 'Kriek', 'Gueuze',
  'Triple', 'Pils 5 €', 'IPA du moment', 'NEIPA locale', 'Punk IPA', 'Saké', 'Soju', 'Limoncello', 'Amaretto', 'Grappa', 'Ouzo', 'Raki', 'Porto', 'Vermouth',
  'Hydromel', 'Cervoise', 'Bordeaux', 'Chablis', 'Sancerre', 'Côtes du Rhône', 'Rioja', 'Champ\'', 'Champagne', 'Prosecco', 'Crémant', 'Cava', 'Lambrusco',
  'Rosé pamplemousse', 'Vin chaud', 'Sangria', 'Kir', 'Une 8.6', 'G&T 8 €', 'Afterwork jusqu’à 20 h',
  // Les marques.
  'Moretti', 'Peroni', 'Estrella', 'Mort Subite', 'Brewdog', 'Desperados', 'Kro', 'Grim', 'Grimb', '1664', 'Seize-soixante-quatre',
  // Ce qu’on sert sans dire quoi : un verre, une bouteille, un seau, un pichet.
  'Un seau de 5', 'Bucket de 5 bouteilles', 'Bouteille', 'Une bouteille achetée...', 'Pichet', 'Planche & pichet', 'Tapas + sangria',
  // Ce qui reste écarté, et l’était déjà : nommé par l’appli, ou « sans alcool » qui ne dit que l’autre boisson.
  'Pinte de soda', 'Pinte de Coca', 'Demi pression', 'Bière sans alcool ou pinte', 'Le Rouge et le Noir', 'Rose des sables', 'Blanc de poulet',
  // « sans alcool » ne vaut qu’écrit tel quel.
  'B1ère sans alc00l', 'Bière sans аlcool', 'Alcohol-free beer', 'Bière 0 %', 'Bière zéro alcool',
];
const QUI_POUSSENT = [
  // Le deuxième verre, la quantité, l’achat groupé.
  'Deuxième verre à 1 €', 'Un verre acheté, le second à 1 €', '2e pinte à moitié prix', '2nde boisson -50%', '2e verre à 2 €', 'Deuxième verre offert',
  'Second verre à moitié prix', 'Deuxième boisson à 1 €', 'Le 2e menu à 5 €', '2+1', '2+1 sur la carte', 'Formule 2+1', '2 achetées = 1 offerte',
  'Buy one get one free', 'Buy one get one', 'BOGO', 'bogo', 'Buy 2 get 1', 'Two for one',
  // La gratuité, l’heure heureuse, la quantité sans fin, la tournée, la récompense d’un but.
  'Free nachos', 'Le patron régale', 'Heure heureuse', 'Heure heureuse jusqu’à 20h', 'heure heureuse', 'Happy hour', 'Happy-hour', 'Happy hours', 'HappyHour',
  'Happy  hour', 'H4ppy hour', 'Apéro à volonté', 'Open bar', 'Fût à volonté', 'Boisson à volonté', 'Bottomless brunch', 'Tournée générale', 'Tournee du patron',
  'Boisson 50 % off', 'Conso offerte au 1er but', 'Un shot par but', 'Si Paris gagne, dessert pour tous', 'Verre offert', 'Verres offerts',
  'Boisson fraîche offerte', 'Viens boire un coup',
];
// Une boisson sans nom, avec un prix dans le titre : « boisson », « conso », « drink ».
const BOISSONS_AVEC_UN_PRIX = ['Boisson 2 €', 'Conso à 3 €', 'Drink 5 €', 'Menu burger + boisson 15 €'];

// Des offres sans danger, publiées telles quelles (dont des mots proches d’un alcool : « Pintade », « Gingembre »,
// « Mousse au chocolat », « Carton jaune », « Triple cheeseburger », « PSG-Monaco », « gluten free »).
const SANS_DANGER = [
  'Burger frites 12 €', 'Planche à partager', 'Menu du match 15 €', 'Menu burger et boisson fraîche', 'Bière sans alcool et burger', 'Mojito sans alcool',
  'Cocktail sans alcool', 'Pinte de bière sans alcool', 'Bière blonde sans alcool', 'Demi-finale', 'Demi-finale : planche du soir', 'Carton rouge',
  'Carton rouge : planche du chef', 'Carton jaune : nachos du soir', 'Nachos maison', 'Hot-dog et frites', 'Croque-monsieur 8 €', 'Planche de charcuterie',
  'Assiette de fromages', 'Café ou thé', 'Limonade maison', 'Soft 3 €', 'Jus de pomme bio', 'Coca 3 €', 'Wings de poulet 9 €', 'Pizza du match', 'Fish & chips 13 €',
  'Menu enfant 9 €', 'Mousse au chocolat', 'Menu PSG-Monaco 15 €', 'Planche spéciale PSG – Porto', 'Planche du chef (pour 2)', 'Menu « Classico » 18 €',
  'Burger 100 % maison', 'Croque, salade : 11 €', 'Bagel saumon-avocat', 'Burger de l’Ouest', 'Salade César', 'Menu Ligue des champions 16 €', 'Gâteau basque',
  'Crêpe au sucre', 'Tacos 10 €', 'Chili con carne', 'Sandwich jambon-beurre 6 €', 'Pop-corn pour le match', 'Smash burger 13 €', 'Bretzels',
  'Brunch du dimanche 22 €', 'Pintade rôtie 16 €', 'Chocolat chaud 3 €', 'Thé glacé maison', 'Café gourmand 7 €', 'Croissant et café 3 €', 'Steak frites 15 €',
  'Menu pour 2 à 25 €', 'Burger du match · frites maison', 'Triple cheeseburger 14 €', 'Poulet curry jaune 13 €', 'Gingembre frais', 'Burgers pas chers',
  'Menu de la 2e mi-temps 12 €', 'Burger gluten free 13 €', 'Burger + frites + soft 14 €', 'Jalapeños 6 €', 'Tiramisu maison', 'Écran géant et nachos',
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
    // Une boisson sans nom se publie quand le prix est celui du menu, pas quand il est de 0 € (offerte).
    expect(offreDu('Menu burger et boisson fraîche', 1500)).toEqual({ titre: 'Menu burger et boisson fraîche', prixCentimes: 1500, jusqua: null });
    expect(offreDu('Menu burger et boisson fraîche', 0)).toEqual(ECARTEE);
    expect(offreDu('Conso du match', 0)).toEqual(ECARTEE);
    expect(offreDu('Nachos du match', 0)).toEqual({ titre: 'Nachos du match', prixCentimes: 0, jusqua: null });
  });

  test('ce qui pousse à boire laisse un avertissement, comme avant', async () => {
    const brut = await lireLaSource(`scenario:${SCENARIO}`);
    const soiree = brut.matchNights.find((n) => n.id === 'n-comptoir-barca');
    const avertissements = (title) => {
      soiree.offer = { title, priceCents: 500, until: null, hasAlcohol: false };
      return preparer(brut, { maintenant: VENDREDI, ...contenu }).avertissements.filter((a) => a.startsWith('Offre'));
    };
    // Ceux des autres soirées du scénario (la « happy hour » d’une autre soirée du même bar) ne comptent pas.
    const ailleurs = avertissements('Nachos maison');
    const avertissementDe = (title) => avertissements(title).filter((a) => !ailleurs.includes(a));
    expect(avertissementDe('Formule 2+1')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« 2+1 »), ce que le site ne publie pas']);
    expect(avertissementDe('Heure heureuse jusqu’à 20h')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle pousse à boire (« heure heureuse »), ce que le site ne publie pas']);
    expect(avertissementDe('Free nachos')).toEqual(['Offre de « Le Comptoir du Canal » non affichée : elle parle d’une remise ou d’une gratuité (« free »), ce que le site ne publie pas']);
    // Un alcool nommé, un emoji : écartés sans avertissement (une offre d’alcool est dans l’appli, avec sa mention).
    expect(avertissementDe('Craft beer')).toEqual([]);
    expect(avertissementDe('Burger + 🍺')).toEqual([]);
  });

  test('chaque lecture écarte seule ce qu’elle doit écarter', () => {
    // 1. Les caractères : rien que des lettres latines, des chiffres, des espaces et une ponctuation simple.
    expect(['Burger + 🍺', 'Віère', 'Ｂｉèｒｅ', '𝐁𝐢è𝐫𝐞', 'Burger + frites = 12 €', 'Nachos maison !', 'Menu n°2', 'Pinte\u{3164}', 'Bière 5°'].map(caractereNonPermis))
      .toEqual(['🍺', 'В', 'Ｂ', '𝐁', '=', '!', '°', '\u{3164}', '°']);
    for (const titre of SANS_DANGER) expect(caractereNonPermis(titre), titre).toBeNull();
    expect(caractereNonPermis('Crème brûlée, œuf cocotte : 9,50 € (« fait maison »)\u{A0}?')).toBeNull();
    // 2. Les mots : NFKC, sosies, « leet », lettres répétées, mots coupés, mots collés, emoji ; un mot sans danger
    // proche d’un alcool reste.
    expect(['Ｂｉèｒｅ fraîche', '𝐁𝐢è𝐫𝐞', 'Віère', 'b1ère', '1ager', 'Bi€re', '$hot', 'Bièèère', 'Beeeer', 'Bi ère', 'B.i.è.r.e', 'P i n t e', 'Jägerbomb', 'Superbière', 'Burger + 🍺'].map(motDAlcool))
      .toEqual(['Ｂｉèｒｅ', '𝐁𝐢è𝐫𝐞', 'Віère', 'b1ère', '1ager', 'Bi€re', '$hot', 'Bièèère', 'Beeeer', 'Bi ère', 'B.i.è.r.e', 'P i n t e', 'Jägerbomb', 'Superbière', '🍺']);
    for (const titre of ['Pintade rôtie', 'Gingembre frais', 'Screenshot du score', 'Mousse au chocolat', 'Carton jaune', 'Triple cheeseburger', 'Menu PSG-Monaco', 'Girondins de Bordeaux', 'Burgers pas chers', 'Mickey Mouse', 'Ça va être chaud']) {
      expect(motDAlcool(titre), titre).toBeNull();
    }
    // Un mot qui nomme un alcool passe avant celui qui l’évoque : « Verre de vin » nomme le vin ; « Verre de jus » évoque.
    expect(['Verre de vin rouge', 'Verre de jus', 'Bouteille d’eau', 'Seau de 5'].map(motDAlcool)).toEqual(['vin', 'Verre', 'Bouteille', 'Seau']);
    // « sans alcool » écrit tel quel est la seule échappatoire.
    expect(['Bière sans alcool', 'Bi ère sans alcool', 'Verre sans alcool', 'Cuba libre sans alcool'].map(motDAlcool)).toEqual([null, null, null, null]);
    expect(['B1ère sans alc00l', 'Bière sans аlcool', 'Bière sans alcohol', 'Bière 0 %', 'Bièresansalcool'].map(motDAlcool)).toEqual(['B1ère', 'Bière', 'Bière', 'Bière', 'Bièresansalcool']);
    // Un mot déguisé nomme un alcool, il ne l’excuse jamais : ni « ｓａｎｓ ａｌｃｏｏｌ », ni « ｄｅｍｉ-tarif », ni un
    // caractère invisible avant « sans alcool ».
    expect(['Bière ｓａｎｓ ａｌｃｏｏｌ', 'Ｄｅｍｉ-tarif', 'Demi-ｔａｒｉｆ', 'Carton ｒｏｕｇｅ', 'Bière\u{200B} sans alcool', 'Kronen\u{200B}bourg', 'Bi\u{AD}ère'].map(motDAlcool))
      .toEqual(['Bière', 'Ｄｅｍｉ', 'Demi', 'ｒｏｕｇｅ', 'Bière', 'Kronenbourg', 'Bière']);
    // 3. Ce qui pousse à boire, sans aucun mot d’alcool.
    for (const titre of ['Formule 2+1', '2 for 1', 'Buy one get one', 'BOGO', 'B1G1', 'Free nachos', 'Fr33 nachos', 'Heure heureuse', 'H4ppy', 'Bottomless brunch', 'Si le PSG marque, dessert', 'Le second à 1 €', 'Deuxième boisson', 'Viens boire un coup', 'Le patron régale', 'On the house']) {
      expect(incitationABoire(titre), titre).not.toBeNull();
    }
    for (const titre of ['Menu pour 2 à 25 €', 'Burger gluten free', 'Menu de la 2e mi-temps 12 €', 'L’offre du soir : planche', 'Régalez-vous', 'Planche à partager']) {
      expect(incitationABoire(titre), titre).toBeNull();
    }
    // 4. Une boisson sans nom et un prix écrit, une remise, une gratuité, ou 0 € ; pas le prix d’un menu.
    expect(['Boisson 2 €', 'Conso à 3 €', 'Drink 5 €', 'Boissons à moitié prix', 'Boisson offerte'].map((t) => boissonAvecUnPrix(t))).toEqual(['boisson … 2 €', 'conso … 3 €', 'drink … 5 €', 'boissons … moitie', 'boisson … offert']);
    expect(boissonAvecUnPrix('Conso du match', 0)).toBe('conso … 0 €');
    expect(boissonAvecUnPrix('Menu burger et boisson fraîche', 1500)).toBeNull();
    expect(boissonAvecUnPrix('Soft 3 €')).toBeNull();
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
