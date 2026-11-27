**Brouillon : ne pas fusionner avant le oui du propriétaire.** Fusionner dans `main` publie tout de suite ; c’est le maestro qui fusionnera.

## Ce que fait cette PR

La page « Pour les bars » en anglais, à `/en/for-bars/` : écrite à la main, même formulaire, même serveur, même script que `pour-les-bars.html` (ses mots anglais dans un bloc JSON lu par `pour-les-bars.js`). Les liens dans les deux sens (hreflang et une phrase du haut de page), le plan du site, le résumé en anglais des deux sections de la Confidentialité qui concernent les bars.

- Le haut de page dit ce qu’est Baromatch, et un fan arrivé par erreur a un lien vers les pages des matchs en anglais (`/en/`).
- Retirée : « It is in English when the phone is set to English » (pas prouvable ici). Un test le garde.
- Aucun mot de boisson, aucun « ! » (relu, et par la relecture à froid).
- `main` fusionné (jamais de rebase) ; l’accueil n’est pas touché.

## Validé par le propriétaire (27/11)

- `docs/review/for-bars-en/juridique.md` : les phrases juridiques en anglais, avec la phrase française sous chacune. Les deux points sont tranchés : la phrase « ton téléphone et ton message si tu les donnes » reste dans les deux langues (le serveur accepte ces champs et les garde quand ils sont donnés) ; la case anglaise « I have read how Baromatch uses this information to reply to me » est approuvée.
- La mise en ligne est approuvée une fois les contrôles verts ; le maestro fusionne.
- `docs/review/for-bars-en/captures/` : français et anglais côte à côte (téléphone 390 px, ordinateur 1440 px, texte à 200 %).

## Preuves

- La suite entière, trois fois de suite : 3 615 passées, 0 échouée, trois fois de suite (27/11).
- Lighthouse téléphone, trois passages : vitesse 99, accessibilité 100, bonnes pratiques 100, SEO 100, CLS 0, LCP 2,1 s (la page française : les mêmes notes).
- Relecture « trois visiteurs » par un agent à froid (patron de pub anglophone à Paris, fan, journaliste) : « prête avec de petites corrections », corrections faites.
- Aucun défilement de côté à 390 px, 1440 px et texte à 200 %.

Note pour la machine de vérification : le rendu des images et l’encodeur des QR codes (`generateur/images`, `npm ci --ignore-scripts`) doivent être installés, comme dans la CI ; sans eux, 115 tests des affiches et des images échouent, sur `main` aussi.
