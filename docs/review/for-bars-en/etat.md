# « For bars », la page des bars en anglais : où en est la mission

Mis à jour à chaque étape (la session peut s’arrêter d’un coup).

- [x] `main` fusionné dans la branche (26/11, conflit du plan du site résolu, mesure : rien à réécrire).
- [ ] La suite entière, trois fois de suite.
- [x] « L’appli est en anglais si le téléphone l’est » : retirée (pas prouvable depuis ce dépôt).
- [x] Aucun mot de boisson, aucun « ! » sur la page anglaise (relu, et confirmé par la relecture à froid).
- [x] Lighthouse téléphone, trois passages : vitesse 99, accessibilité 100, bonnes pratiques 100, SEO 100, CLS 0, LCP 2,1 s, 319 Kio (la page française : 99, 100, 100, 100, CLS 0, 315 Kio).
- [x] Captures 390 px et 1440 px, texte à 200 % : `captures/`, français à gauche, anglais à droite ; aucun défilement de côté.
- [x] Relecture « trois visiteurs » (agent à froid) : « prête avec de petites corrections » ; corrections faites (le haut de page dit ce qu’est Baromatch, un lien pour le fan, l’ancre de « Les bars que nous contactons », des tournures moins traduites).
- [x] Les phrases juridiques en anglais, pour le propriétaire (la note `juridique`, dans ce dossier), avec deux points à trancher.
- [ ] PR en brouillon vers `main` (le maestro fusionne après le oui du propriétaire).

## La première suite entière (26/11, après la fusion de `main`)

3 494 passées, 118 échouées. Deux échecs venaient de cette branche (le résumé de confidentialité, à cause de la
nouvelle section de `main` ; le dossier de relecture refusé par le test des documents publics) : corrigés. Les 115
autres échouaient aussi sur `main` seul, dans cette machine : le rendu des images et l’encodeur des QR codes
(`generateur/images`) n’y étaient pas installés. Installés comme la CI le fait (`npm ci --ignore-scripts` dans
`generateur/images`), ils passent. Les trois suites entières sont en cours.
