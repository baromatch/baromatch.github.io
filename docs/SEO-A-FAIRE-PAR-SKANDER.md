# SEO : ce qu’il reste à faire, et que toi seul peux faire

Mis à jour le 21 octobre 2026. Tout ce qui se fait dans le site est fait. Ce qui reste demande ton compte Google,
ton domaine ou ta voix. Chaque étape dit combien de temps elle prend et si elle coûte de l’argent.

**Ce qui coûte de l’argent est marqué 💶. Tout le reste est gratuit.**

---

## Les 3 plus importantes, dans l’ordre

1. **Google Search Console** : relier le domaine et envoyer le plan du site (20 minutes, gratuit).
2. **Bing Webmaster Tools** : l’importer depuis Google (5 minutes, gratuit).
3. **Les premiers bars qui acceptent par écrit** : chaque bar publié rend indexables les pages de ses matchs, de sa
   ville, « Ce soir » et la semaine. C’est ce qui fera le plus pour être trouvé.

---

## 1. Google Search Console (20 minutes, gratuit)

Le site a déjà une balise de vérification Google dans l’accueil. Si tu as déjà accès à Search Console pour
baromatch.fr, passe directement à l’étape 1.5.

1. Va sur https://search.google.com/search-console et connecte-toi avec ton compte Google.
2. Clique sur « Ajouter une propriété », choisis **« Domaine »** (la case de gauche), et écris `baromatch.fr`
   (sans « https:// », sans « www »).
3. Google te donne une ligne qui commence par `google-site-verification=`. Copie-la.
4. Va chez l’hébergeur de ton nom de domaine (là où tu as acheté baromatch.fr), dans la zone « DNS ». Ajoute un
   enregistrement de type **TXT**, nom `@` (ou vide), valeur : la ligne copiée. Enregistre.
5. Reviens sur Search Console et clique sur « Valider ». Si ça ne marche pas tout de suite, réessaie le lendemain :
   ça peut prendre jusqu’à 48 heures.
6. Une fois validé : menu « Sitemaps », écris `sitemap.xml` dans la case, et clique sur « Envoyer ».
7. Menu « Inspection de l’URL » : colle `https://baromatch.fr/trouver-un-bar-qui-diffuse-le-match.html`, puis
   « Demander l’indexation ». Fais pareil pour `https://baromatch.fr/matchs/club/psg/` et
   `https://baromatch.fr/matchs/competition/ligue-1/`. Pas besoin de le faire pour toutes les pages : le plan du site
   s’en charge.

## 2. Bing Webmaster Tools (5 minutes, gratuit)

Bing compte aussi : ses résultats servent à Copilot et à d’autres moteurs.

1. Va sur https://www.bing.com/webmasters et connecte-toi (un compte Microsoft, Google ou Facebook).
2. Choisis **« Importer depuis Google Search Console »** et autorise. baromatch.fr arrive vérifié, avec son plan du
   site. (Il faut avoir fait l’étape 1 avant.)
3. Si tu préfères sans Google : choisis « Balise meta », copie la balise que Bing donne (elle commence par
   `<meta name="msvalidate.01"`), et demande à Claude de la mettre dans l’accueil : sa place est déjà prête.
4. Rien à faire pour IndexNow : le site prévient déjà Bing tout seul de chaque page indexable qui change.

## 3. Deux réglages à vérifier une fois (5 minutes, gratuit)

1. **GitHub** : dans le dépôt baromatch.github.io, « Settings », puis « Pages ». Vérifie que la case « Enforce
   HTTPS » est cochée.
2. **www** : ouvre `http://www.baromatch.fr` dans ton navigateur. Tu dois arriver sur `https://baromatch.fr/`. Si ce
   n’est pas le cas, chez l’hébergeur du domaine, ajoute un enregistrement **CNAME** : nom `www`, valeur
   `baromatch.github.io`. GitHub fait ensuite la redirection tout seul.

## 4. Où inscrire Baromatch (gratuit, sauf 💶)

Ne t’inscris que là où tu peux dire vrai : « appli en test sur Android à Paris, pas encore ouverte au public ».
N’écris jamais une date de sortie que tu n’es pas sûr de tenir, ni un nombre d’utilisateurs ou de bars que tu n’as
pas. Reprends les phrases de la page Presse : elles sont justes et déjà relues.

**Tout de suite (le site suffit) :**

- **Google Business Profile** : pas utile pour l’instant (Baromatch n’a pas de lieu qui reçoit du public). À revoir
  quand la société sera créée.
- **LinkedIn** : une page entreprise « Baromatch » (gratuit). Mets le lien du site. Ajoute ensuite son adresse dans
  marque.json (demande à Claude) : elle apparaîtra dans les données du site.
- **Instagram et TikTok** : si tu crées un compte, mets le lien du site dans la bio. Même chose : son adresse va dans
  marque.json.
- **Annuaires de startups françaises** : la communauté French Tech de ta ville (renseigne-toi sur ses conditions),
  Station F (seulement si tu y es). Une ligne vraie, le lien du site. Les pages « entreprise » payantes (comme celles
  des sites d’emploi) ne servent à rien pour l’instant 💶.
- **Product Hunt** : plutôt le jour de l’ouverture au public, pas avant (une seule chance de lancement).

**Le jour où l’appli est dans Google Play :**

- La fiche Google Play elle-même compte beaucoup : un titre clair (« Baromatch : bars qui diffusent le match »), une
  description vraie, des captures (celles de la page Presse).
- Les sites qui listent les applis (comme AlternativeTo) : une fiche vraie, gratuite.

**Les communautés foot et bars :**

- Les forums et groupes de supporters (Reddit r/Ligue1 et r/football, les groupes Facebook de supporters de chaque
  club) : présente-toi comme le fondateur, une fois, avec le guide « Comment trouver un bar qui diffuse le match ».
  Jamais de message en série, jamais de faux compte, jamais de faux avis : c’est contraire aux règles de ces sites, et
  aux tiennes.
- Les associations de cafetiers-restaurateurs (UMIH de Paris, GNI) : pour les bars, pas pour les fans.

💶 **Ce qui coûte** : les annuaires payants de « backlinks », les communiqués de presse payants et les achats de
liens. **Ne les prends pas** : Google les compte comme du spam, et ils peuvent faire du tort au site.

## 5. Avoir de vrais liens vers le site (gratuit)

Un lien d’un vrai site qui parle de Baromatch vaut plus que cent annuaires.

1. **La page Presse** (baromatch.fr/presse.html) a tout ce qu’un journaliste demande : la phrase, les logos, les
   images, le contact. Quand tu écris à un média (presse locale parisienne, sites foot, médias startup), mets ce
   lien.
2. **Les bars partenaires** : chaque bar publié a un badge, à coller sur son site (le code est sur sa page Baromatch,
   « Tu tiens ce bar ? »). Demande-lui de le mettre : c’est un lien vers sa page, et vers le site. Rien à payer, rien
   à suivre : le badge ne compte personne.
3. **L’affiche de la semaine** (baromatch.fr/matchs/affiche/) est gratuite pour tous les bars, même ceux qui ne sont
   pas sur Baromatch : propose-la aux bars que tu démarches. Un bar qui la cite sur ses réseaux te fait connaître.
4. **Ton profil** : mets le lien du site sur ton profil LinkedIn, et dans ta signature de mail.

## 6. Ce qu’il faut regarder chaque mois (15 minutes, gratuit)

Dans **Google Search Console** :

- « Performances » : le nombre d’**impressions** (combien de fois le site s’est affiché dans Google) et de **clics**.
  Au début, c’est très peu : c’est normal. Regarde si ça monte d’un mois à l’autre.
- Les **requêtes** : ce que les gens ont tapé. Si une question revient (par exemple « bar match PSG Paris 11 »),
  dis-le à Claude : on peut y répondre sur le site.
- « Pages » : combien de pages sont **indexées**. Les pages des clubs et des compétitions doivent y arriver dans les
  semaines qui suivent. Une page « Explorée, non indexée » n’est pas une erreur : Google attend de la voir utile.
- « Signaux Web essentiels » : doit rester au vert (« Bonnes URL »).

Dans **Bing Webmaster Tools** : les mêmes chiffres, en plus petit.

Note-les dans un tableau, une ligne par mois : impressions, clics, pages indexées. Trois mois suffisent pour voir si
ça marche.

## 7. Le jour où l’appli ouvre au public

Dis-le à Claude : il faut changer marque.json (« ouverte » et le lien Google Play), et les phrases « en test » de
l’accueil, d’À propos, de la page Presse et de llms.txt, toutes ensemble, le même jour. Pas avant : le site ne dit
que ce qui est vrai aujourd’hui.
