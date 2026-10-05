import { GoogleGenAI } from '@google/genai';
import {
  CurriculumModuleSpecSchema,
  CurriculumModuleSpec
} from '@perfilador/schemas';
import {
  db,
  developers,
  organizations,
  skillTaxonomy,
  learningModules
} from '@perfilador/database';
import { eq } from 'drizzle-orm';

export interface CurriculumBuilderInput {
  email: string;
  skillKey: string;
  gapVsTarget?: number;
  antipatternsFound?: string[];
  persistToDatabase?: boolean;
}

export class CurriculumBuilderAgent {
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

  public async buildModule(input: CurriculumBuilderInput): Promise<CurriculumModuleSpec & { moduleId?: string }> {
    // 1. Obtener contexto del desarrollador y su organización en Supabase
    const devRows = await db.select({
      id: developers.id,
      email: developers.email,
      currentSeniority: developers.currentSeniority,
      targetSeniority: developers.targetSeniority,
      techTrack: developers.techTrack,
      orgId: developers.orgId
    }).from(developers).where(eq(developers.email, input.email)).limit(1);

    if (devRows.length === 0) {
      throw new Error(`Desarrollador con email ${input.email} no encontrado en la base de datos.`);
    }
    const dev = devRows[0];

    const orgRows = await db.select().from(organizations).where(eq(organizations.id, dev.orgId)).limit(1);
    const orgName = orgRows[0]?.name || 'Organización';

    // 2. Obtener definición de la habilidad desde skill_taxonomy
    const skillRows = await db.select().from(skillTaxonomy).where(eq(skillTaxonomy.skillKey, input.skillKey)).limit(1);
    const skillName = skillRows[0]?.displayName || input.skillKey;
    const skillDesc = skillRows[0]?.description || '';

    console.log(`🎓 [CurriculumBuilder] Generando cápsula L&D para ${dev.email} sobre [${input.skillKey}]...`);

    // 3. Construcción del Prompt Socrático de L&D
    const prompt = `
Eres el Chief Learning Officer y Staff Architect de ${orgName}.
Tu objetivo es diseñar una micro-cápsula de aprendizaje Just-In-Time (JIT) interactiva para cerrar una brecha técnica crítica.

Perfil del Colaborador:
- Correo: ${dev.email}
- Rol actual: ${dev.currentSeniority} ➔ Meta de Ascenso: ${dev.targetSeniority}
- Track Técnico: ${dev.techTrack}

Habilidad en Brecha:
- Clave: "${input.skillKey}" (${skillName})
- Descripción de referencia: ${skillDesc}
${input.gapVsTarget ? `- Brecha cuantitativa contra el benchmark: ${input.gapVsTarget} puntos` : ''}
${input.antipatternsFound && input.antipatternsFound.length > 0 ? `- Antipatrones detectados recientemente en su código:\n  ${input.antipatternsFound.map(a => `* ${a}`).join('\n  ')}` : ''}

Requisitos de la Cápsula L&D:
1. "title": Título atractivo, técnico y formativo para ingeniería de producción.
2. "explanation": Explicación concisa (2 párrafos) de los principios teóricos y el "por qué" de las buenas prácticas (ej. concurrencia, transacciones ACID, aislamiento, rendimiento).
3. "challengeScenario": Un laboratorio práctico de código en TypeScript/Node.js. Presenta una función o servicio que contiene un bug o antipatrón intencional y explica la tarea que el desarrollador debe corregir.
4. "solutionTemplate": Esqueleto o plantilla de código inicial que el desarrollador debe completar en su editor.
5. "verificationCriteria": Lista de 3 a 4 criterios de validación concretos que verifican si el reto fue superado.
6. "estimatedMinutes": Tiempo estimado de resolución (entre 15 y 30 minutos).

Debes responder ÚNICAMENTE en formato JSON válido que cumpla estrictamente con este esquema:
{
  "title": "Título de la cápsula",
  "skillKey": "${input.skillKey}",
  "explanation": "Explicación técnica fundamentada en producción",
  "challengeScenario": "Descripción del reto y código inicial con el problema",
  "solutionTemplate": "Plantilla de código TypeScript para que el usuario implemente",
  "verificationCriteria": ["Criterio 1", "Criterio 2", "Criterio 3"],
  "estimatedMinutes": 20
}`;

    // 4. Invocación a Gemini
    const rawResult = (await this.callGeminiWithRetry(prompt)) as any;

    // 5. Validación con Zod
    const parsed = CurriculumModuleSpecSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`La respuesta del modelo no cumple con el esquema: ${parsed.error.message}`);
    }

    const moduleSpec = parsed.data;
    let moduleId: string | undefined;

    // 6. Persistencia en la tabla learning_modules de Supabase
    if (input.persistToDatabase !== false) {
      console.log(`💾 [Persistencia] Guardando módulo L&D en Supabase...`);
      const [record] = await db.insert(learningModules).values({
        developerId: dev.id,
        skillKey: input.skillKey,
        title: moduleSpec.title,
        contentBlocks: {
          explanation: moduleSpec.explanation,
          challengeScenario: moduleSpec.challengeScenario,
          solutionTemplate: moduleSpec.solutionTemplate,
          verificationCriteria: moduleSpec.verificationCriteria,
          estimatedMinutes: moduleSpec.estimatedMinutes
        },
        status: 'ASSIGNED'
      }).returning({ id: learningModules.id });

      moduleId = record.id;
      console.log(`✅ [Persistencia] Módulo L&D asignado en Supabase con ID: ${moduleId}`);
    }

    return { ...moduleSpec, moduleId };
  }

  private async callGeminiWithRetry(prompt: string): Promise<unknown> {
    const models = [this.modelName, 'gemini-3.1-flash-lite'];

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🤖 [Gemini] Diseñando currículo con modelo ${model} (intento ${attempt})...`);
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
    throw new Error('No se pudo obtener diseño de currículo de los modelos de Gemini.');
  }
}