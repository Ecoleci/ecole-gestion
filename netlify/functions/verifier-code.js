// netlify/functions/verifier-code.js
// Vérifie le code saisi, invalide-le et retourne l'identifiant

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function formatTel(num) {
  const n = num.replace(/\D/g, "");
  if (n.startsWith("225")) return "+" + n;
  if (n.length === 10) return "+225" + n;
  return "+" + n;
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
    const { telephone, code } = JSON.parse(event.body);
    const telFormate = formatTel(telephone);

    // Chercher le code dans Supabase
    const { data, error } = await supabase
      .from("codes_confirmation")
      .select("*")
      .eq("telephone", telFormate)
      .eq("utilise", false)
      .single();

    if (error || !data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erreur: "Aucun code trouvé pour ce numéro. Recommencez." }),
      };
    }

    // Vérifier expiration
    if (new Date() > new Date(data.expire_le)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erreur: "Code expiré. Cliquez sur Renvoyer le code." }),
      };
    }

    // Vérifier le code
    if (data.code !== code.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erreur: "Code incorrect. Vérifiez votre SMS." }),
      };
    }

    // Marquer comme utilisé
    await supabase
      .from("codes_confirmation")
      .update({ utilise: true })
      .eq("telephone", telFormate);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        succes: true,
        identifiant: data.identifiant,
      }),
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
