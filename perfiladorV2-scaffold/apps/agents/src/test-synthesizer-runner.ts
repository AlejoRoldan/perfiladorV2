import dotenv from 'dotenv';
import path from 'path';
import { SkillSynthesizerAgent } from './skill-synthesizer';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

async function run() {
  const testEmail = 'alejo.roldan@itti.digital';

  console.log('🤖 [1/3] Inicializando SkillSynthesizerAgent...\n');
  const synthesizer = new SkillSynthesizerAgent();

  console.log('📈 [2/3] Calculando decaimiento temporal y sintetizando Tech Radar...');
  const report = await synthesizer.synthesize(testEmail, {
    decayRate: 0.015,
    persistToDatabase: true
  });

  console.log('\n============================================================');
  console.log('📊 [3/3] REPORTE DE SÍNTESIS AGÉNTICA (ACTUALIZADO EN SUPABASE)');
  console.log('============================================================');
  console.log(`Desarrollador ID: ${report.developerId}`);
  console.log(`Tendencia General: 🚀 ${report.overallTrend}`);
  console.log(`Diagnóstico Ejecutivo:\n${report.summary}\n`);

  console.log('🎯 Matriz Consolidada de Habilidades:');
  for (const s of report.skillSynthesis) {
    const icon = s.status === 'EXCEEDED' ? '✓ Superado' : (s.status === 'ON_TRACK' ? '✓ En Meta' : '⚠ Déficit');
    console.log(`  • [${s.skillKey}] - Nota: ${s.synthesizedScore}/5.0 | Meta: ${s.requiredScore} | Gap: ${s.gapVsTarget} (${icon}) | Confianza: ${(s.confidenceScore * 100).toFixed(0)}% (${s.signalCount} señales)`);
  }

  if (report.criticalGaps.length > 0) {
    console.log('\n⚠️ Brechas Críticas a Resolver:');
    for (const g of report.criticalGaps) {
      console.log(`  ! ${g}`);
    }
  }

  if (report.recommendedFocus.length > 0) {
    console.log('\n💡 Foco de Entrenamiento Recomendado (L&D):');
    for (const r of report.recommendedFocus) {
      console.log(`  ★ ${r}`);
    }
  }
}

run().catch((err) => {
  console.error('\n❌ Error durante la ejecución:', err.message);
});