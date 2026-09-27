import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const { Client } = pg;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PORT = 3005;

async function getDashboardData() {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  const devRes = await db.query(`
    SELECT d.id, d.email, d.current_seniority, d.target_seniority, d.tech_track, o.name as org_name
    FROM developers d
    JOIN organizations o ON d.org_id = o.id
    WHERE d.email = 'carlos.mendoza@uenobank.com.py'
  `);
  const dev = devRes.rows[0];

  const skillsRes = await db.query(`
    SELECT 
      st.skill_key, 
      st.display_name, 
      COALESCE(dsm.current_score, 1.0) as current_score,
      COALESCE(sb.required_score, 3.5) as required_score,
      COALESCE(dsm.gap_vs_target, -2.5) as gap_vs_target
    FROM skill_taxonomy st
    LEFT JOIN developer_skill_matrix dsm ON st.skill_key = dsm.skill_key AND dsm.developer_id = $1
    LEFT JOIN seniority_benchmarks sb ON st.skill_key = sb.skill_key AND sb.seniority_level = $2 AND sb.track = $3
    ORDER BY st.domain ASC
  `, [dev.id, dev.target_seniority, dev.tech_track]);

  const modulesRes = await db.query(`
    SELECT id, title, skill_key, content_blocks, interactive_challenge, status, completed_at
    FROM learning_modules
    WHERE developer_id = $1
    ORDER BY created_at DESC
  `, [dev.id]);

  await db.end();
  return { dev, skills: skillsRes.rows, modules: modulesRes.rows };
}

async function evaluateCodeSnippet(code) {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  const devRes = await db.query("SELECT id, tech_track, target_seniority FROM developers WHERE email = 'carlos.mendoza@uenobank.com.py'");
  const dev = devRes.rows[0];

  const rubricsRes = await db.query("SELECT skill_key, display_name, rubric_levels FROM skill_taxonomy");

  const prompt = `
Eres un Staff Principal Engineer y Evaluador de L&D.
Evalúa el siguiente fragmento de código de un Pull Request:
\`\`\`javascript
${code}
\`\`\`
Rúbricas oficiales de la empresa:
${JSON.stringify(rubricsRes.rows, null, 2)}

Evalúa de 1.0 a 5.0 las habilidades que sean aplicables al código enviado (ej. CLEAN_ARCHITECTURE, OWASP_INPUT_VALIDATION, SQL_OPTIMIZATION_CONCURRENCY, etc.).
Responde ÚNICAMENTE en JSON con esta estructura:
{
  "evaluations": [
    {
      "skillKey": "nombre_habilidad",
      "score": 4.5,
      "rationale": "explicación de la nota",
      "antipatterns": []
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  const parsed = JSON.parse(response.text.trim());

  // Actualizar la base de datos para cada habilidad evaluada
  for (const item of parsed.evaluations) {
    const benchmarkRes = await db.query(
      "SELECT required_score FROM seniority_benchmarks WHERE track = $1 AND seniority_level = $2 AND skill_key = $3",
      [dev.tech_track, dev.target_seniority, item.skillKey]
    );
    const required = benchmarkRes.rows[0]?.required_score || 3.50;
    const gap = Number(item.score) - Number(required);

    await db.query(`
      INSERT INTO developer_skill_matrix (developer_id, skill_key, current_score, confidence_score, last_signal_at, gap_vs_target)
      VALUES ($1, $2, $3, 0.95, NOW(), $4)
      ON CONFLICT (developer_id, skill_key) DO UPDATE 
      SET current_score = EXCLUDED.current_score,
          last_signal_at = NOW(),
          gap_vs_target = EXCLUDED.gap_vs_target;
    `, [dev.id, item.skillKey, item.score, gap]);
  }

  await db.end();
  return parsed;
}

function renderSvgRadar(skills) {
  const size = 380;
  const center = size / 2; // 190
  const maxR = 105;
  const n = skills.length || 5;

  const getPoint = (score, i, customR = null) => {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const r = customR !== null ? customR : (Math.min(5, Math.max(0, score)) / 5) * maxR;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Anillos concéntricos
  let rings = '';
  for (let lvl = 1; lvl <= 5; lvl++) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const p = getPoint(lvl, i);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    rings += `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(51, 65, 85, 0.45)" stroke-width="1"/>`;
    rings += `<text x="${center + 4}" y="${center - (lvl / 5 * maxR) + 3}" fill="#64748b" font-size="9" font-family="monospace">${lvl}</text>`;
  }

  // Ejes radiales y etiquetas de texto en cada vértice
  let axes = '';
  let labelsSvg = '';
  for (let i = 0; i < n; i++) {
    const p = getPoint(5, i);
    axes += `<line x1="${center}" y1="${center}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(51, 65, 85, 0.6)" stroke-width="1"/>`;
    
    // Etiqueta en el vértice
    const lp = getPoint(5, i, maxR + 24);
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const anchor = Math.abs(Math.cos(angle)) < 0.25 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end');
    const skillWords = skills[i].display_name.split(' ');
    const shortName = skillWords.slice(0, 2).join(' ');
    labelsSvg += `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" fill="#94a3b8" font-size="9" font-weight="600" text-anchor="${anchor}">${shortName}</text>`;
  }

  // Polígono Meta
  const targetPts = skills.map((s, i) => {
    const p = getPoint(Number(s.required_score), i);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  // Polígono Actual
  const currentPts = skills.map((s, i) => {
    const p = getPoint(Number(s.current_score), i);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  // Puntos
  let dots = '';
  skills.forEach((s, i) => {
    const p = getPoint(Number(s.current_score), i);
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#10b981" stroke="#047857" stroke-width="1.5"/>`;
  });

  return `
    <svg viewBox="0 0 ${size} ${size}" class="w-full max-w-[360px] aspect-square overflow-visible">
      ${rings}
      ${axes}
      ${labelsSvg}
      <polygon points="${targetPts}" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4"/>
      <polygon points="${currentPts}" fill="rgba(16, 185, 129, 0.35)" stroke="#10b981" stroke-width="2.5"/>
      ${dots}
    </svg>
  `;
}

function renderHTML(data) {
  const { dev, skills, modules } = data;
  const radarSvg = renderSvgRadar(skills);

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechProfiler - ${dev.org_name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style> body { font-family: 'Inter', sans-serif; } </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
          TP
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-white tracking-tight">TechProfiler & L&D</h1>
            <span class="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono border border-slate-700">v2.0</span>
          </div>
          <p class="text-xs text-emerald-400 font-medium">${dev.org_name} · Conglomerado Grupo Vázquez</p>
        </div>
      </div>
      <div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Supabase + Gemini 3 Conectados
        </span>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8 space-y-8">
    <!-- Header del Ingeniero -->
    <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Perfil Técnico Evaluado</span>
          <h2 class="text-2xl font-bold text-white mt-1">${dev.email}</h2>
          <p class="text-sm text-slate-400 mt-1">Especialidad: <span class="text-slate-200 font-medium">${dev.tech_track}</span></p>
        </div>
        <div class="flex items-center gap-4">
          <div class="bg-slate-950/60 border border-slate-800 px-5 py-3 rounded-xl text-center">
            <span class="block text-[11px] font-medium text-slate-400 uppercase tracking-wide">Nivel Base</span>
            <span class="text-base font-bold text-amber-400">${dev.current_seniority}</span>
          </div>
          <span class="text-slate-600 text-xl font-bold">➔</span>
          <div class="bg-slate-950/60 border border-emerald-500/30 px-5 py-3 rounded-xl text-center shadow-lg shadow-emerald-500/5">
            <span class="block text-[11px] font-medium text-emerald-400 uppercase tracking-wide">Meta de Promoción</span>
            <span class="text-base font-bold text-emerald-400">${dev.target_seniority}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- NUEVO: SIMULADOR DE PULL REQUEST EN VIVO -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>⚡ Simulador de Pull Request en Vivo</span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">Envía código para que el Agente Evaluador lo califique en tiempo real y expanda el radar.</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="loadSample('clean')" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
            Ejemplo: Clean Architecture
          </button>
          <button onclick="loadSample('owasp')" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
            Ejemplo: Seguridad Zod
          </button>
        </div>
      </div>

      <div class="space-y-3">
        <textarea id="codeInput" rows="5" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition" placeholder="Pega aquí el código de un Pull Request para evaluar..."></textarea>
        <div class="flex items-center justify-between">
          <span id="statusMsg" class="text-xs text-slate-400"></span>
          <button onclick="submitEvaluation()" id="submitBtn" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/10">
            <span>🚀 Analizar con Agente IA</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Grid: Radar SVG y Desglose -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Radar Nativo SVG -->
      <div class="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
        <div class="w-full flex items-center justify-between mb-2">
          <div>
            <h3 class="text-base font-bold text-white">Tech Radar de Habilidades</h3>
            <p class="text-xs text-slate-400">Dimensiones calculadas con pgvector</p>
          </div>
          <span class="text-[11px] font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded">Escala 1 - 5</span>
        </div>

        <div class="w-full flex items-center justify-center py-4">
          ${radarSvg}
        </div>

        <div class="w-full grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-slate-800 text-xs">
          <div class="flex items-center gap-2 text-slate-300">
            <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span>Nivel Actual de Carlos</span>
          </div>
          <div class="flex items-center gap-2 text-slate-300">
            <span class="w-3 h-1 bg-amber-400"></span>
            <span>Meta Mid 2 (${dev.target_seniority})</span>
          </div>
        </div>
      </div>

      <!-- Desglose de Competencias -->
      <div class="lg:col-span-6 space-y-3">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-base font-bold text-white">Desglose por Competencia</h3>
          <span class="text-xs text-slate-400">5 Habilidades Evaluadas</span>
        </div>
        <div class="space-y-3">
          ${skills.map(s => {
            const current = Number(s.current_score);
            const req = Number(s.required_score);
            const gap = current - req;
            const isPassed = gap >= 0;
            const progressPct = Math.min(100, Math.round((current / 5) * 100));
            return `
            <div class="bg-slate-900 border border-slate-800 hover:border-slate-700 transition p-4 rounded-xl space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-bold text-white">${s.display_name}</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Nota: <span class="font-bold text-white">${current.toFixed(2)}</span> / 5.00 · Requerido para ${dev.target_seniority}: <span class="text-slate-300">${req.toFixed(2)}</span></p>
                </div>
                <div>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    isPassed 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }">
                    ${isPassed ? '✓ Superado (+' + gap.toFixed(1) + ')' : '⚠ Déficit (' + gap.toFixed(1) + ')'}
                  </span>
                </div>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div class="${isPassed ? 'bg-emerald-500' : 'bg-rose-500'} h-2 rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </main>

  <script>
    const samples = {
      clean: \`// Módulo aplicando Clean Architecture e Inversión de Dependencias
export class AccountService {
  constructor(private readonly accountRepo: AccountRepository, private readonly logger: LoggerService) {}

  async getAccountBalance(accountId: string): Promise<AccountDto> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');
    this.logger.info('Account retrieved successfully', { accountId });
    return AccountMapper.toDto(account);
  }
}\`,
      owasp: \`// Validación defensiva estricta con Zod Schema para prevenir inyecciones
import { z } from 'zod';

const TransferSchema = z.object({
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  amount: z.number().positive().max(50000000)
});

export function validateTransfer(input: unknown) {
  const parsed = TransferSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.format());
  }
  return parsed.data;
}\`
    };

    function loadSample(type) {
      document.getElementById('codeInput').value = samples[type];
    }

    async function submitEvaluation() {
      const code = document.getElementById('codeInput').value.trim();
      if (!code) {
        alert('Por favor ingresa o carga un fragmento de código primero.');
        return;
      }

      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('statusMsg');

      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Evaluando con Gemini 3 Flash...</span>';
      msg.innerText = 'El agente está consultando las rúbricas y analizando el código...';

      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.success) {
          msg.innerText = '✅ ¡Evaluación completada con éxito! Actualizando radar...';
          setTimeout(() => { window.location.reload(); }, 1200);
        } else {
          alert('Error en la evaluación: ' + (data.error || 'Desconocido'));
          btn.disabled = false;
          btn.innerHTML = '<span>🚀 Analizar con Agente IA</span>';
        }
      } catch (err) {
        alert('Error de conexión: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Analizar con Agente IA</span>';
      }
    }
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/evaluate') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { code } = JSON.parse(body);
        const result = await evaluateCodeSnippet(code);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.url === '/' || req.url === '') {
    try {
      const data = await getDashboardData();
      const html = renderHTML(data);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error cargando el dashboard: ' + err.message);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log(`🚀 TECHPROFILER DASHBOARD CON SIMULADOR ACTIVO EN:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log('=======================================================');
});