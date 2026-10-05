import { GoogleGenAI } from '@google/genai';
import { SecretSanitizer } from '@perfilador/sanitizer';
import {
  ReviewerDynamicsEvaluationSchema,
  ReviewerDynamicsEvaluation,
  SeniorityLevel,
  TechTrack
} from '@perfilador/schemas';
import {
  db,
  developers,
  evaluationSignals,
  developerSkillMatrix,
  seniorityBenchmarks,
  skillTaxonomy
} from '@perfilador/database';
import { eq, and } from 'drizzle-orm';

export interface ReviewerDynamicsInput {
  reviewComments: string;
  prContext?: string;
  reviewerInfo?: {
    email: string;
    currentSeniority?: SeniorityLevel;
    targetSeniority?: SeniorityLevel;
    techTrack?: TechTrack;
  };
  externalRef?: string;
  persistToDatabase?: boolean;
}

// Mapeador de seguridad para normalizar variantes comunes que pueda devolver la IA
const SKILL_ALIASES: Record<string, string> = {
  CODE_REVIEW: 'CODE_REVIEW_PEDAGOGY',
  PEDAGOGY: 'CODE_REVIEW_PEDAGOGY',
  EMPATHY: 'CODE_REVIEW_PEDAGOGY',
  CONCURRENCY: 'CONCURRENCY_ASYNC',
  ASYNC: 'CONCURRENCY_ASYNC',
  ARCHITECTURE: 'CLEAN_ARCHITECTURE',
  SOLID: 'CLEAN_ARCHITECTURE',
  CLEAN_CODE: 'CODE_SIMPLICITY',
  DATABASE: 'DATABASE_OPTIMIZATION',
  ACID: 'DATABASE_OPTIMIZATION',
  SECURITY: 'API_DESIGN_SECURITY',
  TESTING: 'TESTING_STRATEGIES',
  DOCUMENTATION: 'TECHNICAL_DOCUMENTATION'
};

export class ReviewerDynamicsAgent {
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

  public async evaluate(input: ReviewerDynamicsInput): Promise<ReviewerDynamicsEvaluation & { signalId?: string }> {
    // 1. Sanitización obligatoria del feedback
    const { sanitized: sanitizedComments, hasRedactions, redactedCount } = SecretSanitizer.sanitize(input.reviewComments);

    if (hasRedactions) {
      console.log(`🛡️  [ReviewerDynamicsAgent] Se redactaron ${redactedCount} secretos del feedback.`);
    }

    const sanitizedPrContext = input.prContext ? SecretSanitizer.sanitize(input.prContext).sanitized : 'No especificado';

    // 2. Construcción del Prompt Socrático
    const target = input.reviewerInfo?.targetSeniority || 'SENIOR_1';
    const track = input.reviewerInfo?.techTrack || 'BACKEND_NODE';

    const prompt = `
Eres un Staff Principal Architect y Lead Evaluator evaluando las habilidades de Code Review de un ingeniero.
Nivel Meta del Revisor: ${target}
Track Técnico: ${track}

Contexto del Pull Request revisado:
\`\`\`
${sanitizedPrContext}
\`\`\`

Comentarios y feedback emitidos por el revisor:
\`\`\`
${sanitizedComments}
\`\`\`

Evalúa las dimensiones de revisión de código:
1. CODE_REVIEW_PEDAGOGY: ¿El feedback es claro, explicativo, respetuoso y pedagógico? ¿Enseña el "por qué" o es tajante/punitivo?
2. Rigor Técnico: ¿Identificó problemas de fondo (arquitectura, seguridad, concurrencia, casos borde) o solo detalles cosméticos de estilo?
3. Accionabilidad: ¿Aportó sugerencias de código concretas o alternativas viables?

REGLA ESTRICTA DE TAXONOMÍA:
En "skillEvaluations", el campo "skillKey" DEBE pertenecer obligatoriamente a esta lista oficial:
- "CODE_REVIEW_PEDAGOGY" (Dimensión principal obligatoria)
- "CONCURRENCY_ASYNC"
- "CLEAN_ARCHITECTURE"
- "DATABASE_OPTIMIZATION"
- "TESTING_STRATEGIES"
- "DEFENSIVE_PROGRAMMING"
- "CODE_SIMPLICITY"
- "API_DESIGN_SECURITY"
- "TECHNICAL_DOCUMENTATION"
- "SYSTEM_DESIGN_RESILIENCE"

Debes responder ÚNICAMENTE en formato JSON válido con este esquema:
{
  "summary": "Resumen ejecutivo del desempeño como revisor de código",
  "overallScore": 4.5,
  "skillEvaluations": [
    {
      "skillKey": "CODE_REVIEW_PEDAGOGY",
      "score": 4.7,
      "feedback": "Justificación sobre la pedagogía y empatía observada",
      "evidenceSnippet": "Fragmento del comentario que demuestra esta cualidad"
    }
  ],
  "toneAnalysis": {
    "empathyScore": 4.5,
    "pedagogyScore": 4.8,
    "constructiveness": "EXCELLENT" | "ADEQUATE" | "PUNITIVE_OR_BLUNT",
    "observations": "Observaciones detalladas sobre el tono y la comunicación interpersonal"
  },
  "actionableSuggestionsDetected": true,
  "keyStrengths": ["Fortaleza 1", "Fortaleza 2"],
  "improvementAreas": ["Área de mejora 1"]
}
Nota: Las notas van de 1.0 a 5.0.`;

    // 3. Invocación a Gemini
    const rawResult = await this.callGeminiWithRetry(prompt);

    // 4. Validación estricta con Zod
    const parsed = ReviewerDynamicsEvaluationSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`La respuesta del modelo no cumple con el esquema: ${parsed.error.message}`);
    }

    const evaluation = parsed.data;
    let signalId: string | undefined;

    // 5. Persistencia protegida en Supabase
    if (input.persistToDatabase !== false && input.reviewerInfo?.email) {
      signalId = await this.persistEvaluation(input.reviewerInfo.email, target, track, evaluation, {
        redactedSecrets: redactedCount,
        externalRef: input.externalRef || 'CODE-REVIEW-DYNAMICS'
      });
    }

    return { ...evaluation, signalId };
  }

  private async persistEvaluation(
    email: string,
    targetSeniority: string,
    track: string,
    evaluation: ReviewerDynamicsEvaluation,
    metadata: { redactedSecrets: number; externalRef: string }
  ): Promise<string> {
    console.log(`💾 [Persistencia] Guardando evaluación de Code Review en Supabase para ${email}...`);

    const devRows = await db.select().from(developers).where(eq(developers.email, email)).limit(1);
    if (devRows.length === 0) {
      console.warn(`⚠️ [Persistencia] Desarrollador con email ${email} no encontrado. Saltando guardado.`);
      return '';
    }
    const dev = devRows[0];

    // Obtener las claves canónicas registradas en Supabase
    const validSkills = await db.select({ key: skillTaxonomy.skillKey }).from(skillTaxonomy);
    const validSkillSet = new Set(validSkills.map((s) => s.key));

    // A. Guardar la señal inmutable
    const [signal] = await db.insert(evaluationSignals).values({
      developerId: dev.id,
      sourceType: 'CODE_REVIEW_SIMULATION',
      externalRef: metadata.externalRef,
      diffSummary: { redactedSecrets: metadata.redactedSecrets, tone: evaluation.toneAnalysis.constructiveness },
      rawEvaluations: evaluation
    }).returning({ id: evaluationSignals.id });

    // B. Actualizar matriz de habilidades con validación y normalización de claves
    for (const item of evaluation.skillEvaluations) {
      const rawKey = item.skillKey.trim().toUpperCase();
      // Resolver si vino una variante abreviada
      const resolvedKey = SKILL_ALIASES[rawKey] || rawKey;

      if (!validSkillSet.has(resolvedKey)) {
        console.warn(`⚠️️ [Persistencia] Clave '${resolvedKey}' no existe en skill_taxonomy. Omitida para evitar error de clave foránea.`);
        continue;
      }

      const benchmarkRows = await db.select()
        .from(seniorityBenchmarks)
        .where(
          and(
            eq(seniorityBenchmarks.track, track),
            eq(seniorityBenchmarks.seniorityLevel, targetSeniority),
            eq(seniorityBenchmarks.skillKey, resolvedKey)
          )
        )
        .limit(1);

      const required = Number(benchmarkRows[0]?.requiredScore ?? 3.5);
      const gap = Number((item.score - required).toFixed(2));

      await db.insert(developerSkillMatrix).values({
        developerId: dev.id,
        skillKey: resolvedKey,
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
    throw new Error('No se pudo obtener evaluación de los modelos de Gemini.');
  }
}
