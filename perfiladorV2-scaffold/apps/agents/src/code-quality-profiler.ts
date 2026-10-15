import { GoogleGenAI } from '@google/genai';
import { SecretSanitizer } from '@perfilador/sanitizer';
import {
  CodeQualityEvaluationSchema,
  CodeQualityEvaluation,
  SeniorityLevel,
  TechTrack
} from '@perfilador/schemas';

export interface CodeQualityProfilerInput {
  codeOrDiff: string;
  developerInfo?: {
    email?: string;
    currentSeniority?: SeniorityLevel;
    targetSeniority?: SeniorityLevel;
    techTrack?: TechTrack;
  };
  customInstructions?: string;
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

  public async evaluate(input: CodeQualityProfilerInput): Promise<CodeQualityEvaluation> {
    // 1. Sanitización obligatoria antes de llamar al modelo
    const { sanitized, hasRedactions, redactedCount } = SecretSanitizer.sanitize(input.codeOrDiff);

    if (hasRedactions) {
      console.log(`[CodeQualityProfilerAgent] Se redactaron ${redactedCount} secretos antes de enviar a Gemini.`);
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
- CONCURRENCY_ASYNC (Manejo correcto de asincronía, race conditions, ACID)
- TESTING_RESILIENCE (Manejo de errores, validaciones defensivas)
- CODE_SIMPLICITY (Legibilidad, mantenibilidad, SOLID)

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
      "type": "BEST_PRACTICE",
      "explanation": "Explicación técnica del impacto"
    }
  ]
}
Nota: Las notas van de 1.0 a 5.0.`;

    // 3. Invocación a Gemini con fallback a gemini-3.1-flash-lite si hay 503
    const rawResult = await this.callGeminiWithRetry(prompt);

    // 4. Validación con contrato Zod de @perfilador/schemas
    const parsed = CodeQualityEvaluationSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`La respuesta del modelo no cumple con el esquema: ${parsed.error.message}`);
    }

    return parsed.data;
  }

  private async callGeminiWithRetry(prompt: string): Promise<unknown> {
    const models = [this.modelName, 'gemini-3.1-flash-lite'];

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini] Consultando modelo ${model} (intento ${attempt})...`);
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
            break; // Salta al siguiente modelo si el actual sigue saturado
          } else {
            throw err;
          }
        }
      }
    }
    throw new Error('No se pudo obtener evaluación de los modelos de Gemini disponibles.');
  }
}