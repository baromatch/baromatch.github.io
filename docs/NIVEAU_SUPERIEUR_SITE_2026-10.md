# baromatch.fr au niveau supérieur : le plan

Mis à jour le 26 octobre 2026. Ce plan classe ce qu’on change sur le site, dans l’ordre où ça rapporte le plus.
Chaque ligne dit ce qu’elle apporte, combien de travail elle demande, et ce qui pourrait mal tourner.

## En bref

- **Le site est déjà rapide et accessible.** Lighthouse donne 97 à 100 en vitesse et 100 en accessibilité sur
  les pages mesurées (tableau plus bas). La vitesse n’est pas le grand levier : on la garde, on ne la refait pas.
- **Le grand levier : que les premiers bars nous écrivent.** Le second : que les fans laissent leur adresse
  pour le lancement. Le site parle surtout aux fans ; les bars le trouvent par le lien que tu leur envoies, par
  l’en-tête « Pour les bars » et, un peu, par Google.
- **L’ordre** : d’abord ce qui est vrai et clair pour un patron de bar ; puis ce qui mène chaque visiteur au
  formulaire des bars ; puis ce que tu montres quand tu démarches un bar ; puis la confiance.
- **Rien d’inventé** : aucun faux bar, aucun faux avis, aucun chiffre qu’on ne mesure pas. Les pages des matchs
  restent hors de Google tant qu’aucun bar n’est publié.
- **Ce qui attend ta réponse** est regroupé juste en dessous : six réponses, et quatre vérifications sans code.

## Les chiffres de départ (26 octobre 2026)

Lighthouse 13.5, la médiane de 3 passages, site servi sur la machine de travail comme GitHub Pages le sert.
Vitesse, accessibilité et SEO sont des notes sur 100. LCP : le temps d’affichage du plus gros élément. CLS : ce qui
bouge pendant le chargement (0 = rien).

| Page | Appareil | Vitesse | Accessibilité | SEO | LCP | CLS | Poids |
|---|---|---|---|---|---|---|---|
| Accueil | téléphone | 98 | 100 | 100 | 2,2 s | 0 | 241 Ko |
| Accueil | ordinateur | 100 | 100 | 100 | 0,5 s | 0 | 240 Ko |
| Pour les bars | téléphone | 97 | 100 | 100 | 2,5 s | 0,033 | 418 Ko |
| Pour les bars | ordinateur | 100 | 100 | 100 | 0,5 s | 0,01 | 421 Ko |
| Ce soir | téléphone | 98 | 100 | 66 | 2,3 s | 0 | 214 Ko |
| Les matchs de la semaine | téléphone | 98 | 100 | 66 | 2,3 s | 0 | 221 Ko |
| Une page de match | téléphone | 98 | 100 | 66 | 2,3 s | 0 | 211 Ko |
| Paris (page de ville) | téléphone | 98 | 100 | 66 | 2,3 s | 0 | 218 Ko |
| À propos | téléphone | 99 | 100 | 100 | 2,1 s | 0 | 195 Ko |
| Deviens testeur Android | téléphone | 99 | 100 | 100 | 2,1 s | 0 | 196 Ko |

Le SEO à 66 est voulu : ces pages disent « noindex » tant qu’aucun bar n’est publié. Sur ordinateur, toutes les
pages mesurées font 100 en vitesse. Chaque changement visible donnera ses chiffres avant et après.

## Avant tout : tes réponses et quatre vérifications (sans code)

**Tes six réponses.** Chacune débloque une ligne du classement.

1. **Tutoyer ou vouvoyer les bars ?** La consigne de la mission dit « vouvoiement pour les bars ». Le site, ses
   textes générés, les affiches et la Console des bars tutoient aujourd’hui. Ma recommandation : garder le « tu »,
   pour que le bar lise la même voix sur le site et dans la Console. En attendant, rien ne change.
2. **Un délai de réponse que tu tiens chaque semaine**, même les soirs de match et en vacances (par exemple « sous
   2 jours ouvrés »). Un délai annoncé et pas tenu fait plus de mal que pas de délai.
3. **Les conditions pour les premiers bars** : ce qu’ils paient pendant le test et après, une carte bancaire ou non,
   un engagement ou non. Aujourd’hui la page dit quatre fois « tarif à préciser ».
4. **Le titre de la page des bars.** « Remplis ton bar les soirs de match » promet un résultat que rien ne mesure
   encore, et c’est aussi le texte de l’image qui s’affiche quand tu envoies la page par WhatsApp. Une proposition :
   « Les soirs de match, ton bar sur Baromatch ».
5. **Le badge « On diffuse le match · sur Baromatch »** : le garder sur la page des bars, ou le retirer jusqu’au
   premier bar publié (personne n’est encore « sur Baromatch »).
6. **Tes mots de fondateur** pour « À propos » et « Presse » : pourquoi Baromatch, tes soirs de match à Paris, ce que
   tu refuses de faire. Trois à cinq phrases, avec ou sans photo. Rien n’est écrit à ta place.

**Quatre vérifications, de ton côté.**

1. **Google Search Console** : regarde si « Pour les bars » et « L’affiche de la semaine » sont indexées. Sinon,
   demande leur indexation (bouton « Demander une indexation »).
2. **Formspree** : quelle formule, combien d’inscriptions par mois ? Un seul formulaire reçoit la liste d’attente,
   le test Android et la boutique. S’il est plein, l’inscription des testeurs s’arrête aussi. À vérifier avant de
   pousser plus de fans vers la liste d’attente (lignes 3, 4 et 11).
3. **Les demandes des bars** : la page Confidentialité explique qu’une demande peut, rarement, ne pas t’arriver par
   mail. Avant d’annoncer un délai de réponse, il te faut un moyen de voir ces demandes-là. C’est à faire côté appli,
   pas sur le site.
4. **Demande à chaque bar comment il nous a trouvés.** Le site ne compte pas ses visites et ne suit personne ; avec
   quelques demandes par semaine, c’est la seule mesure honnête de ce qui marche.

## Le classement

Les quatre buts, notés de 0 à 3 : **bars** (des bars qui nous écrivent), **fans** (des fans qui laissent leur
adresse), **recherche** (des visites venues de Google), **confiance**. Effort : **S** = moins d’une demi-journée,
**M** = environ une journée. « Je fusionne » : la mission peut la mettre en ligne seule, selon ses règles strictes ;
sinon elle attend le maestro, ou ta réponse.

| Rang | Changement | Bars | Fans | Recherche | Confiance | Effort | Qui |
|---|---|---|---|---|---|---|---|
| 1 | Page des bars : dire où on en est, et les faits qu’un patron cherche | 2 | 0 | 0 | 3 | S | je fusionne |
| 2 | Pages des matchs, clubs, compétitions et villes : « Tu tiens un bar ? » devient une carte vraie, qui mène au formulaire | 2 | 0 | 0 | 1 | S | je fusionne |
| 3 | Accueil : les bars juste après « Comment ça va marcher », la boutique à la fin, « préviens-moi » plus bas | 1 | 2 | 0 | 0 | S | je fusionne |
| 4 | Fin du guide, d’« À propos » et de « Comment on choisit les bars » : deux cartes, une pour les fans, une pour les bars | 1 | 1 | 0 | 1 | S | je fusionne |
| 5 | L’affiche de la semaine : sa propre image de partage, « foot » dans son titre, un lien vers le formulaire | 2 | 0 | 1 | 1 | M | je fusionne |
| 6 | La feuille « Pour le patron » : une page A5 à imprimer et à laisser au comptoir, avec un QR code vers la page des bars | 2 | 0 | 0 | 1 | M | je fusionne |
| 7 | Page des bars : qui répond, en combien de temps, et quoi faire en attendant | 2 | 1 | 0 | 2 | S | après tes réponses 2 et la vérification 3 |
| 8 | Page des bars : le titre, l’image de partage et les conditions pour les premiers bars | 3 | 0 | 1 | 2 | M | après tes réponses 3 et 4 |
| 9 | Le badge retiré de la page des bars jusqu’au premier bar publié | 1 | 0 | 0 | 2 | S | après ta réponse 5 |
| 10 | Tes mots de fondateur sur « À propos » et « Presse » | 1 | 0 | 0 | 3 | S | après ta réponse 6 |
| 11 | Après l’inscription d’un fan : partager Baromatch, et envoyer la page des bars à son bar | 1 | 2 | 0 | 0 | M | après ton accord sur deux phrases |
| 12 | Accueil et agenda : des liens vers les pages des clubs | 0 | 1 | 2 | 0 | S | je fusionne |
| 13 | Le champ d’adresse de la liste d’attente : un contour et une erreur bien visibles, aussi en mode contraste élevé | 0 | 1 | 0 | 1 | S | je fusionne |
| 14 | « Pour les bars » plus visible dans l’en-tête, en capsule de verre | 1 | 0 | 0 | 1 | S | je fusionne |
| 15 | La liste d’attente sur les pages des clubs, des compétitions, des matchs et de « Ce soir » | 0 | 2 | 0 | 0 | M | le maestro (la page Confidentialité change) |

### 1. Page des bars : dire où on en est, et les faits qu’un patron cherche

- **Ce qu’on voit** : sous le titre, une phrase claire : l’appli n’est pas encore ouverte au public, les fans ne
  réservent pas encore. Plus bas, deux faits déjà publiés ailleurs sur le site : un bar n’apparaît qu’avec son
  accord écrit, et aucun bar ne paie pour passer devant ; avec un lien vers « Comment on choisit les bars ». Un
  bouton « Proposer mon bar » après « Ton soir de match, heure par heure », là où un patron convaincu n’en a plus.
- **Pourquoi** : la page décrit les réservations au présent, alors que l’appli n’est pas ouverte. Un patron qui le
  découvre plus tard ne nous croira plus.
- **Risque** : la phrase devient fausse le jour de l’ouverture. Un test la lie à l’état de l’appli écrit dans
  `marque.json` : il échoue le jour où l’appli ouvre, tant que la phrase n’a pas changé. La page doit rester sous sa
  taille maximale (73 000 octets ; elle en fait 71 775).
- **Preuve** : tests de la page, captures avant et après, Lighthouse.

### 2. Pages des matchs, clubs, compétitions et villes : une carte vraie pour les bars

- **Ce qu’on voit** : sur les 74 pages qui disent « Pas encore de bar », le paragraphe « Tu tiens un bar ? » devient
  une petite carte de verre avec « Proposer mon bar », qui mène droit au formulaire. Parmi elles, les 8 pages de
  clubs et les 7 pages de compétitions sont dans le plan du site : ouvertes à Google.
- **Pourquoi** : la phrase actuelle dit « les fans qui cherchent où le voir te trouvent » : c’est faux tant que
  l’appli n’est pas ouverte. Elle devient la phrase déjà publiée sur la page des bars : « Baromatch cherche ses
  premiers bars à Paris. » La même chose en anglais. Le lien de l’affiche de la semaine mène aussi au formulaire.
- **Risque** : deux appels sur le même écran ; la carte reste en verre, l’ambre reste aux fans. Toutes les pages
  générées changent au passage suivant du générateur.
- **Preuve** : tests du générateur, captures d’une page de club et d’une page de match.

### 3. Accueil : les bars plus haut, la boutique à la fin, « préviens-moi » plus bas

- **Ce qu’on voit** : la bande « Ton bar diffuse les matchs ? » arrive juste après « Comment ça va marcher » au lieu
  d’être tout en bas, après la boutique. Deux rappels « L’appli ouvre bientôt : préviens-moi » plus bas dans la page.
  Le bouton des bars mène droit au formulaire.
- **Pourquoi** : sur ordinateur, le formulaire n’est pas dans le premier écran ; plus bas, le seul lien vers la liste
  d’attente est caché dans une réponse de la FAQ.
- **Risque** : faible. Les mots ne changent pas. À faire après la vérification Formspree.
- **Preuve** : tests de l’accueil, captures 360 et 1280 px, Lighthouse.

### 4. Deux cartes d’action en fin de page

- **Ce qu’on voit** : à la fin du guide « Trouver un bar qui diffuse le match », d’« À propos » et de « Comment on
  choisit les bars » : une carte pour les fans (« préviens-moi ») et une pour les bars (« Proposer mon bar »).
  Des liens seulement, aucun formulaire.
- **Pourquoi** : ces pages sont indexées et finissent sur un paragraphe. Les mots existent déjà sur le site.
- **Risque** : faire publicité sur une page de conseils ; les cartes restent courtes, après le contenu.

### 5. L’affiche de la semaine, prête à partager

- **Ce qu’on voit** : quand tu envoies l’affiche à un bar par WhatsApp, l’aperçu dit « L’affiche des matchs de la
  semaine, du … au …, gratuite, à imprimer » au lieu du slogan des fans. Son titre dit « matchs de foot ». Son lien
  « Propose ton bar » mène au formulaire.
- **Pourquoi** : c’est la page que tu laisses à un bar que tu démarches, et la seule page indexée faite pour eux
  après la page des bars.
- **Risque** : les dates doivent rester vraies ; l’image est refaite à chaque passage du générateur.

### 6. La feuille « Pour le patron »

- **Ce qu’on voit** : une page à imprimer en A5, noir sur blanc : quatre lignes de la page des bars et un QR code
  vers son formulaire. Tu la laisses au comptoir quand le patron dit « plus tard ».
- **Pourquoi** : les premiers bars viendront de tes visites, pas de Google.
- **Risque** : aucun tiers ; l’imprimeur et le QR code existent déjà dans le site. Les lignes doivent rester vraies
  (comme la ligne 1).

### 7 à 11 : ce qui attend tes réponses

- **7, qui répond et en combien de temps** : une phrase avant le formulaire, le délai répété dans « C’est envoyé. »,
  et deux choses à faire en attendant (l’affiche gratuite ; dire à ses habitués de s’inscrire pour le lancement).
- **8, titre, image de partage et conditions** : le titre et l’image changent ensemble ; « tarif à préciser » laisse
  la place à tes conditions vraies, et une question « Je m’engage pour combien de temps ? ».
- **9, le badge** : s’il part, la page gagne de la place, et l’affiche gratuite reste à un geste avant le formulaire.
- **10, tes mots** : sur « À propos » et « Presse », là où mène la ligne 7.
- **11, après l’inscription d’un fan** : « Partager Baromatch », et « Ton bar préféré n’est pas sur Baromatch ?
  Envoie-lui la page Pour les bars ». Aucun suivi, aucun paramètre dans les liens partagés.

### 12 à 15

- **12** : l’accueil et l’agenda mènent aux pages des clubs, celles que Google indexe.
- **13** : le champ d’adresse montre bien où on tape et ce qui ne va pas, aussi en mode contraste élevé de Windows.
- **14** : « Pour les bars » se voit mieux dans l’en-tête de chaque page, sans changer les pages protégées.
- **15** : le formulaire de la liste d’attente sur d’autres pages. La page Confidentialité dit où il est : elle
  change avec, donc c’est le maestro qui fusionne.

## Pas maintenant, et pourquoi

- **Prêt pour le premier bar** (« Au bar cette semaine », l’heure de chaque soirée dans un agenda, l’image d’une
  soirée…) : rien ne s’affiche tant qu’aucun bar n’est publié. À faire la semaine où le premier bar donne son accord
  écrit.
- **La lumière et le verre** (un fond éclairé, une seule recette de carte, des jauges qui se remplissent) : ça joue
  sur la confiance seulement. Après les changements qui font écrire les bars, avec captures pour ton accord.
- **De vrais écrans de l’appli sur l’accueil** : un écran dit « 1 place par compte » quand la FAQ dit « de 1 à 8 »,
  et deux écrans montrent un bar inventé à une vraie adresse. Ta décision d’abord.
- **Une vidéo de la Console et d’un scan à la porte** : beaucoup de travail, hors du site.
- **Un numéro de téléphone pour les bars** : un numéro personnel attire les appels indésirables, et il faut quelqu’un
  pour répondre les soirs de match. Le formulaire propose déjà d’être rappelé.
- **La mesure d’audience sans cookie** : un nouveau prestataire, ta décision, rien à coder (tout est prêt).
- **Une page pour les bars en anglais** (beaucoup de pubs anglais ou irlandais à Paris) : une hypothèse, à décider.
- **Les petites retouches d’accessibilité et de vitesse** qui restent : utiles, mais petites devant le reste.

## Comment chaque changement est livré

- Une branche par changement, partie du `main` le plus récent, et une PR.
- Pour chaque changement visible : captures avant et après, sur téléphone (360 px) et sur ordinateur (1280 px), et
  les chiffres Lighthouse avant et après.
- Avant la PR : `main` fusionné dans la branche, les vérifications du site vertes trois fois de suite, et une
  relecture indépendante ; chaque vraie remarque est corrigée.
- La mission ne fusionne elle-même que si tout est vert sur le dernier commit, que la relecture dit oui, que la
  branche est à jour, et que la PR ne touche ni la Confidentialité, ni les CGU, ni les mentions légales, ni la liste
  des bars publiés, ni l’inscription des testeurs, ni la page d’un lien de tablée, et n’ajoute ni prestataire ni
  formulaire. Sinon : « PR (site) prête pour le maestro ».
