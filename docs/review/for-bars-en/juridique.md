# Les phrases juridiques de la page anglaise, à valider avant la mise en ligne

La page `/en/for-bars/` résume en anglais deux parties de la page Confidentialité. La page française reste la référence : la page anglaise le dit, avec un lien vers elle. Chaque phrase anglaise traduit, une à une, la phrase française en dessous (les sections telles qu’elles sont sur `main` le 26 novembre, après la PR #51). Seule différence voulue : le renvoi « voir Nos prestataires » n’est pas repris (cette partie n’est pas traduite).

**Ce qu’il faut du propriétaire** : lire ces deux listes et répondre « oui », ou dire ce qui ne va pas. Rien n’est publié avant.

## 1. « Les demandes des bars » → *Bar requests*

- **What we collect:** the name of the bar, its city, your name, your e-mail address (kept in lower case), and your phone number and your message if you give them. We also keep the time you ticked the box saying you have read the privacy page (the one that applies to your request), the time of your request, and the time the e-mail that alerts us was sent. Nothing else: your request is stored without your IP address, and without anything about your device or your browser.

  *FR : Ce qu’on collecte : le nom du bar, sa ville, ton nom, ton adresse mail (gardée en minuscules), et ton téléphone et ton message si tu les donnes. On garde aussi l’heure à laquelle tu as coché la case qui dit que tu as lu cette page (c’est celle de ta demande), l’heure de ta demande, et l’heure à laquelle le mail qui nous prévient est parti. Rien d’autre : ta demande est enregistrée sans ton adresse IP, et sans rien sur ton appareil ou ton navigateur.*

- **Against mass sending:** the form has a hidden field that must stay empty, and it measures the time spent filling it in. Our server reads these two signals to keep robots out, then discards them: they are not kept with your request. It also limits sending to 5 requests per hour from the same network. To count them, it keeps the network of the connection (an IPv4 address, or an IPv6 /64 block) for one hour in a temporary memory, with the same mechanism as the server’s other limits. It also counts, for the whole service, the e-mails of the day. No IP address is written to the database.

  *FR : Contre les envois en masse : le formulaire a un champ caché, qui doit rester vide, et mesure le temps passé à le remplir. Notre serveur lit ces deux informations pour écarter les robots, puis il les jette : elles ne sont pas gardées avec ta demande. Il limite aussi les envois à 5 demandes par heure depuis un même réseau. Pour les compter, il garde le réseau de la connexion (une adresse IPv4, ou un bloc IPv6 /64) pendant une heure dans une mémoire temporaire, avec le même mécanisme que les autres limites du serveur. Il compte aussi, pour tout le service, les e-mails de la journée. Aucune adresse IP n’est écrite dans la base de données.*

- **Why:** to reply to you, since you asked to join Baromatch. Nothing else.

  *FR : Pourquoi : te répondre, à toi qui as demandé à rejoindre Baromatch. Rien d’autre.*

- **On what basis:** steps taken at your request before a contract, not your consent: you ask to work with Baromatch. The box is compulsory: without it the form sends nothing and our server keeps no request. It only says you have read the page; it is not an agreement to receive advertising, and we do not add you to any list.

  *FR : Sur quelle base : ce sont des démarches faites à ta demande avant de conclure un contrat, et non ton consentement : tu demandes à travailler avec Baromatch. La case à cocher est obligatoire : sans elle, le formulaire n’envoie rien et notre serveur ne garde aucune demande. Elle dit seulement que tu as lu cette page ; ce n’est pas un accord pour recevoir de la publicité, et on ne t’inscrit à aucune liste.*

- **Who can see it:** only the person who runs Baromatch, by e-mail. Each request is sent to them at most once, by Resend, the provider that already sends the app’s login codes. When we reply to that e-mail, the reply goes to your address. The number of these e-mails is capped over 24 hours, for the whole service, so that login codes, which go through the same Resend account, never run short. If sending fails, or if the cap is reached, your request is kept but never e-mailed: it is only on the server, with no sending time. No screen of the app or of the bar Console shows your request. Nothing is sold or rented. Resend is one of our technical providers, based in the United States.

  *FR : Qui y a accès : uniquement la personne qui gère Baromatch, par mail. Chaque demande lui est envoyée au plus une fois, par Resend, le prestataire qui envoie déjà les codes de connexion de l’appli. Quand on répond à ce mail, la réponse part à ton adresse. Le nombre de ces mails est limité sur 24 heures, pour tout le service, pour que les codes de connexion, qui passent par le même compte Resend, ne manquent jamais. Si l’envoi échoue, ou si cette limite est atteinte, ta demande est gardée mais jamais envoyée par mail : elle n’est que sur le serveur, sans heure d’envoi. Aucun écran de l’appli ni de la console des bars ne montre ta demande. Rien n’est vendu ni loué. Resend est l’un de nos prestataires techniques, établi aux États-Unis (voir « Nos prestataires »).*

- **Server logs:** they contain no field of the form. When a sending fails, the log only receives the number of the request in the database and the type of failure.

  *FR : Journaux du serveur : ils ne contiennent aucun champ du formulaire. Quand un envoi échoue, le journal reçoit seulement le numéro de la demande dans la base et le type d’échec.*

- **If the form does not respond:** the page offers to send your request from your own e-mail app: it then arrives in our contact@baromatch.fr inbox.

  *FR : Si le formulaire ne répond pas : la page te propose d’envoyer ta demande depuis ta propre messagerie : elle arrive alors dans notre boîte contact@baromatch.fr.*

- **How long:** 12 months from your request. After that, our automatic erasure deletes your request from our server, and we delete from our inbox the e-mail that alerted us (or your request, if it came by e-mail). Resend keeps its own logs, under its own terms.

  *FR : Combien de temps : 12 mois à partir de ta demande. Au bout de ce délai, notre effacement automatique efface ta demande de notre serveur, et on efface nous-mêmes de notre boîte le mail qui nous a prévenus (ou ta demande, si elle est arrivée par mail). Resend garde ses propres journaux, selon ses propres conditions.*

- **On your device:** what you type is kept in this browser tab, and only there (session storage), so that nothing is lost if the page reloads. The tick box is not kept. This draft is sent to no one. It is erased when your request leaves from this page, or when you close the tab; if you send it from your e-mail app, it stays in the tab until you close it. When your request leaves from this page, the tab keeps only your e-mail address, the name of the bar and the sending time, to recognise a correction sent within 10 minutes and send it through your e-mail app. After those 10 minutes the page no longer uses them and erases them; at the latest, they disappear when you close the tab.

  *FR : Sur ton appareil : ce que tu tapes est gardé dans cet onglet de ton navigateur, et seulement là (stockage de session), pour ne rien perdre si la page se recharge. La case à cocher n’est pas gardée. Ce brouillon n’est transmis à personne. Il est effacé quand ta demande part depuis cette page, ou quand tu fermes l’onglet ; si tu l’envoies depuis ta messagerie, il reste dans l’onglet jusqu’à ce que tu le fermes. Quand ta demande part depuis cette page, l’onglet garde seulement ton adresse mail, le nom du bar et l’heure de l’envoi, pour reconnaître une correction envoyée dans les 10 minutes et te la faire passer par ta messagerie. Passé ces 10 minutes, la page ne s’en sert plus et les efface ; au plus tard, ils disparaissent quand tu fermes l’onglet.*

- **To see, correct or erase your request:** write to contact@baromatch.fr. It is handled by hand, within a month. A request is linked to no account, and the form checks no address: anyone can type someone else’s, or make a mistake in their own. So no account, whatever its role and address, shows or erases a request by itself: the export of your data says it does not contain them, and how to ask for them, and deleting an account leaves them. We check that your message comes from the address of the request, then reply: we show it to you, we correct it, or we erase it along with the e-mail that alerted us. If you think your rights are not respected, you can complain to the CNIL at cnil.fr.

  *FR : Voir, corriger ou effacer ta demande : écris à contact@baromatch.fr. C’est traité à la main, sous un mois. Une demande n’est reliée à aucun compte, et le formulaire ne vérifie aucune adresse : n’importe qui peut y taper celle d’un autre, ou se tromper dans la sienne. Aucun compte, quels que soient son rôle et son adresse, ne montre donc ni n’efface une demande tout seul : l’export de tes données dit qu’il ne les contient pas, et comment les demander, et la suppression d’un compte les laisse. On vérifie que ton message vient de l’adresse de la demande, puis on te répond : on te la montre, on la corrige, ou on l’efface avec le mail qui nous a prévenus. Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL sur cnil.fr.*

## 2. « Les bars que nous contactons » → *Bars we contact*

- **What we keep:** the name of the bar, its public professional contact details, and our notes about its match nights.

  *FR : Ce qu’on garde : le nom du bar, ses coordonnées professionnelles publiques, et nos notes sur ses soirs de match.*

- **Where it comes from:** the bar’s public pages (its website, its social networks, its listing on online maps).

  *FR : D’où ça vient : des pages publiques du bar (son site, ses réseaux, sa fiche sur les cartes en ligne).*

- **Why:** to introduce Baromatch to you. Nothing else.

  *FR : Pourquoi : te présenter Baromatch. Rien d’autre.*

- **On what basis:** our legitimate interest in introducing Baromatch to professionals, within the framework the CNIL sets for prospecting between professionals: we only talk to you about your business.

  *FR : Sur quelle base : notre intérêt légitime à présenter Baromatch à des professionnels, dans le cadre que fixe la CNIL pour la prospection entre professionnels : on ne te parle que de ton métier.*

- **How long:** three years at most after our last contact, then we erase.

  *FR : Combien de temps : trois ans au plus après notre dernier contact, puis on efface.*

- **To refuse:** reply “no thanks”, or write to contact@baromatch.fr. We stop writing to you. We only keep the name of the bar and your refusal, so as not to contact you again.

  *FR : Pour refuser : réponds « non merci », ou écris à contact@baromatch.fr. On ne t’écrit plus. On garde seulement le nom du bar et ton refus, pour ne pas te recontacter.*

- **Your rights:** to see, correct or erase this data, at the same address. If you think your rights are not respected, you can complain to the CNIL at cnil.fr.

  *FR : Tes droits : voir, corriger ou effacer ces données, à la même adresse. Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL sur cnil.fr.*

## Deux points tranchés par le propriétaire (27/11, « oui à tout », transmis par le maestro)

Ils venaient de la page française, pas de la traduction.

1. **Le téléphone et le message.** La Confidentialité dit qu’on garde « ton téléphone et ton message si tu les donnes », mais le formulaire de « Pour les bars » (en français comme en anglais) ne demande ni téléphone ni message : seulement le nom du bar, le prénom, l’adresse mail et la ville. Soit on garde la phrase (le serveur les accepte peut-être), soit on la corrige dans les deux langues.
2. **La case à cocher.** La Confidentialité parle de « la case qui dit que tu as lu cette page » ; sur la page anglaise, la case dit « I have read how Baromatch uses this information to reply to me » et renvoie au résumé anglais. Le sens est le même ; à confirmer.

**Décidé (27/11) :** (1) la phrase « ton téléphone et ton message si tu les donnes » reste dans la Confidentialité, dans les deux langues (le serveur accepte les deux champs et les garde quand ils sont donnés) ; (2) la case anglaise « I have read how Baromatch uses this information to reply to me » est approuvée. Rien à changer dans les pages.
