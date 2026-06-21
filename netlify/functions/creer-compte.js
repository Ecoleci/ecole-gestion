// netlify/functions/creer-compte.js
// Enregistre le nouveau compte utilisateur dans Supabase (mot de passe hashé)

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Hash SHA-256 simple (pour production avancée, utiliser bcrypt)
function hashMdp(mdp) {
  return crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(mdp)
    .digest("hex");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ erreur: "Méthode non autorisée" }) };
  }

  try {
    const { identifiant, motDePasse } = JSON.parse(event.body);

    if (!identifiant || !motDePasse || motDePasse.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erreur: "Données invalides." }),
      };
    }

    // Vérifier que l'identifiant existe dans codes_confirmation
    const { data: codeData } = await supabase
      .from("codes_confirmation")
      .select("identifiant, telephone")
      .eq("identifiant", identifiant)
      .eq("utilise", true)
      .single();

    if (!codeData) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ erreur: "Identifiant non autorisé." }),
      };
    }

    // Vérifier que le compte n'existe pas déjà
    const { data: existant } = await supabase
      .from("comptes_utilisateurs")
      .select("identifiant")
      .eq("identifiant", identifiant)
      .single();

    if (existant) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ erreur: "Ce compte existe déjà." }),
      };
    }

    // Créer le compte
    const { error } = await supabase
      .from("comptes_utilisateurs")
      .insert({
        identifiant: identifiant.toLowerCase(),
        mot_de_passe: hashMdp(motDePasse),
        telephone: codeData.telephone,
        actif: true,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Erreur création compte:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ erreur: "Erreur création du compte." }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ succes: true, identifiant }),
    };
  } catch (err) {
    console.error("Erreur:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ erreur: "Erreur serveur." }),
    };
  }
};
