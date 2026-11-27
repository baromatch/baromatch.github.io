**Brouillon : ne pas fusionner avant le oui du propriétaire.** Fusionner dans `main` publie tout de suite ; c’est le maestro qui fusionnera.

## Ce que fait cette PR

La page « Pour les bars » en anglais, à `/en/for-bars/` : écrite à la main, même formulaire, même serveur, même script que `pour-les-bars.html` (ses mots anglais dans un bloc JSON lu par `pour-les-bars.js`). Les liens dans les deux sens (hreflang et une phrase du haut de page), le plan du site, le résumé en anglais des deux sections de la Confidentialité qui concernent les bars.

- Le haut de page dit ce qu’est Baromatch, et un fan arrivé par erreur a un lien vers les pages des matchs en anglais (`/en/`).
- Retirée : « It is in English when the phone is set to English » (pas prouvable ici). Un test le garde.
- Aucun mot de boisson, aucun « ! » (relu, et par la relecture à froid).
- `main` fusionné (jamais de rebase) ; l’accueil n’est pas touché.

## Validé par le propriétaire (27/11)

- La note `juridique.md` (dans le dossier de relecture de cette page) : les phrases juridiques en anglais, avec la phrase française sous chacune. Les deux points sont tranchés : la phrase « ton téléphone et ton message si tu les donnes » reste dans les deux langues (le serveur accepte ces champs et les garde quand ils sont donnés) ; la case anglaise « I have read how Baromatch uses this information to reply to me » est approuvée.
- La mise en ligne est approuvée une fois les contrôles verts ; le maestro fusionne.
- Les `captures` (même dossier) : français et anglais côte à côte (téléphone 390 px, ordinateur 1440 px, texte à 200 %).

## Preuves

- La suite entière, trois fois de suite : 3 615 passées, 0 échouée, trois fois de suite (27/11, avant la dernière fusion).
- `main` fusionné de nouveau le 27/11 (l’accueil sans « Testeurs Android », #54, et les pages des matchs ; un conflit du plan du site, les deux côtés gardés), par un commit de fusion.
- Après cette fusion, la suite entière une fois : 3 622 passées, 2 échouées (le test des documents publics, sur deux notes de ce dossier de relecture) ; corrigées dans les notes, le test n’est pas touché ; ce test seul ensuite : 545 passées, 0 échouée.
- Puis les 17 fichiers de tests que la branche et #54 touchent, trois fois de suite : 2 041 passées, 0 échouée, trois fois.
- La CI : sur une même tête, un passage vert et un rouge (1 échoué, 3 623 passés) : le test des commandes à 360 px de la page anglaise mesurait les commandes de la messagerie avant qu’elles paraissent. Corrigé à sa cause (il attend le message et chaque commande visible, comme son jumeau français ; le seuil de 44 px est inchangé). Ce fichier ensuite trois fois de suite : 64 passées, 0 échouée, trois fois ; puis `--repeat-each=5` : 320 passées, 0 échouée.
- Lighthouse téléphone, trois passages : vitesse 99, accessibilité 100, bonnes pratiques 100, SEO 100, CLS 0, LCP 2,1 s (la page française : les mêmes notes).
- Relecture « trois visiteurs » par un agent à froid (patron de pub anglophone à Paris, fan, journaliste) : « prête avec de petites corrections », corrections faites.
- Aucun défilement de côté à 390 px, 1440 px et texte à 200 %.

Note pour la machine de vérification : le rendu des images et l’encodeur des QR codes (`generateur/images`, `npm ci --ignore-scripts`) doivent être installés, comme dans la CI ; sans eux, 115 tests des affiches et des images échouent, sur `main` aussi.
