// netlify/functions/lire-paiements.js
// Lit tous les paiements depuis Supabase (pour la page admin)

const { createClient } = require("@supabase/supabase-js");

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

  // Vérifier la clé admin
  const adminKey = event.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 403, headers, body: JSON.stringify({ erreur: "Accès non autorisé." }) };
  }

  try {
    const { data, error } = await supabase
      .from("paiements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur base de données." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ succes: true, paiements: data }) };

  } catch (err) {
    console.error("Erreur:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ erreur: "Erreur serveur." }) };
  }
};
