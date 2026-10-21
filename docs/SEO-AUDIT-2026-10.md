# Audit SEO de baromatch.fr — octobre 2026

Fait le 21 octobre 2026 sur le dépôt (la source du site), contre la documentation de Google Search Central et les
consignes de Bing. Chaque constat dit ce qu’on a vu, ce que ça change pour qui cherche Baromatch, et ce qui a été
fait (ou pourquoi rien n’a été fait).

## Comment cet audit a été fait

- **Le site** : lu dans le dépôt, page par page, générateur compris (`generateur/`), et servi en local comme GitHub
  Pages le sert, pour les mesures (Lighthouse 13.5, Chromium local) et les tests (`npx playwright test`).
- **La documentation** : lue le 21 octobre 2026. Une limite à dire franchement : depuis la machine de travail, les
  pages de Google, de Bing et d’IndexNow ne s’ouvrent pas directement (le réseau de la machine les refuse). Elles ont
  été lues à travers le moteur de recherche de l’outil, qui en rend des extraits, pas la page entière ; la date « Last
  updated » de chaque page n’a donc pas pu être lue. Le texte de llmstxt.org a été lu en entier (sa source, datée du
  10 août 2026). Les règles ci-dessous sont celles que ces extraits disent clairement ; avant de s’appuyer sur une
  citation exacte, rouvrir la page dans un navigateur.

Les pages citées :

| Sujet | Page |
|---|---|
| Règles contre le spam (contenu à grande échelle, pages satellites) | https://developers.google.com/search/docs/essentials/spam-policies |
| Contenu utile, fiable, écrit pour les gens | https://developers.google.com/search/docs/fundamentals/creating-helpful-content |
| Bloquer l’indexation (noindex) | https://developers.google.com/search/docs/crawling-indexing/block-indexing |
| La balise meta robots | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag |
| Adresses canoniques | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls |
| Plan du site (sitemap) | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| Versions par langue (hreflang) | https://developers.google.com/search/docs/specialty/international/localized-versions |
| Codes HTTP, 404 et « soft 404 » | https://developers.google.com/crawling/docs/troubleshooting/http-status-codes |
| Titres | https://developers.google.com/search/docs/appearance/title-link |
| Descriptions (extraits) | https://developers.google.com/search/docs/appearance/snippet |
| Données structurées : règles générales | https://developers.google.com/search/docs/appearance/structured-data/sd-policies |
| Organization | https://developers.google.com/search/docs/appearance/structured-data/organization |
| Fil d’Ariane (BreadcrumbList) | https://developers.google.com/search/docs/appearance/structured-data/breadcrumb |
| Event | https://developers.google.com/search/docs/appearance/structured-data/event |
| Application (Software App) | https://developers.google.com/search/docs/appearance/structured-data/software-app |
| Fin des résultats enrichis FAQ, et autres retraits | https://developers.google.com/search/updates · https://developers.google.com/search/blog/2025/06/simplifying-search-results |
| Signaux Web essentiels (Core Web Vitals) | https://developers.google.com/search/docs/appearance/core-web-vitals |
| Images | https://developers.google.com/search/docs/appearance/google-images |
| Liens | https://developers.google.com/search/docs/crawling-indexing/links-crawlable |
| Fonctions d’IA de Google (AI Overviews, AI Mode) | https://developers.google.com/search/docs/appearance/ai-features |
| Indexation mobile d’abord | https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing |
| Consignes de Bing | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a |
| Ajouter et vérifier un site dans Bing | https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b |
| IndexNow | https://www.indexnow.org/documentation |
| llms.txt | https://llmstxt.org/ |
| Vérifier un domaine dans Search Console | https://support.google.com/webmasters/answer/9008080 |

## Ce qu’il faut retenir

1. **Le site est propre techniquement**, et déjà rapide (Performance 98 à 99 sur mobile, 100 sur ordinateur). Les règles de base sont tenues
   et vérifiées par les tests : une adresse canonique par page, un seul h1, des titres et des descriptions aux
   bonnes longueurs, un plan du site avec de vraies dates, hreflang seulement entre pages indexables.
2. **Le vrai frein était ailleurs : presque rien n’était indexable.** Aucun bar n’est encore publié (aucun accord
   écrit pour l’instant), et le générateur met exprès en noindex toute page qui a besoin d’un bar pour être utile
   (matchs, villes, semaine, « Ce soir »). Résultat : dix pages fixes et l’affiche de la semaine dans l’index, et
   rien qui réponde à « où regarder le match du PSG ». C’est le bon choix contre les pages minces, mais il fallait des
   pages qui soient utiles **sans** bar.
3. **Ce qui a été ajouté** : une page par club suivi et par compétition, faites des vrais matchs ; un guide écrit à
   la main ; « Ton club dans ton agenda » indexable ; les faits clés dans le texte de l’accueil et d’À propos ; un
   llms.txt plus complet.

## Les constats

### Indexation

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| I1 | Sans bar publié, toutes les pages générées sont en noindex, sauf l’affiche de la semaine. | Aucune page ne peut ressortir sur une recherche de match, de club ou de compétition. | **Fait.** Pages par club et par compétition, indexables dès qu’elles ont au moins 2 matchs à venir, même sans bar (voir « Nouvelles pages »). |
| I2 | « Ton club dans ton agenda » (`/agenda/`) était en noindex tant qu’aucun bar n’est publié, alors qu’elle ne dépend d’aucun bar. | Un outil utile (l’agenda d’un club dans son téléphone) invisible. | **Fait.** Indexable dès qu’un club de Ligue 1 a un match à venir (ou dès qu’un bar est publié, comme avant). Test : `tests/agenda.spec.mjs`. |
| I3 | La semaine (`/matchs/`), « Ce soir » et les villes restent en noindex sans bar. | Google suit les liens d’une page en noindex, mais rien ne garantit qu’il le fasse longtemps. | **Fait** autrement : les nouvelles pages sont aussi reliées depuis des pages indexables (accueil → guide → chaque page) et seront au plan du site. Les garder en noindex sans bar reste le bon choix : sans bar, elles disent surtout « pas encore de bar ». Elles deviennent indexables avec les bars, comme prévu : la semaine, « Ce soir » et une ville qui a son guide dès le premier bar publié, une page de match dès 2 bars qui le diffusent. |
| I4 | robots.txt n’interdit que les outils (`/tests/`, `/generateur/`, l’état) et, maintenant, les deux documents de ce dossier. Aucune page en noindex n’y est bloquée. | Conforme : Google doit pouvoir lire une page pour voir son noindex. | Rien à faire. |
| I5 | Chaque page a son adresse canonique, absolue, vers elle-même ; la 404 n’en a pas (normal). | Conforme. | Rien à faire (déjà testé par `tests/seo.spec.mjs`). |
| I6 | Plan du site : seulement des pages indexables, sans `priority` ni `changefreq` (Google les ignore), avec la date du dernier vrai changement. | Conforme : Google n’utilise `lastmod` que s’il est juste. | Le guide y est ajouté. Les pages des clubs et des compétitions y entrent au premier passage de l’Action, avec leur date, et IndexNow est prévenu. |
| I7 | hreflang fr/en : seulement entre deux pages jumelles indexables, dans les deux sens, avec x-default vers le français. Aujourd’hui aucune paire n’est indexable (pas de bar à Paris), donc aucun hreflang n’est écrit. | Conforme. | Rien à faire. Les pages anglaises ne sont pas liées en hreflang aux nouvelles pages françaises : elles ne disent pas la même chose (elles parlent des bars de Paris). |
| I8 | 404 : `404.html` est servie avec le code 404 par GitHub Pages et dit noindex. Une page passée (match joué, bar parti) reste 30 jours en noindex, puis disparaît (404). | Conforme : pas de « soft 404 ». | Rien à faire. |
| I9 | Redirections : aucune dans le dépôt ; GitHub Pages ajoute la barre finale (`/matchs/club/psg` → `/matchs/club/psg/`). « Forcer HTTPS » et `www` → `baromatch.fr` se règlent dans GitHub et chez l’hébergeur du domaine, pas dans le dépôt. | À vérifier une fois. | **À faire par Skander** (voir sa liste, « SEO : à faire par Skander », à côté de ce document). |
| I10 | GitHub Pages sert aussi `/a-propos` sans `.html`. | Deux adresses pour une page ; l’adresse canonique règle la question. | Rien à faire. |

### Données structurées

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| D1 | Accueil : Organization (logo, contact, profil X), WebSite, MobileApplication. | Conforme : Organization n’a aucune propriété obligatoire. | Rien à changer. |
| D2 | MobileApplication ne dit que le vrai : ni prix, ni note, ni lien de magasin. Google ne montre de résultat enrichi « application » qu’avec un prix et une note ou des avis. | Pas de résultat enrichi pour l’appli, et c’est voulu : il n’y a ni magasin ni note aujourd’hui. | Rien à ajouter. Inventer une note serait contraire aux règles de Google et à celles du site. Le jour de l’ouverture : ajouter `operatingSystem` et `offers` (prix 0), jamais une note inventée. |
| D3 | FAQPage sur l’accueil et les villes. D’après le journal des changements de Google (https://developers.google.com/search/updates, à revérifier dans un navigateur), Google n’affiche plus de résultats FAQ depuis le 7 mai 2026. | Aucun gain, aucune pénalité. | Gardé tel quel (c’est du schema.org valide) ; aucune nouvelle page n’en ajoute. |
| D4 | Soirées dans un bar : Event avec un vrai lieu (BarOrPub et son adresse), le match en `about`. | Conforme : d’après la page Event de Google (à revérifier dans un navigateur), depuis juin 2025 seuls les évènements dans un lieu physique y ont droit. | Rien à changer. |
| D5 | Un SportsEvent seul sur chaque page de match (demandé « là où c’est valable ») : les données n’ont pas le stade. Google exige un lieu pour un Event. | Un SportsEvent sans lieu serait une erreur dans Search Console. | **Pas ajouté, exprès.** Il reste dans chaque soirée (`about`), où il est valable. |
| D6 | BreadcrumbList sur chaque page générée et sur les pages fixes qui ont un fil d’Ariane. | Conforme. | Les nouvelles pages en ont un. |
| D7 | Nouvelles pages : CollectionPage, BreadcrumbList, ItemList des matchs (chacun vers sa page) et des vrais bars ; le guide : Article. | Conforme ; tout passe le validateur du générateur (schema.org 30.1 et règles de Google). | **Fait.** |

### Titres, descriptions, liens

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| T1 | Titres de 15 à 60 caractères et descriptions de 70 à 160, uniques, vérifiés par le contrôle du générateur et les tests. Un titre ne promet des bars que si la page en montre. | Conforme. | Les nouvelles pages suivent la même règle : « Où regarder les matchs du PSG dans un bar » seulement avec un vrai bar, sinon « Matchs du PSG : quand et où les regarder » (testé dans `tests/suivre.spec.mjs` et `tests/generateur.spec.mjs`). La relecture l’avait trouvée manquante : corrigé. |
| T2 | Les liens sont de vrais `<a href>`, avec un texte qui dit où ils mènent. | Conforme. | Les pages de match et la semaine mènent maintenant aux pages des clubs et des compétitions (« Les matchs du PSG et où les voir »). |
| T3 | L’accueil disait ce qu’est Baromatch, mais pas en un seul endroit clair (où, quand, pour qui, qui, contact). | Les moteurs et les assistants doivent recoller des morceaux. | **Fait.** « Baromatch en bref » sur l’accueil et dans À propos, avec les mêmes phrases ; llms.txt les reprend. |

### Vitesse et téléphone

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| V1 | Mesuré avant tout changement (Lighthouse 13.5, mobile simulé) : Performance 98 à 99 sur mobile et 100 sur ordinateur, sur toutes les pages, LCP 2,1 à 2,4 s, CLS 0 à 0,03, TBT 0 à 60 ms. Les chiffres du PR donnent le détail avant et après. | Tous les seuils de Google sont tenus (LCP sous 2,5 s, CLS sous 0,1). | Les nouvelles pages ont le même gabarit et sont dans le budget de vitesse (`tests/budget-vitesse.spec.mjs`). |
| V2 | La police (Bricolage Grotesque, 121 Ko) pèse le plus. Elle est déjà réduite aux 204 caractères du français. | La réduire encore (graisses, largeurs) ne gagnerait qu’environ 6 %, et changerait le dessin des titres. | **Pas fait** : trop peu pour le risque. |
| V3 | styles.css (50 Ko, environ 12 Ko compressé par GitHub Pages) bloque l’affichage le temps d’arriver. | Quelques dizaines de millisecondes sur un téléphone moyen. | **Pas fait** : le découper par page casserait plus qu’il ne gagnerait. Le CSS en ligne n’est pas permis par la politique de sécurité, qui reste telle quelle. |
| V4 | Aucun script ne bloque l’affichage (tous `defer`), aucun site tiers, aucun cookie de suivi. La mesure d’audience reste celle d’avant (sans cookie, arrêtée tant que son code est vide). | Conforme. | Rien à changer. |
| V5 | Toutes les images ont un `alt`, une largeur et une hauteur ; WebP et SVG ; images de partage en 1200 × 630. | Conforme. | Rien à changer. |
| V6 | Mobile : même contenu qu’à l’ordinateur, cibles de 44 px, testé à 360 px. | Conforme à l’indexation mobile d’abord. | Le nouveau bloc « Baromatch en bref » tient la même règle. |
| V7 | Les pages écrites à la main n’avaient pas `twitter:image` (les pages générées l’ont). | X devine l’image depuis `og:image`, en général bien. | **Fait** : la même image, dite à X, sur chaque page ; testé. |

### Contenu et règles contre le spam

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| S1 | Le risque d’une page par club et par compétition : des pages presque identiques, faites pour se placer (« contenu à grande échelle », « pages satellites »). | Une pénalité possible, et des pages inutiles. | **Garde-fous** : 8 clubs et 8 compétitions, pas un de plus (aucune page « club × ville ») ; chacune faite de ses vrais matchs, avec son prochain match, ses heures, ses clubs, son agenda, sa ville ; noindex en dessous de 2 matchs à venir ; un titre qui ne promet pas de bar sans bar ; un test refuse que deux pages indexables partagent plus de 60 % de leurs suites de cinq mots (sur les matchs publiés aujourd’hui, au plus 53 %). |
| S2 | Les données ne donnent pas la chaîne qui diffuse un match. | Inventer une chaîne serait faux. | Les pages le disent : « Baromatch ne dit pas sur quelle chaîne passe un match ». Aucun logo, aucun nom de chaîne (testé). |
| S3 | Loi Evin : aucune offre de bar sur les nouvelles pages, aucune boisson nommée. | Conforme. | Testé. |

### Assistants d’IA et moteurs de réponse

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| A1 | llms.txt existait déjà, au format de llmstxt.org. Google dit ne demander aucun fichier particulier pour ses fonctions d’IA : ce qui compte est une page indexée, avec un texte clair. | llms.txt aide surtout les autres assistants ; le texte des pages compte pour tous. | **Fait** : llms.txt dit en plus où, pour qui, qui, « pas encore dans les magasins d’applications », que le site ne donne pas la chaîne, et mène au guide et aux 16 nouvelles pages. Les mêmes faits sont dans le HTML de l’accueil et d’À propos. |
| A2 | Rien n’interdit aux fonctions d’IA de reprendre le site (pas de `nosnippet`). | Les pages peuvent être citées. | Rien à changer. |

### Bing

| # | Constat | Effet | Ce qui est fait |
|---|---|---|---|
| B1 | IndexNow est déjà branché : la clé est à la racine, et l’Action prévient les moteurs de chaque page indexable qui change. | Bing (et Yandex, Seznam, Naver) relisent vite les pages qui changent. | Rien à changer. Les nouvelles pages lui seront envoyées à leur premier passage. |
| B2 | La place de la balise de vérification de Bing est prête dans l’accueil, vide. | Bing Webmaster Tools n’est pas encore relié. | **À faire par Skander** : le plus simple est d’importer le site depuis Google Search Console. |

## Nouvelles pages

| Page | Adresse | Indexable quand |
|---|---|---|
| Une par club : PSG, OM, OL, Lille, Lens, Monaco, Nice, Rennes | `/matchs/club/<club>/` | Le club a au moins 2 matchs à venir, ni reportés ni annulés |
| Une par compétition : Ligue 1, Ligue des champions, Ligue Europa, Ligue Conférence, Premier League, LaLiga, Serie A, Bundesliga | `/matchs/competition/<compétition>/` | La compétition a au moins 2 matchs à venir |
| Le guide « Comment trouver un bar qui diffuse le match » | `/trouver-un-bar-qui-diffuse-le-match.html` | Toujours (écrit à la main, sans rien qui dépende du jour) |

Les listes de clubs et de compétitions sont dans `generateur/contenu/suivre.json` : pour en ajouter un, une ligne
suffit, et les tests vérifient la nouvelle page.

## Ce que l’audit n’a pas pu vérifier

- Les données réelles de Search Console et de Bing (aucun accès d’ici) : impressions, pages indexées, erreurs.
- Les réglages de GitHub Pages (« Enforce HTTPS ») et du domaine (`www`).
- Les pages de Google et de Bing lues en entier, avec leur date (voir « Comment cet audit a été fait »).
- Les pages de matchs en direct : l’API des listes publiques ne répond pas depuis la machine de travail. Les pages des
  clubs et des compétitions du dépôt ont été faites des matchs déjà publiés (l’état du dépôt) ; l’Action les refait
  des vraies listes à son premier passage après la fusion.
