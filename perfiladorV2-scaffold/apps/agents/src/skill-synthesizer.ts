import { GoogleGenAI } from '@google/genai';
import {
  SkillSynthesisReportSchema,
  SkillSynthesisReport,
  CanonicalSkillKey
} from '@perfilador/schemas';
import {
  db,
  developers,
  evaluationSignals,
  developerSkillMatrix,
  seniorityBenchmarks,
  skillTaxonomy
} from '@perfilador/database';
import { eq, and, desc } from 'drizzle-orm';

export interface SynthesizerOptions {
  decayRate?: number; // Lambda de decaimiento (por defecto 0.015)
  persistToDatabase?: boolean;
}

interface RawSignalItem {
  skillKey: string;
  score: number;
  date: Date;
}

export class SkillSynthesizerAgent {
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

  public async synthesize(email: string, options: SynthesizerOptions = {}): Promise<SkillSynthesisReport> {
    const decayRate = options.decayRate ?? 0.015;

    // 1. Obtener desarrollador de Supabase
    const devRows = await db.select().from(developers).where(eq(developers.email, email)).limit(1);
    if (devRows.length === 0) {
      throw new Error(`Desarrollador con email ${email} no encontrado en la base de datos.`);
    }
    const dev = devRows[0];

    // 2. Extraer histórico de señales de evaluación
    const signals = await db.select()
      .from(evaluationSignals)
      .where(eq(evaluationSignals.developerId, dev.id))
      .orderBy(desc(evaluationSignals.createdAt));

    console.log(`📊 [SkillSynthesizer] Procesando ${signals.length} señales históricas para ${dev.email}...`);

    // 3. Extraer puntos de datos por habilidad
    const skillDataMap = new Map<string, RawSignalItem[]>();

    for (const signal of signals) {
      const raw = signal.rawEvaluations as any;
      if (raw && Array.isArray(raw.skillEvaluations)) {
        for (const item of raw.skillEvaluations) {
          if (item.skillKey && typeof item.score === 'number') {
            const list = skillDataMap.get(item.skillKey) || [];
            list.push({
              skillKey: item.skillKey,
              score: item.score,
              date: new Date(signal.createdAt)
            });
            skillDataMap.set(item.skillKey, list);
          }
        }
      }
    }

    // 4. Calcular ponderación matemática con decaimiento temporal
    const now = new Date().getTime();
    const calculatedSkills: Array<{
      skillKey: CanonicalSkillKey;
      synthesizedScore: number;
      confidenceScore: number;
      signalCount: number;
      requiredScore: number;
      gapVsTarget: number;
      status: 'EXCEEDED' | 'ON_TRACK' | 'DEFICIT';
    }> = [];

    // Obtener taxonomía y benchmarks para comparar
    const taxonomy = await db.select().from(skillTaxonomy);
    const validKeys = new Set(taxonomy.map((t: { skillKey: string }) => t.skillKey));

    for (const [key, items] of skillDataMap.entries()) {
      if (!validKeys.has(key)) continue;
      const skillKey = key as CanonicalSkillKey;

      let sumWeightedScores = 0;
      let sumWeights = 0;

      for (const item of items) {
        const daysElapsed = Math.max(0, (now - item.date.getTime()) / (1000 * 60 * 60 * 24));
        const weight = Math.exp(-decayRate * daysElapsed);

        sumWeightedScores += item.score * weight;
        sumWeights += weight;
      }

      const synthesizedScore = Number((sumWeights > 0 ? sumWeightedScores / sumWeights : 1.0).toFixed(2));
      // Confianza estadística asintótica: C = 1 - e^(-0.35 * sumWeights)
      const confidenceScore = Number(Math.min(0.99, 1 - Math.exp(-0.35 * sumWeights)).toFixed(2));

      // Benchmark objetivo
      const bench = await db.select()
        .from(seniorityBenchmarks)
        .where(
          and(
            eq(seniorityBenchmarks.track, dev.techTrack),
            eq(seniorityBenchmarks.seniorityLevel, dev.targetSeniority),
            eq(seniorityBenchmarks.skillKey, skillKey)
          )
        )
        .limit(1);

      const requiredScore = Number(bench[0]?.requiredScore ?? 3.5);
      const gapVsTarget = Number((synthesizedScore - requiredScore).toFixed(2));

      let status: 'EXCEEDED' | 'ON_TRACK' | 'DEFICIT' = 'DEFICIT';
      if (gapVsTarget >= 0.5) status = 'EXCEEDED';
      else if (gapVsTarget >= 0) status = 'ON_TRACK';

      calculatedSkills.push({
        skillKey,
        synthesizedScore,
        confidenceScore,
        signalCount: items.length,
        requiredScore,
        gapVsTarget,
        status
      });
    }

    // 5. Invocación a Gemini para síntesis cualitativa y diagnóstico ejecutivo
    const prompt = `
Eres un Staff Principal Architect y CTO Advisor analizando la síntesis de competencias de un ingeniero.
Colaborador interno: ${dev.id}
Nivel Actual: ${dev.currentSeniority} ➔ Meta de Ascenso: ${dev.targetSeniority}
Track: ${dev.techTrack}

Datos cuantitativos consolidados con decaimiento temporal:
${JSON.stringify(calculatedSkills, null, 2)}

Genera un diagnóstico estratégico respondiendo ÚNICAMENTE en JSON válido con este formato:
{
  "overallTrend": "ACCELERATING" | "STABLE" | "NEEDS_ATTENTION",
  "summary": "Resumen ejecutivo de 2 a 3 oraciones sobre el progreso real del colaborador y su madurez técnica",
  "criticalGaps": ["Lista de 1 o 2 habilidades críticas con mayor brecha que bloquean su ascenso"],
  "recommendedFocus": ["Acción pedagógica o recomendación de entrenamiento inmediata"]
}`;

    const rawAiResult = (await this.callGeminiWithRetry(prompt)) as any;

    const fullReport: SkillSynthesisReport = {
      developerId: dev.id,
      synthesizedAt: new Date().toISOString(),
      overallTrend: rawAiResult.overallTrend || 'STABLE',
      summary: rawAiResult.summary || 'Síntesis de competencias generada con decaimiento temporal.',
      skillSynthesis: calculatedSkills,
      criticalGaps: Array.isArray(rawAiResult.criticalGaps) ? rawAiResult.criticalGaps : [],
      recommendedFocus: Array.isArray(rawAiResult.recommendedFocus) ? rawAiResult.recommendedFocus : []
    };

    // Validar esquema Zod
    const validated = SkillSynthesisReportSchema.parse(fullReport);

    // 6. Actualizar matriz viva en Supabase si se solicita
    if (options.persistToDatabase !== false) {
      for (const item of validated.skillSynthesis) {
        await db.insert(developerSkillMatrix).values({
          developerId: dev.id,
          skillKey: item.skillKey,
          currentScore: item.synthesizedScore.toFixed(2),
          confidenceScore: item.confidenceScore.toFixed(2),
          lastSignalAt: new Date(),
          gapVsTarget: item.gapVsTarget.toFixed(2)
        }).onConflictDoUpdate({
          target: [developerSkillMatrix.developerId, developerSkillMatrix.skillKey],
          set: {
            currentScore: item.synthesizedScore.toFixed(2),
            confidenceScore: item.confidenceScore.toFixed(2),
            lastSignalAt: new Date(),
            gapVsTarget: item.gapVsTarget.toFixed(2)
          }
        });
      }
      console.log(`✅ [SkillSynthesizer] Matriz de habilidades en Supabase actualizada con scores sintetizados.`);
    }

    return validated;
  }

  private async callGeminiWithRetry(prompt: string): Promise<unknown> {
    const models = [this.modelName, 'gemini-3.1-flash-lite'];

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🤖 [Gemini] Generando diagnóstico con modelo ${model} (intento ${attempt})...`);
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
    throw new Error('No se pudo obtener síntesis de los modelos de Gemini.');
  }
}
