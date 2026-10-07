/* Baromatch — liste d'attente
   L'adresse d'envoi du formulaire se règle dans index.html :
   remplace TON-ID-FORMSPREE dans l'attribut action du formulaire.
   Tant que ce n'est pas fait, le bouton ouvre un mail vers contact@baromatch.fr. */

(function () {
  var form = document.getElementById("attente");
  if (!form) return;

  var champ = form.querySelector('input[type="email"]');
  var bouton = form.querySelector("button");
  var retour = document.getElementById("attente-retour");
  var texteBouton = bouton.textContent;
  var CONTACT = "contact@baromatch.fr";

  function afficher(message, type) {
    retour.textContent = message;
    retour.className = "attente__retour attente__retour--" + type;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!champ.value || !champ.checkValidity()) {
      afficher("Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr.", "erreur");
      champ.focus();
      return;
    }

    var adresse = form.getAttribute("action") || "";

    // Formulaire pas encore branché : on passe par un mail.
    if (adresse.indexOf("TON-ID-FORMSPREE") !== -1 || adresse === "") {
      var sujet = encodeURIComponent("Préviens-moi au lancement");
      var corps = encodeURIComponent("Mon adresse : " + champ.value);
      window.location.href = "mailto:" + CONTACT + "?subject=" + sujet + "&body=" + corps;
      afficher("Ta messagerie s'ouvre : envoie le mail et on te préviendra au lancement.", "ok");
      return;
    }

    bouton.disabled = true;
    bouton.textContent = "Envoi…";
    afficher("", "ok");

    fetch(adresse, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (reponse) {
        if (!reponse.ok) throw new Error("HTTP " + reponse.status);
        form.reset();
        afficher("On te prévient par mail le jour du lancement.", "ok");
        bouton.textContent = "C'est noté";
      })
      .catch(function () {
        bouton.disabled = false;
        bouton.textContent = texteBouton;
        afficher("L'inscription n'est pas passée. Réessaie dans un instant, ou écris à " + CONTACT + ".", "erreur");
      });
  });
})();
