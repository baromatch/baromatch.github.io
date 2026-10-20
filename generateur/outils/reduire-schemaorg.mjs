// Réduit le vocabulaire officiel de schema.org (le fichier schemaorg-current-https.jsonld d’une version publiée) à ce
// que le validateur du générateur lit : chaque type et ses parents, chaque propriété avec les types qui la portent et
// ceux qu’elle accepte, chaque valeur d’énumération et son énumération. Les descriptions, exemples et équivalences ne
// sont pas gardés. Le résultat, generateur/schemaorg/vocabulaire.json, est relu par validateur.mjs.
// Usage : node generateur/outils/reduire-schemaorg.mjs <version> [fichier déjà téléchargé]
//   sans fichier, le vocabulaire de cette version est lu sur schema.org.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ici, '..', 'schemaorg', 'vocabulaire.json');

const nom = (id) => String(id).replace(/^schema:/, '').replace(/^https?:\/\/schema\.org\//, '');
const liste = (valeur) => [].concat(valeur ?? []).map((v) => nom(v['@id'] ?? v)).sort();
const estDeSchema = (noeud) => String(noeud['@id']).startsWith('schema:');

export const reduire = (officiel) => {
  const graphe = officiel['@graph'];
  const types = {};
  const typesDeDonnees = [];
  const proprietes = {};
  const valeurs = {};
  for (const noeud of graphe.filter(estDeSchema)) {
    const genres = [].concat(noeud['@type']);
    if (genres.includes('rdfs:Class')) {
      types[nom(noeud['@id'])] = liste(noeud['rdfs:subClassOf']).filter((parent) => !parent.includes(':'));
      if (genres.includes('schema:DataType')) typesDeDonnees.push(nom(noeud['@id']));
    } else if (genres.includes('rdf:Property')) {
      proprietes[nom(noeud['@id'])] = { domaines: liste(noeud['schema:domainIncludes']), accepte: liste(noeud['schema:rangeIncludes']) };
    } else {
      // Une valeur d’énumération (EventScheduled, de type EventStatusType…).
      valeurs[nom(noeud['@id'])] = genres.map(nom).sort();
    }
  }
  // Les types de données de base (Text, URL, Date…) sont aussi des types : DataType les rassemble.
  for (const type of Object.keys(types)) if (types[type].includes('DataType') && !typesDeDonnees.includes(type)) typesDeDonnees.push(type);
  const trier = (objet) => Object.fromEntries(Object.entries(objet).sort(([a], [b]) => a.localeCompare(b)));
  return { types: trier(types), typesDeDonnees: typesDeDonnees.sort(), proprietes: trier(proprietes), valeurs: trier(valeurs) };
};

// Une entrée par ligne : le fichier se relit et se compare d’une version à l’autre.
const ecrire = (version, source, reduit) => {
  const bloc = (objet) => Object.entries(objet).map(([cle, valeur]) => `    ${JSON.stringify(cle)}: ${JSON.stringify(valeur)}`).join(',\n');
  const texte = [
    '{',
    `  "_lisezMoi": ${JSON.stringify('Le vocabulaire de schema.org, réduit à ce que lit le validateur du générateur (types, propriétés, valeurs d’énumération). Pour changer de version : node generateur/outils/reduire-schemaorg.mjs <version>.')},`,
    `  "version": ${JSON.stringify(version)},`,
    `  "source": ${JSON.stringify(source)},`,
    `  "typesDeDonnees": ${JSON.stringify(reduit.typesDeDonnees)},`,
    `  "types": {\n${bloc(reduit.types)}\n  },`,
    `  "proprietes": {\n${bloc(reduit.proprietes)}\n  },`,
    `  "valeurs": {\n${bloc(reduit.valeurs)}\n  }`,
    '}',
  ].join('\n');
  writeFileSync(SORTIE, `${texte}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [version, fichier] = process.argv.slice(2);
  if (!version) throw new Error('Usage : node generateur/outils/reduire-schemaorg.mjs <version> [fichier]');
  const source = `https://schema.org/version/${version}/schemaorg-current-https.jsonld`;
  const officiel = fichier ? JSON.parse(readFileSync(fichier, 'utf8')) : await (await fetch(source)).json();
  const reduit = reduire(officiel);
  ecrire(version, source, reduit);
  console.log(`${SORTIE} : version ${version}, ${Object.keys(reduit.types).length} types, ${Object.keys(reduit.proprietes).length} propriétés, ${Object.keys(reduit.valeurs).length} valeurs`);
}
