// netlify/functions/envoyer-sms.js
// Fonction serverless : génère un code, l'enregistre dans Supabase, envoie le SMS

const { createClient } = require("@supabase/supabase-js");
const AfricasTalking = require("africastalking");

// ── Initialisation ──────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const AT = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});
const sms = AT.SMS;

// ── Helper : formater numéro CI ─────────────────────
function formatTel(num) {
  const n = num.replace(/\D/g, "");
  if (n.startsWith("225")) return "+" + n;
  if (n.length === 10) return "+225" + n;
  return "+" + n;
}

// ── Handler principal ───────────────────────────────
exports.handler = async (event) => {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ erreur: "Méthode non autorisée" }) };
  }

  try {
    const { telephone, operateur } = JSON.parse(event.body);

    if (!telephone || !operateur) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ erreur: "Numéro de téléphone et opérateur requis." }),
      };
    }

    const telFormate = formatTel(telephone);

    // ── 1. Générer code à 6 chiffres ─────────────────
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // ── 2. Générer identifiant unique ─────────────────
    const identifiant = "USER-" + Date.now().toString().slice(-5);

    // ── 3. Enregistrer dans Supabase ──────────────────
    const { error: dbError } = await supabase
      .from("codes_confirmation")
      .upsert({
        telephone: telFormate,
        operateur,
        code,
        identifiant,
        expire_le: expiration.toISOString(),
        utilise: false,
        created_at: new Date().toISOString(),
      }, { onConflict: "telephone" });

    if (dbError) {
      console.error("Erreur Supabase:", dbError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ erreur: "Erreur base de données. Réessayez." }),
      };
    }

    // ── 4. Envoyer le SMS via Africa's Talking ─────────
    const message =
      `GestionScolaire-CI\n` +
      `Votre code de confirmation : ${code}\n` +
      `Identifiant : ${identifiant}\n` +
      `Valable 15 minutes. Ne partagez pas ce code.`;

    const smsSend = await sms.send({
      to: [telFormate],
      message,
      from: process.env.AT_SENDER_ID || undefined,
    });

    console.log("SMS envoyé:", JSON.stringify(smsSend));

    const recipient = smsSend.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status !== "Success") {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ erreur: "Échec envoi SMS : " + recipient.status }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        succes: true,
        message: "SMS envoyé au " + telFormate,
        // En mode test Africa's Talking, renvoyer le code pour débogage
        // ⚠️ SUPPRIMER cette ligne en production finale !
        _debug_code: process.env.AT_USERNAME === "sandbox" ? code : undefined,
      }),
    };
  } catch (err) {
    console.error("Erreur générale:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ erreur: "Erreur serveur. Contactez l'administrateur." }),
    };
  }
};
