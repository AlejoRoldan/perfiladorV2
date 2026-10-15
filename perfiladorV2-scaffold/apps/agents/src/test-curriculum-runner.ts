import dotenv from 'dotenv';
import path from 'path';
import { CurriculumBuilderAgent } from './curriculum-builder';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

async function run() {
  const testEmail = 'alejo.roldan@itti.digital';

  console.log('🤖 [1/3] Inicializando CurriculumBuilderAgent...\n');
  const builder = new CurriculumBuilderAgent();

  console.log('📚 [2/3] Diseñando micro-cápsula L&D interactiva para SQL_OPTIMIZATION_CONCURRENCY...');
  const moduleSpec = await builder.buildModule({
    email: testEmail,
    skillKey: 'SQL_OPTIMIZATION_CONCURRENCY',
    gapVsTarget: -1.2,
    antipatternsFound: [
      'Race Condition / Lost Update en operaciones de saldo',
      'Falta de transaccionalidad ACID en bucle de transferencias'
    ],
    persistToDatabase: true
  });

  console.log('\n============================================================');
  console.log('🎓 [3/3] CÁPSULA L&D GENERADA Y PERSISTIDA EN SUPABASE');
  console.log('============================================================');
  console.log(`Módulo ID: ${moduleSpec.moduleId}`);
  console.log(`Título: 📖 ${moduleSpec.title}`);
  console.log(`Competencia: [${moduleSpec.skillKey}] | Tiempo estimado: ⏱️  ${moduleSpec.estimatedMinutes} min\n`);

  console.log('📝 Explicación Técnica:');
  console.log(moduleSpec.explanation);

  console.log('\n🧪 Escenario del Laboratorio Práctico:');
  console.log(moduleSpec.challengeScenario);

  if (moduleSpec.solutionTemplate) {
    console.log('\n💻 Plantilla de Código Inicial:');
    console.log(moduleSpec.solutionTemplate);
  }

  console.log('\n🎯 Criterios de Verificación:');
  for (const c of moduleSpec.verificationCriteria) {
    console.log(`  ✓ ${c}`);
  }
}

run().catch((err) => {
  console.error('\n❌ Error durante la ejecución:', err.message);
});
