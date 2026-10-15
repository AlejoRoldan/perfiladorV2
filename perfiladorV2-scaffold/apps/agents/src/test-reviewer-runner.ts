import dotenv from 'dotenv';
import path from 'path';
import { ReviewerDynamicsAgent } from './reviewer-dynamics';
import { db, developers, organizations } from '@perfilador/database';
import { eq } from 'drizzle-orm';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

async function run() {
  const testEmail = 'alejo.roldan@itti.digital';

  // 1. Asegurar desarrollador en Supabase
  const orgs = await db.select().from(organizations).where(eq(organizations.slug, 'itti')).limit(1);
  if (orgs.length > 0) {
    await db.insert(developers).values({
      orgId: orgs[0].id,
      email: testEmail,
      githubUsername: 'AlejoRoldan',
      currentSeniority: 'MID_1',
      targetSeniority: 'SENIOR_1',
      techTrack: 'BACKEND_NODE'
    }).onConflictDoNothing();
  }

  console.log('🤖 [1/3] Inicializando ReviewerDynamicsAgent...\n');
  const agent = new ReviewerDynamicsAgent();

  // Simulación de comentarios de revisión emitidos por el desarrollador
  const sampleComments = `
Comentario en services/orderService.ts (Línea 45):
"¡Buen trabajo con la separación de módulos! Noto que en el método executePayment estamos realizando la consulta y actualización de saldo sin un bloque transaccional ACID. Si dos peticiones simultáneas entran con el mismo userId, podríamos tener una race condition (lost update).

Te sugiero envolverlo en una transacción con isolation level SERIALIZABLE o usar SELECT FOR UPDATE. Por ejemplo:
\`\`\`typescript
await db.transaction(async (tx) => {
  const account = await tx.query('SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [userId]);
  // validar y descontar saldo
});
\`\`\`
¿Qué opinas de este enfoque? Te dejo este enlace de la documentación interna de itti sobre concurrencia."
`;

  console.log('🛡️  [2/3] Evaluando dinámicas pedagógicas y rigor técnico...');
  const result = await agent.evaluate({
    reviewComments: sampleComments,
    prContext: 'Pull Request #24: Implementación de procesamiento concurrente de órdenes bancarias.',
    reviewerInfo: {
      email: testEmail,
      currentSeniority: 'MID_1',
      targetSeniority: 'SENIOR_1',
      techTrack: 'BACKEND_NODE'
    },
    externalRef: 'PR-#24-REVIEW-COMMENTS',
    persistToDatabase: true
  });

  console.log('\n============================================================');
  console.log('📊 [3/3] RESULTADO DE REVIEWER DYNAMICS (PERSISTIDO EN DB)');
  console.log('============================================================');
  console.log(`Señal Creada en DB (ID): ${result.signalId}`);
  console.log(`Nota Global de Revisión: ⭐ ${result.overallScore} / 5.0`);
  console.log(`Tono Constructivo: ${result.toneAnalysis.constructiveness}`);
  console.log(`Empatía: ${result.toneAnalysis.empathyScore}/5.0 | Pedagogía: ${result.toneAnalysis.pedagogyScore}/5.0`);
  console.log(`Observaciones de Tono: ${result.toneAnalysis.observations}\n`);

  console.log('🎯 Calificación por Competencia Técnica:');
  for (const s of result.skillEvaluations) {
    console.log(`  • [${s.skillKey}] - Nota: ${s.score}/5.0`);
    console.log(`    Feedback: ${s.feedback}`);
  }

  console.log('\n💪 Fortalezas Principales:');
  for (const str of result.keyStrengths) {
    console.log(`  ✓ ${str}`);
  }
}

run().catch((err) => {
  console.error('\n❌ Error durante la ejecución:', err.message);
});