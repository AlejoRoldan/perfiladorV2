import { GoogleGenAI } from '@google/genai';
import { SecretSanitizer } from '@perfilador/sanitizer';
import {
  CodeQualityEvaluationSchema,
  CodeQualityEvaluation,
  SeniorityLevel,
  TechTrack
} from '@perfilador/schemas';
import {
  db,
  developers,
  evaluationSignals,
  developerSkillMatrix,
  seniorityBenchmarks
} from '@perfilador/database';
import { eq, and } from 'drizzle-orm';

export interface CodeQualityProfilerInput {
  codeOrDiff: string;
  developerInfo?: {
    email: string;
    currentSeniority?: SeniorityLevel;
    targetSeniority?: SeniorityLevel;
    techTrack?: TechTrack;
  };
  externalRef?: string;
  customInstructions?: string;
  persistToDatabase?: boolean;
}

export class CodeQualityProfilerAgent {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey?: string, modelName = 'gemini-3.8-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY no encontrada en variables de entorno ni en constructor.');
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.modelName = modelName;
  }

  public async evaluate(input: CodeQualityProfilerInput): Promise<CodeQualityEvaluation & { signalId?: string }> {
    // 1. Sanitización obligatoria antes de llamar al modelo
    const { sanitized, hasRedactions, redactedCount } = SecretSanitizer.sanitize(input.codeOrDiff);

    if (hasRedactions) {
      console.log(`🛡️  [CodeQualityProfilerAgent] Se redactaron ${redactedCount} secretos antes de enviar a Gemini.`);
    }

    // 2. Construcción del Prompt Socrático
    const target = input.developerInfo?.targetSeniority || 'MID_2';
    const track = input.developerInfo?.techTrack || 'BACKEND_NODE';

    const prompt = `
Eres un Staff Principal Architect evaluando la calidad de código de un Pull Request o módulo.
Nivel Meta del Ingeniero: ${target}
Track Técnico: ${track}
${input.customInstructions ? `Instrucciones adicionales: ${input.customInstructions}` : ''}

Analiza minuciosamente el siguiente fragmento de código (previamente sanitizado):
\`\`\`
${sanitized}
\`\`\`

Evalúa las dimensiones de ingeniería de software:
- CLEAN_ARCHITECTURE (Separación de responsabilidades, acoplamiento, cohesión)
- SQL_OPTIMIZATION_CONCURRENCY (Manejo correcto de asincronia, race conditions, ACID y concurrencia en datos)
- TESTING_STRATEGY (Cobertura, manejo de errores, validaciones defensivas y estrategia de pruebas)
- OWASP_INPUT_VALIDATION (Validacion de entradas y controles de seguridad)
- API_CONTRACTS (Contratos, compatibilidad y diseno de interfaces)

Debes responder ÚNICAMENTE en formato JSON válido que cumpla estrictamente con este esquema:
{
  "summary": "Resumen ejecutivo del análisis técnico de la solución",
  "overallScore": 4.2,
  "skillEvaluations": [
    {
      "skillKey": "CLEAN_ARCHITECTURE",
      "score": 4.5,
      "feedback": "Justificación fundamentada en el código",
      "evidenceSnippet": "Línea o bloque relevante"
    }
  ],
  "detectedPatterns": [
    {
      "pattern": "Nombre del patrón detectado",
      "type": "BEST_PRACTICE" | "ANTI_PATTERN" | "ANTIPATTERN" | "SECURITY_RISK",
      "explanation": "Explicación técnica del impacto"
    }
  ]
}
Nota: Las notas van de 1.0 a 5.0.`;

    // 3. Invocación a Gemini
    const rawResult = await this.callGeminiWithRetry(prompt);

    // 4. Validación con contrato Zod de @perfilador/schemas
    const parsed = CodeQualityEvaluationSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`La respuesta del modelo no cumple con el esquema: ${parsed.error.message}`);
    }

    const evaluation = parsed.data;
    let signalId: string | undefined;

    // 5. Persistencia automática en Supabase si se solicita
    if (input.persistToDatabase !== false && input.developerInfo?.email) {
      signalId = await this.persistEvaluation(input.developerInfo.email, target, track, evaluation, {
        redactedSecrets: redactedCount,
        externalRef: input.externalRef || 'PR-REVIEW-EVAL'
      });
    }

    return { ...evaluation, signalId };
  }

  private async persistEvaluation(
    email: string,
    targetSeniority: string,
    track: string,
    evaluation: CodeQualityEvaluation,
    metadata: { redactedSecrets: number; externalRef: string }
  ): Promise<string> {
    console.log(`💾 [Persistencia] Guardando evaluación en Supabase para ${email}...`);

    // Buscar el desarrollador por email
    const devRows = await db.select().from(developers).where(eq(developers.email, email)).limit(1);
    if (devRows.length === 0) {
      console.warn(`⚠️ [Persistencia] Desarrollador con email ${email} no encontrado en base de datos. Saltando guardado.`);
      return '';
    }
    const dev = devRows[0];

    // A. Registrar en evaluation_signals
    const [signal] = await db.insert(evaluationSignals).values({
      developerId: dev.id,
      sourceType: 'GITHUB_PR_EVALUATION',
      externalRef: metadata.externalRef,
      diffSummary: { redactedSecrets: metadata.redactedSecrets },
      rawEvaluations: evaluation
    }).returning({ id: evaluationSignals.id });

    // B. Actualizar matriz de habilidades (developer_skill_matrix) con cálculo de gaps vs benchmarks
    for (const item of evaluation.skillEvaluations) {
      const benchmarkRows = await db.select()
        .from(seniorityBenchmarks)
        .where(
          and(
            eq(seniorityBenchmarks.track, track),
            eq(seniorityBenchmarks.seniorityLevel, targetSeniority),
            eq(seniorityBenchmarks.skillKey, item.skillKey)
          )
        )
        .limit(1);

      const required = Number(benchmarkRows[0]?.requiredScore ?? 3.5);
      const gap = Number((item.score - required).toFixed(2));

      await db.insert(developerSkillMatrix).values({
        developerId: dev.id,
        skillKey: item.skillKey,
        currentScore: item.score.toFixed(2),
        confidenceScore: '0.95',
        lastSignalAt: new Date(),
        gapVsTarget: gap.toFixed(2)
      }).onConflictDoUpdate({
        target: [developerSkillMatrix.developerId, developerSkillMatrix.skillKey],
        set: {
          currentScore: item.score.toFixed(2),
          confidenceScore: '0.95',
          lastSignalAt: new Date(),
          gapVsTarget: gap.toFixed(2)
        }
      });
    }

    console.log(`✅ [Persistencia] Señal guardada con ID: ${signal.id} y matriz de habilidades actualizada en Supabase.`);
    return signal.id;
  }

  private async callGeminiWithRetry(prompt: string): Promise<unknown> {
    const models = [this.modelName, 'gemini-3.1-flash-lite'];

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🤖 [Gemini] Consultando modelo ${model} (intento ${attempt})...`);
          const res = await this.ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
          });
          const text = res.text?.trim() || '{}';
          return JSON.parse(text);
        } catch (err: any) {
          console.error(`[Error con ${model} intento ${attempt}]:`, err.message);
          const isRateLimitOrBusy = err.message?.includes('429') || err.message?.includes('503');
          if (isRateLimitOrBusy && attempt < 2) {
            console.log('[Gemini] Reintentando en 2.5 segundos...');
            await new Promise((resolve) => setTimeout(resolve, 2500));
          } else if (isRateLimitOrBusy) {
            break;
          } else {
            throw err;
          }
        }
      }
    }
    throw new Error('No se pudo obtener evaluación de los modelos de Gemini disponibles.');
  }
}
