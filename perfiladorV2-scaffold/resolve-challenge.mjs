import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  challengeVerdictSchema,
  parseJsonWithSchema
} from './packages/schemas/src/ai-contracts.mjs';

dotenv.config();

const { Client } = pg;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Solución que envía el desarrollador tras estudiar la cápsula L&D
const developerSubmittedSolution = `
async function transferFunds(req, res) {
  const { senderId, receiverId, amount } = req.body;
  const client = await db.getClient();

  try {
    // 1. Iniciar transacción ACID
    await client.query("BEGIN");

    // 2. Bloqueo pesimista para evitar condición de carrera (TOCTOU)
    // y consultas parametrizadas para evitar SQL Injection
    const sender = await client.query(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE", 
      [senderId]
    );

    if (!sender.rows.length || sender.rows[0].balance < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Fondos insuficientes o cuenta no existe" });
    }

    // 3. Actualizaciones atómicas
    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, senderId]
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, receiverId]
    );

    // 4. Confirmar transacción
    await client.query("COMMIT");
    return res.json({ success: true, message: "Transferencia completada de forma atómica" });

  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Fallo transaccional en la transferencia" });
  } finally {
    client.release();
  }
}
`;

async function main() {
  console.log("🏁 INICIANDO EVALUACIÓN DEL RETO PRÁCTICO (CHALLENGE RUNNER)...\n");

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  // 1. Buscar al desarrollador y su módulo asignado
  console.log("🔍 Paso 1: Buscando el curso asignado para Carlos Mendoza en Supabase...");
  const devRes = await db.query("SELECT id, tech_track, target_seniority FROM developers WHERE email = 'carlos.mendoza@uenobank.com.py'");
  const dev = devRes.rows[0];

  const moduleRes = await db.query(
    "SELECT id, title, skill_key, interactive_challenge FROM learning_modules WHERE developer_id = $1 AND status = 'ASSIGNED' ORDER BY created_at DESC LIMIT 1",
    [dev.id]
  );

  if (!moduleRes.rows.length) {
    console.log("ℹ️ No hay módulos pendientes en estado ASSIGNED.");
    await db.end();
    return;
  }

  const module = moduleRes.rows[0];
  console.log(`   Módulo activo: "${module.title}"`);
  console.log(`   Habilidad a certificar: ${module.skill_key}\n`);

  // 2. Agente Verificador de Retos (Gemini)
  console.log("🧠 Paso 2: ChallengeEvaluatorAgent analizando la solución enviada...");
  const prompt = `
Eres un Tech Lead Senior evaluando la solución de un desarrollador de ueno bank a un reto práctico.
Habilidad a evaluar: '${module.skill_key}'.
Instrucciones del reto: ${JSON.stringify(module.interactive_challenge)}

Código enviado por el desarrollador:
\`\`\`javascript
${developerSubmittedSolution}
\`\`\`

Evalúa estrictamente si:
1. Utiliza transacciones con BEGIN, COMMIT y ROLLBACK.
2. Utiliza bloqueo pesimista (SELECT ... FOR UPDATE) para evitar condiciones de carrera (Race Conditions).
3. Utiliza consultas parametrizadas para evitar inyección SQL.
4. Libera la conexión en un bloque finally.

Responde ÚNICAMENTE en JSON con esta estructura:
{
  "passed": true,
  "score": 4.5,
  "feedback": "Explicación técnica detallada de por qué aprueba o reprueba",
  "verifiedCompetencies": ["ACID Transactions", "Pessimistic Locking", "Parameterized Queries"]
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  const verdict = parseJsonWithSchema(
    response.text,
    challengeVerdictSchema,
    'ChallengeEvaluatorAgent response'
  );

  console.log("\n=======================================================");
  console.log("📋 RESULTADO DEL AGENTE VERIFICADOR:");
  console.log("=======================================================");
  console.log(`¿Aprobó el reto?: ${verdict.passed ? '✅ APROBADO (PASSED)' : '❌ REPROBADO'}`);
  console.log(`Nueva Calificación: ${verdict.score} / 5.00`);
  console.log(`Feedback: ${verdict.feedback}`);
  console.log(`Competencias validadas: ${verdict.verifiedCompetencies.join(', ')}`);
  console.log("=======================================================\n");

  if (verdict.passed) {
    // 3. Marcar el módulo como completado
    console.log("🎉 Paso 3: Marcando módulo como COMPLETED en Supabase...");
    await db.query(
      "UPDATE learning_modules SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1",
      [module.id]
    );

    // 4. Actualizar el Tech Radar y recalcular el gap
    console.log("📈 Paso 4: Actualizando la Matriz de Habilidades (Tech Radar)...");
    const benchmarkRes = await db.query(
      "SELECT required_score FROM seniority_benchmarks WHERE track = $1 AND seniority_level = $2 AND skill_key = $3",
      [dev.tech_track, dev.target_seniority, module.skill_key]
    );
    const required = benchmarkRes.rows[0]?.required_score || 3.50;
    const newGap = Number(verdict.score) - Number(required);

    await db.query(`
      UPDATE developer_skill_matrix 
      SET current_score = $1,
          last_signal_at = NOW(),
          gap_vs_target = $2,
          confidence_score = 0.98
      WHERE developer_id = $3 AND skill_key = $4
    `, [verdict.score, newGap, dev.id, module.skill_key]);

    console.log(`   Habilidad: ${module.skill_key}`);
    console.log(`   Nota anterior: 1.00  ──>  Nueva nota: ${verdict.score}/5.00`);
    console.log(`   Requerido para ${dev.target_seniority}: ${required}`);
    console.log(`   Nuevo Estado del Radar: ${newGap >= 0 ? '🟢 BRECHA SUPERADA (+' + newGap + ')' : '⚠️ DEFICIT'}`);
    console.log("\n🏆 ¡El colaborador ha cerrado la brecha técnica y está listo para avanzar de nivel!");
  }

  await db.end();
}

main().catch(err => {
  console.error("❌ Error en la verificación:", err.message);
  process.exit(1);
});
