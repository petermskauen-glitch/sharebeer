// Genererer én øl-fakta med Gemini og skriver den til Firestore (meta/weeklyFact).
// Kjøres av GitHub Actions hver fredag. Trenger miljøvariablene:
//   GEMINI_API_KEY            – API-nøkkel fra aistudio.google.com
//   FIREBASE_SERVICE_ACCOUNT  – hele service account-JSON-en som én streng
//   GEMINI_MODEL (valgfri)    – modellnavn, default 'gemini-2.5-flash'

const admin = require('firebase-admin');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!GEMINI_API_KEY) { console.error('Mangler GEMINI_API_KEY'); process.exit(1); }
if (!SERVICE_ACCOUNT) { console.error('Mangler FIREBASE_SERVICE_ACCOUNT'); process.exit(1); }

const PROMPT = [
  'Gi meg ÉN kort, overraskende og morsom faktasetning om øl på norsk (bokmål).',
  'Maks 25 ord. Svar med kun selve setningen – ingen innledning, anførselstegn,',
  'emoji eller punktliste. Varier tema mellom historie, bryggeprosess, rekorder,',
  'kultur og ingredienser. Ikke start med "Visste du at".'
].join(' ');

async function generateFact() {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    MODEL + ':generateContent?key=' + GEMINI_API_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: {
        temperature: 1.1,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  if (!res.ok) {
    throw new Error('Gemini API-feil ' + res.status + ': ' + (await res.text()));
  }
  const data = await res.json();
  const text = data
    && data.candidates
    && data.candidates[0]
    && data.candidates[0].content
    && data.candidates[0].content.parts
    && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Tomt/uventet svar fra Gemini: ' + JSON.stringify(data));
  return text.trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ');
}

async function main() {
  const serviceAccount = JSON.parse(SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const fact = await generateFact();
  console.log('Generert fakta:', fact);

  await db.collection('meta').doc('weeklyFact').set({
    text: fact,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ts: Date.now(),
    model: MODEL
  });
  console.log('Skrevet til meta/weeklyFact ✓');
}

main().then(function () { process.exit(0); }).catch(function (e) {
  console.error(e);
  process.exit(1);
});
