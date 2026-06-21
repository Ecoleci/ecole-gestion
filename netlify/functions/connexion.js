// netlify/functions/connexion.js
// Vérifie les identifiants et retourne un token de session

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function hashMdp(mdp) {
  return crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(mdp)
    .digest("hex");
}

function genererToken(identifiant) {
  const payload = identifiant + "|" + Date.now();
  return crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(payload)
    .digest("hex") + "." + Buffer.from(payload).toString("base64");
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

    // Comptes admin codés en dur (directeur, admin)
    const COMPTES_ADMIN = {
      "directeur": process.env.ADMIN_PASSWORD || "ecole2025",
      "admin":     process.env.ADMIN_PASSWORD_2 || "ci2025",
    };

    const id = identifiant.trim().toLowerCase();

    // Vérifier compte admin d'abord
    if (COMPTES_ADMIN[id] && COMPTES_ADMIN[id] === motDePasse) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          succes: true,
          identifiant: id,
          role: "admin",
          token: genererToken(id),
        }),
      };
    }

    // Vérifier compte utilisateur dans Supabase
    const { data, error } = await supabase
      .from("comptes_utilisateurs")
      .select("*")
      .eq("identifiant", id)
      .eq("actif", true)
      .single();

    if (error || !data) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ erreur: "Identifiant ou mot de passe incorrect." }),
      };
    }

    if (data.mot_de_passe !== hashMdp(motDePasse)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ erreur: "Identifiant ou mot de passe incorrect." }),
      };
    }

    // Mettre à jour dernière connexion
    await supabase
      .from("comptes_utilisateurs")
      .update({ derniere_connexion: new Date().toISOString() })
      .eq("identifiant", id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        succes: true,
        identifiant: id,
        role: "utilisateur",
        token: genererToken(id),
      }),
    };
  } catch (err) {
    console.error("Erreur connexion:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ erreur: "Erreur serveur." }),
    };
  }
};
