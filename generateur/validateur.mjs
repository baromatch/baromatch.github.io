// Le validateur des données structurées (JSON-LD) des pages générées. Deux règles, et une erreur arrête la génération :
//  1. le vocabulaire de schema.org (copie réduite de la version notée dans schemaorg/vocabulaire.json) : chaque type
//     existe, chaque propriété existe et va sur ce type (ou l’un de ses parents), chaque valeur est d’un type que la
//     propriété accepte, chaque valeur d’énumération (EventScheduled…) est de la bonne énumération ;
//  2. ce que Google demande pour les résultats enrichis qu’il affiche (documentation de Google Search Central, pages
//     « Event » et « Breadcrumb », mises à jour le 8 septembre 2026) : pour Event, un nom, une date de début ISO 8601,
//     un lieu nommé avec son adresse postale, et une image ; pour BreadcrumbList, des éléments numérotés à partir de 1,
//     chacun avec son nom et son adresse (sauf le dernier). FAQPage n’est jugé que par schema.org : Google n’affiche
//     plus ces résultats depuis mai 2026, et le validateur ne prétend suivre aucune règle de Google pour eux.
// Il existe un validateur npm entretenu (@adobe/structured-data-validator), mais il ne juge pas Event et demande le
// vocabulaire complet à chaque lancement : celui-ci tient en un fichier, sans dépendance, comme le reste du générateur.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';

const SCHEMA = 'https://schema.org/';

export const chargerLeVocabulaire = (fichier = path.join(DOSSIER_GENERATEUR, 'schemaorg', 'vocabulaire.json')) => {
  const brut = JSON.parse(readFileSync(fichier, 'utf8'));
  const ancetres = new Map();
  const ancetresDe = (type) => {
    if (ancetres.has(type)) return ancetres.get(type);
    const tous = new Set([type]);
    ancetres.set(type, tous);
    for (const parent of brut.types[type] ?? []) for (const a of ancetresDe(parent)) tous.add(a);
    return tous;
  };
  for (const type of Object.keys(brut.types)) ancetresDe(type);
  return { ...brut, ancetresDe };
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_HEURE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const URL_ABSOLUE = /^https:\/\/[^\s]+$/;
const typesDe = (noeud) => [].concat(noeud?.['@type'] ?? []);
const estUnObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estUneReference = (v) => estUnObjet(v) && Object.keys(v).length === 1 && typeof v['@id'] === 'string';

// ---------- 1. schema.org ----------

const validerSchema = (vocabulaire, noeud, chemin, erreurs) => {
  const types = typesDe(noeud);
  if (types.length === 0) {
    erreurs.push(`${chemin} : un nœud sans @type`);
    return;
  }
  for (const type of types) if (!(type in vocabulaire.types)) erreurs.push(`${chemin} : le type « ${type} » n’existe pas dans schema.org ${vocabulaire.version}`);
  const ancetres = new Set(types.flatMap((type) => (type in vocabulaire.types ? [...vocabulaire.ancetresDe(type)] : [])));

  for (const [cle, valeur] of Object.entries(noeud)) {
    if (cle.startsWith('@')) continue;
    const propriete = vocabulaire.proprietes[cle];
    if (!propriete) {
      erreurs.push(`${chemin}.${cle} : la propriété « ${cle} » n’existe pas dans schema.org ${vocabulaire.version}`);
      continue;
    }
    if (!propriete.domaines.some((domaine) => ancetres.has(domaine))) {
      erreurs.push(`${chemin}.${cle} : « ${cle} » ne va pas sur ${types.join(', ')} (seulement sur ${propriete.domaines.join(', ')})`);
    }
    [].concat(valeur).forEach((v, i) => validerUneValeur(vocabulaire, propriete, v, Array.isArray(valeur) ? `${chemin}.${cle}[${i}]` : `${chemin}.${cle}`, erreurs));
  }
};

const validerUneValeur = (vocabulaire, propriete, valeur, chemin, erreurs) => {
  const accepte = propriete.accepte;
  const accepteUnTypeDeDonnees = (genre) => accepte.some((t) => vocabulaire.ancetresDe(t).has(genre));
  const donnees = accepte.filter((t) => vocabulaire.typesDeDonnees.some((d) => vocabulaire.ancetresDe(t).has(d)));
  if (estUneReference(valeur)) return;
  if (estUnObjet(valeur)) {
    validerSchema(vocabulaire, valeur, chemin, erreurs);
    const ok = typesDe(valeur).some((type) => type in vocabulaire.types && accepte.some((t) => vocabulaire.ancetresDe(type).has(t)));
    if (!ok) erreurs.push(`${chemin} : un ${typesDe(valeur).join(', ')} là où schema.org attend ${accepte.join(', ')}`);
    return;
  }
  if (typeof valeur === 'string') {
    // Une valeur d’énumération s’écrit par son adresse (https://schema.org/EventScheduled).
    if (valeur.startsWith(SCHEMA) && vocabulaire.valeurs[valeur.slice(SCHEMA.length)]) {
      const enumerations = vocabulaire.valeurs[valeur.slice(SCHEMA.length)];
      if (!enumerations.some((e) => accepte.some((t) => vocabulaire.ancetresDe(e).has(t)))) {
        erreurs.push(`${chemin} : « ${valeur} » n’est pas une valeur de ${accepte.join(', ')}`);
      }
      return;
    }
    const enumerationSeule = accepte.length > 0 && accepte.every((t) => vocabulaire.ancetresDe(t).has('Enumeration'));
    if (enumerationSeule) {
      erreurs.push(`${chemin} : « ${valeur} » n’est pas une valeur de ${accepte.join(', ')}`);
      return;
    }
    const dateSeule = donnees.length > 0 && donnees.every((t) => ['Date', 'DateTime'].includes(t));
    if (dateSeule && !ISO_DATE.test(valeur) && !ISO_DATE_HEURE.test(valeur)) erreurs.push(`${chemin} : « ${valeur} » n’est pas une date ISO 8601`);
    // Un texte va là où schema.org accepte un texte ; une adresse absolue désigne aussi une chose (l’« item » d’un
    // fil d’Ariane).
    if (!accepteUnTypeDeDonnees('Text') && !accepteUnTypeDeDonnees('Date') && !accepteUnTypeDeDonnees('DateTime') && !accepteUnTypeDeDonnees('Time') && !URL_ABSOLUE.test(valeur)) {
      erreurs.push(`${chemin} : un texte là où schema.org attend ${accepte.join(', ')}`);
    }
    if (accepte.length === 1 && accepte[0] === 'URL' && !URL_ABSOLUE.test(valeur)) erreurs.push(`${chemin} : « ${valeur} » n’est pas une adresse absolue en https`);
    return;
  }
  if (typeof valeur === 'number') {
    if (!accepteUnTypeDeDonnees('Number') && !accepteUnTypeDeDonnees('Text')) erreurs.push(`${chemin} : un nombre là où schema.org attend ${accepte.join(', ')}`);
    return;
  }
  if (typeof valeur === 'boolean') {
    if (!accepteUnTypeDeDonnees('Boolean')) erreurs.push(`${chemin} : un booléen là où schema.org attend ${accepte.join(', ')}`);
    return;
  }
  erreurs.push(`${chemin} : une valeur vide ou illisible`);
};

// ---------- 2. Google ----------

const STATUTS_GOOGLE = ['EventScheduled', 'EventCancelled', 'EventPostponed', 'EventRescheduled', 'EventMovedOnline'].map((s) => `${SCHEMA}${s}`);
const MODES = ['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode'].map((s) => `${SCHEMA}${s}`);
const rempli = (v) => typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null;

const validerUnEvenement = (vocabulaire, evenement, chemin, erreurs) => {
  if (!rempli(evenement.name)) erreurs.push(`${chemin} : Event sans name (exigé par Google)`);
  if (!ISO_DATE.test(evenement.startDate ?? '') && !ISO_DATE_HEURE.test(evenement.startDate ?? '')) {
    erreurs.push(`${chemin} : Event sans startDate ISO 8601 avec son décalage (exigé par Google)`);
  }
  const lieu = evenement.location;
  if (!estUnObjet(lieu) || !typesDe(lieu).some((t) => vocabulaire.ancetresDe(t)?.has('Place'))) {
    erreurs.push(`${chemin} : Event sans location de type Place (exigé par Google)`);
  } else {
    if (!rempli(lieu.name)) erreurs.push(`${chemin}.location : lieu sans name (exigé par Google)`);
    const adresse = lieu.address;
    if (!estUnObjet(adresse) || !typesDe(adresse).includes('PostalAddress')) {
      erreurs.push(`${chemin}.location : lieu sans address PostalAddress (exigé par Google)`);
    } else {
      for (const cle of ['streetAddress', 'addressLocality', 'postalCode', 'addressCountry']) {
        if (!rempli(adresse[cle])) erreurs.push(`${chemin}.location.address : ${cle} manque`);
      }
    }
  }
  if (evenement.eventStatus !== undefined && !STATUTS_GOOGLE.includes(evenement.eventStatus)) erreurs.push(`${chemin} : eventStatus inconnu de Google`);
  if (evenement.eventAttendanceMode !== undefined && !MODES.includes(evenement.eventAttendanceMode)) erreurs.push(`${chemin} : eventAttendanceMode inconnu`);
  const images = [].concat(evenement.image ?? []);
  if (images.length === 0 || images.some((image) => typeof image !== 'string' || !URL_ABSOLUE.test(image))) {
    erreurs.push(`${chemin} : Event sans image en adresse absolue (recommandé par Google, exigé ici)`);
  }
  for (const offre of [].concat(evenement.offers ?? [])) {
    for (const cle of ['url', 'price', 'priceCurrency', 'availability']) if (!rempli(offre[cle])) erreurs.push(`${chemin}.offers : ${cle} manque`);
  }
};

const validerUnFil = (fil, chemin, erreurs) => {
  const elements = [].concat(fil.itemListElement ?? []);
  if (elements.length < 2) erreurs.push(`${chemin} : un fil d’Ariane a au moins deux éléments`);
  elements.forEach((element, i) => {
    const ici = `${chemin}.itemListElement[${i}]`;
    if (!typesDe(element).includes('ListItem')) erreurs.push(`${ici} : un ListItem est attendu`);
    if (element.position !== i + 1) erreurs.push(`${ici} : position ${element.position}, ${i + 1} attendu`);
    if (!rempli(element.name)) erreurs.push(`${ici} : name manque (exigé par Google)`);
    const dernier = i === elements.length - 1;
    if (!dernier && !(typeof element.item === 'string' && URL_ABSOLUE.test(element.item))) erreurs.push(`${ici} : item manque ou n’est pas une adresse absolue (exigé par Google)`);
  });
};

// Tous les nœuds d’un bloc, imbriqués compris, avec leur chemin.
const parcourir = (valeur, chemin, visite) => {
  if (Array.isArray(valeur)) {
    valeur.forEach((v, i) => parcourir(v, `${chemin}[${i}]`, visite));
    return;
  }
  if (!estUnObjet(valeur)) return;
  visite(valeur, chemin);
  for (const [cle, v] of Object.entries(valeur)) if (!cle.startsWith('@')) parcourir(v, `${chemin}.${cle}`, visite);
};

// Un bloc JSON-LD → la liste de ses erreurs (vide s’il est juste).
export const validerUnBloc = (vocabulaire, bloc) => {
  const erreurs = [];
  if (bloc?.['@context'] !== 'https://schema.org') erreurs.push('@context : « https://schema.org » attendu');
  const racines = bloc?.['@graph'] ? [].concat(bloc['@graph']) : [bloc];
  racines.forEach((noeud, i) => {
    const chemin = bloc['@graph'] ? `@graph[${i}]` : 'racine';
    validerSchema(vocabulaire, noeud, chemin, erreurs);
  });
  racines.forEach((noeud, i) => parcourir(noeud, bloc['@graph'] ? `@graph[${i}]` : 'racine', (n, chemin) => {
    const types = typesDe(n);
    // Les évènements que Google lit sont ceux de premier niveau (le match dont parle une soirée n’en est pas un).
    if (chemin.split('.').length === 1 && types.some((t) => vocabulaire.ancetresDe(t)?.has('Event'))) validerUnEvenement(vocabulaire, n, chemin, erreurs);
    if (types.includes('BreadcrumbList')) validerUnFil(n, chemin, erreurs);
  }));
  return erreurs;
};

// Les blocs JSON-LD d’une page HTML, lus tels qu’un robot les lit.
export const blocsDe = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

export const validerLaPage = (vocabulaire, html) => blocsDe(html).flatMap((bloc) => validerUnBloc(vocabulaire, bloc));
