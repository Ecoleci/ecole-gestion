// netlify/functions/traiter-paiement.js
// Valide ou rejete un paiement et enregistre le code d'activation

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ erreur: "Méthode non autorisée" }) };

  // Vérifier clé admin
  const adminKey = event.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 403, headers, body: JSON.stringify({ erreur: "Accès non autorisé." }) };
  }

  try {
    const { identifiant, action } = JSON.parse(event.body);

    if (!identifiant || !["valider", "rejeter"].includes(action)) {
      return { statusCode: 400, headers, body: JSON.stringify({ erreur: "Données invalides." }) };
    }

    if (action === "valider") {
      // Générer code à 6 chiffres
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Mettre à jour le paiement
      const { data: paiement, error: errPaiement } = await supabase
        .from("paiements")
        .update({
          statut: "valide",
          code_activation: code,
          date_validation: new Date().toISOString(),
        })
        .eq("identifiant", identifiant)
        .select()
        .single();

      if (errPaiement) {
        return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur mise à jour paiement." }) };
      }

      // Enregistrer dans codes_confirmation
      await supabase
        .from("codes_confirmation")
        .upsert({
          telephone: paiement.telephone,
          operateur: paiement.operateur,
          code,
          identifiant,
          expire_le: expiration,
          utilise: false,
          created_at: new Date().toISOString(),
        }, { onConflict: "telephone" });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          succes: true,
          code,
          telephone: paiement.telephone,
          identifiant,
        }),
      };

    } else {
      // Rejeter
      await supabase
        .from("paiements")
        .update({
          statut: "rejete",
          date_validation: new Date().toISOString(),
        })
        .eq("identifiant", identifiant);

      const { data: paiement } = await supabase
        .from("paiements")
        .select("telephone")
        .eq("identifiant", identifiant)
        .single();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          succes: true,
          action: "rejete",
          telephone: paiement?.telephone,
          identifiant,
        }),
      };
    }

  } catch (err) {
    console.error("Erreur:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur serveur." }) };
  }
};
