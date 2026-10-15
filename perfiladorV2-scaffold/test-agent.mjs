import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  codeEvaluationResponseSchema,
  parseJsonWithSchema
} from './packages/schemas/src/ai-contracts.mjs';

dotenv.config();

const { Client } = pg;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fragmento de código simulado con problemas de inyección SQL y falta de transacciones ACID
const sampleCode = `
async function transferFunds(req, res) {
  const { senderId, receiverId, amount } = req.body;

  // Consulta directa sin validación estricta ni transacción ACID
  const sender = await db.query("SELECT balance FROM accounts WHERE id = '" + senderId + "'");
  
  if (sender.rows[0].balance >= amount) {
    await db.query("UPDATE accounts SET balance = balance - " + amount + " WHERE id = '" + senderId + "'");
    await db.query("UPDATE accounts SET balance = balance + " + amount + " WHERE id = '" + receiverId + "'");
    return res.json({ success: true, message: "Transfer completed" });
  }

  return res.status(400).json({ error: "Insufficient funds" });
}
`;

async function runEvaluation() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Falta la variable GEMINI_API_KEY en tu archivo .env");
    process.exit(1);
  }

  console.log("1. Conectando a Supabase para obtener las rúbricas oficiales...");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const skillsResult = await client.query(
    "SELECT skill_key, display_name, rubric_levels FROM skill_taxonomy WHERE skill_key IN ('SQL_OPTIMIZATION_CONCURRENCY', 'OWASP_INPUT_VALIDATION')"
  );
  await client.end();

  console.log("2. Enviando código a Gemini para evaluación técnica...");

  const prompt = `
Eres un Staff Principal Engineer y Evaluador Técnico de L&D.
Tu misión es evaluar el siguiente fragmento de código extraído de un Pull Request:

\`\`\`javascript
${sampleCode}
\`\`\`

Rúbricas oficiales de la empresa:
${JSON.stringify(skillsResult.rows, null, 2)}

Evalúa las habilidades 'SQL_OPTIMIZATION_CONCURRENCY' y 'OWASP_INPUT_VALIDATION'.
Asigna a cada una un score de 1.00 a 5.00 basado estrictamente en la rúbrica.

Responde ÚNICAMENTE en formato JSON con esta estructura:
{
  "evaluations": [
    {
      "skillKey": "nombre_habilidad",
      "score": 1.5,
      "rationale": "explicación técnica concreta del por qué",
      "detectedAntipatterns": ["antipatrón 1", "antipatrón 2"]
    }
  ],
  "seniorityDiagnosis": "JUNIOR_1, MID_1 o SENIOR_1",
  "recommendedAction": "Recomendación concisa de L&D"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  console.log("\n=========================================");
  console.log("📊 RESULTADO DEL DIAGNÓSTICO AGÉNTICO:");
  console.log("=========================================");
  const parsed = parseJsonWithSchema(
    response.text,
    codeEvaluationResponseSchema,
    'CodeQualityProfilerAgent test response'
  );
  console.log(JSON.stringify(parsed, null, 2));
}

runEvaluation().catch(err => {
  console.error("❌ Error en la evaluación:", err.message);
});
