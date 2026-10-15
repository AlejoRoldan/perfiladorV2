import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  codeEvaluationResponseSchema,
  learningModuleResponseSchema,
  parseJsonWithSchema
} from './packages/schemas/src/ai-contracts.mjs';

dotenv.config();

const { Client } = pg;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const samplePRCode = `
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

async function main() {
  console.log("🚀 INICIANDO PIPELINE DE EVALUACIÓN Y L&D AGÉNTICO...\n");

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  // 1. Obtener o crear desarrollador de prueba en ueno bank
  console.log("👤 Paso 1: Verificando perfil del desarrollador en Supabase...");
  const devRes = await db.query(`
    INSERT INTO developers (org_id, email, github_username, current_seniority, target_seniority, tech_track)
    VALUES (
      (SELECT id FROM organizations WHERE slug = 'ueno-bank' LIMIT 1),
      'carlos.mendoza@uenobank.com.py',
      'cmendoza-ueno',
      'JUNIOR_2',
      'MID_2',
      'BACKEND_NODE'
    )
    ON CONFLICT (email) DO UPDATE SET target_seniority = EXCLUDED.target_seniority
    RETURNING id, email, current_seniority, target_seniority, tech_track;
  `);
  const dev = devRes.rows[0];
  console.log(`   Ingeniero: ${dev.email} | Nivel Actual: ${dev.current_seniority} | Meta: ${dev.target_seniority}\n`);

  // 2. Traer rúbricas oficiales
  console.log("📚 Paso 2: Obteniendo rúbricas de evaluación oficiales...");
  const rubricsRes = await db.query(`
    SELECT skill_key, display_name, rubric_levels 
    FROM skill_taxonomy 
    WHERE skill_key IN ('SQL_OPTIMIZATION_CONCURRENCY', 'OWASP_INPUT_VALIDATION')
  `);

  // 3. Agente Evaluador de Código
  console.log("🧠 Paso 3: Agente Evaluador analizando el Pull Request con Gemini...");
  const evalPrompt = `
Eres un Staff Principal Engineer y Evaluador Técnico de L&D.
Evalúa el siguiente fragmento de código de un Pull Request:
\`\`\`javascript
${samplePRCode}
\`\`\`
Rúbricas:
${JSON.stringify(rubricsRes.rows, null, 2)}

Responde ÚNICAMENTE en JSON:
{
  "evaluations": [
    {
      "skillKey": "nombre_habilidad",
      "score": 1.0,
      "rationale": "explicación concisa",
      "antipatterns": ["antipatrón 1", "antipatrón 2"]
    }
  ]
}
`;

  const evalResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: evalPrompt,
    config: { responseMimeType: 'application/json' }
  });
  const evaluationData = parseJsonWithSchema(
    evalResponse.text,
    codeEvaluationResponseSchema,
    'CodeQualityProfilerAgent response'
  );

  // 4. Guardar evidencia en evaluation_signals
  console.log("💾 Paso 4: Registrando señal de evaluación en Supabase...");
  await db.query(`
    INSERT INTO evaluation_signals (developer_id, source_type, external_ref, diff_summary, raw_evaluations)
    VALUES ($1, 'GITHUB_PR', 'PR#104-transfer-funds', $2, $3)
  `, [dev.id, JSON.stringify({ file: 'src/transfers.js', linesChanged: 15 }), JSON.stringify(evaluationData)]);

  // 5. Comparar contra el benchmark y actualizar el Tech Radar
  console.log("\n📊 Paso 5: Calculando Matriz de Habilidades y Detección de Brechas:");
  let criticalGapSkill = null;

  for (const item of evaluationData.evaluations) {
    const benchmarkRes = await db.query(`
      SELECT required_score FROM seniority_benchmarks
      WHERE track = $1 AND seniority_level = $2 AND skill_key = $3
    `, [dev.tech_track, dev.target_seniority, item.skillKey]);

    const required = benchmarkRes.rows[0]?.required_score || 3.50;
    const gap = Number(item.score) - Number(required);

    await db.query(`
      INSERT INTO developer_skill_matrix (developer_id, skill_key, current_score, confidence_score, last_signal_at, gap_vs_target)
      VALUES ($1, $2, $3, 0.90, NOW(), $4)
      ON CONFLICT (developer_id, skill_key) DO UPDATE 
      SET current_score = EXCLUDED.current_score,
          last_signal_at = NOW(),
          gap_vs_target = EXCLUDED.gap_vs_target;
    `, [dev.id, item.skillKey, item.score, gap]);

    console.log(`   * Habilidad: ${item.skillKey}`);
    console.log(`     Nota obtenida: ${item.score}/5.00 | Requerido para ${dev.target_seniority}: ${required}`);
    console.log(`     Brecha (Gap): ${gap < 0 ? '⚠️ DEFICIT ' + gap : '✅ Cumplido'}`);

    if (gap < 0 && !criticalGapSkill) {
      criticalGapSkill = { ...item, requiredScore: required };
    }
  }

  // 6. Si hay brecha, activar al CurriculumBuilderAgent
  if (criticalGapSkill) {
    console.log(`\n🎯 Paso 6: Brecha crítica detectada en [${criticalGapSkill.skillKey}].`);
    console.log("   Activando al CurriculumBuilderAgent para generar módulo L&D a medida...");

    const coursePrompt = `
Eres un Diseñador Instruccional Senior y Tech Lead de Ingeniería.
Un desarrollador de ueno bank obtuvo un puntaje bajo (${criticalGapSkill.score}/5.0) en '${criticalGapSkill.skillKey}'.
Motivo: ${criticalGapSkill.rationale}
Antipatrones detectados: ${criticalGapSkill.antipatterns ? criticalGapSkill.antipatterns.join(', ') : 'Inyecciones y falta de ACID'}

Diseña una cápsula de aprendizaje interactiva de 10 minutos para cerrar esta brecha específica.
Responde ÚNICAMENTE en JSON con esta estructura exacta:
{
  "title": "Título conciso y profesional del módulo",
  "conceptExplanation": "Explicación clara del por qué ocurre el error y cómo solucionarlo en producción",
  "badPattern": "Código vulnerable corto comentado",
  "goodPattern": "Código corregido con transacciones/buenas prácticas",
  "interactiveChallenge": {
    "instructions": "Instrucción del reto práctico",
    "starterCode": "Código inicial para que el desarrollador complete",
    "solutionCode": "Código con la solución correcta"
  }
}
`;

    const courseResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: coursePrompt,
      config: { responseMimeType: 'application/json' }
    });
    const courseData = parseJsonWithSchema(
      courseResponse.text,
      learningModuleResponseSchema,
      'CurriculumBuilderAgent response'
    );

    // Guardar el curso generado en Supabase
    const savedCourse = await db.query(`
      INSERT INTO learning_modules (developer_id, skill_key, title, content_blocks, interactive_challenge, status)
      VALUES ($1, $2, $3, $4, $5, 'ASSIGNED')
      RETURNING id, title;
    `, [
      dev.id,
      criticalGapSkill.skillKey,
      courseData.title,
      JSON.stringify({
        explanation: courseData.conceptExplanation,
        badPattern: courseData.badPattern,
        goodPattern: courseData.goodPattern
      }),
      JSON.stringify(courseData.interactiveChallenge)
    ]);

    console.log("\n=======================================================");
    console.log("🎓 CÁPSULA L&D GENERADA AUTOMÁTICAMENTE Y GUARDADA:");
    console.log("=======================================================");
    console.log(`ID del Módulo: ${savedCourse.rows[0].id}`);
    console.log(`Título: "${courseData.title}"`);
    console.log(`\nConcepto clave:\n${courseData.conceptExplanation}`);
    console.log(`\nReto Práctico:\n${courseData.interactiveChallenge.instructions}`);
    console.log("=======================================================");
  }

  await db.end();
  console.log("\n✅ PIPELINE COMPLETADO EXITOSAMENTE.");
}

main().catch(err => {
  console.error("❌ Error en el pipeline:", err.message);
  process.exit(1);
});
