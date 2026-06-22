// netlify/functions/enregistrer-paiement.js
// Enregistre un nouveau paiement en attente dans Supabase

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ erreur: "Méthode non autorisée" }) };

  try {
    const { telephone, operateur, identifiant } = JSON.parse(event.body);

    if (!telephone || !operateur || !identifiant) {
      return { statusCode: 400, headers, body: JSON.stringify({ erreur: "Données manquantes." }) };
    }

    const { error } = await supabase
      .from("paiements")
      .insert({
        identifiant,
        telephone,
        operateur,
        statut: "en_attente",
        montant: 5000,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Erreur Supabase:", error);
      return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur base de données." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ succes: true }) };

  } catch (err) {
    console.error("Erreur:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur serveur." }) };
  }
};
