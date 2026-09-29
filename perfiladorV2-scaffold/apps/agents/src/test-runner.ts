import dotenv from 'dotenv';
import path from 'path';
import { CodeQualityProfilerAgent } from './code-quality-profiler';

// Cargar variables de entorno desde el .env del scaffold
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

async function run() {
  console.log('🤖 [1/3] Inicializando CodeQualityProfilerAgent...\n');
  const agent = new CodeQualityProfilerAgent();

  // Simulación de un Pull Request con código backend y una API Key accidental
  const samplePrDiff = `
diff --git a/services/paymentService.ts b/services/paymentService.ts
index a1b2c3d..e4f5g6h 100644
--- a/services/paymentService.ts
+++ b/services/paymentService.ts
@@ -1,15 +1,28 @@
 import { db } from '../db';
+const ittiPaymentApiKey = "AIzaSyD-12345678901234567890123456789012345";
 
 export class PaymentService {
+  // Procesamiento de transferencias masivas
+  async processBatchTransfers(transfers: any[]) {
+    const results = [];
+    for (const transfer of transfers) {
+      // Operación secuencial sin bloque de transacción ACID
+      const user = await db.query('SELECT * FROM accounts WHERE id = $1', [transfer.userId]);
+      if (user.rows[0].balance >= transfer.amount) {
+        await db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [transfer.amount, transfer.userId]);
+        await db.query('INSERT INTO transactions (user_id, amount) VALUES ($1, $2)', [transfer.userId, transfer.amount]);
+        results.push({ userId: transfer.userId, status: 'SUCCESS' });
+      }
+    }
+    return results;
+  }
 }
`;

  console.log('🛡️  [2/3] Enviando Pull Request a evaluación agéntica...');
  const result = await agent.evaluate({
    codeOrDiff: samplePrDiff,
    developerInfo: {
      email: 'alejo.roldan@itti.digital',
      currentSeniority: 'MID_1',
      targetSeniority: 'SENIOR_1',
      techTrack: 'BACKEND_NODE'
    }
  });

  console.log('\n============================================================');
  console.log('📊 [3/3] RESULTADO DE LA EVALUACIÓN (CONTRATO ZOD VÁLIDO)');
  console.log('============================================================');
  console.log(`Nota Global: ⭐ ${result.overallScore} / 5.0`);
  console.log(`Resumen Ejecutivo:\n${result.summary}\n`);

  console.log('🎯 Calificación por Competencia Técnica:');
  for (const s of result.skillEvaluations) {
    console.log(`\n  • [${s.skillKey}] - Nota: ${s.score}/5.0`);
    console.log(`    Feedback: ${s.feedback}`);
    if (s.evidenceSnippet) {
      console.log(`    Evidencia: "${s.evidenceSnippet}"`);
    }
  }

  if (result.detectedPatterns && result.detectedPatterns.length > 0) {
    console.log('\n🔍 Patrones Detectados:');
    for (const p of result.detectedPatterns) {
      console.log(`  [${p.type}] ${p.pattern}: ${p.explanation}`);
    }
  }
}

run().catch((err) => {
  console.error('\n❌ Error durante la ejecución:', err.message);
});