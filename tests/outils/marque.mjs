// marque.json, la carte d’identité de Baromatch, lue une fois pour les tests : le nom, les phrases, le contact,
// les profils et l’état de l’appli. PROFILS : les adresses des profils remplis (un profil vide n’est écrit nulle
// part), dans l’ordre du fichier ; c’est exactement la liste « sameAs » de chaque page.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './environnement.mjs';

export const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
export const PROFILS = Object.values(MARQUE.profils).map((adresse) => adresse.trim()).filter(Boolean);
