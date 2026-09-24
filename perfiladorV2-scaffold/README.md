# TechProfiler & L&D Platform (`perfiladorV2`)

> **Plataforma agéntica de perfilamiento continuo de capacidades técnicas a lo largo del SDLC y generación personalizada de rutas de aprendizaje y laboratorios para ingenieros de software.**

---

## 1. Visión del Proyecto

En las organizaciones de ingeniería de software de alto crecimiento, la evaluación del talento técnico suele sufrir de tres problemas críticos:
1. **Evaluaciones teóricas desconectadas de la realidad:** Pruebas estáticas de opción múltiple o algoritmos descontextualizados que no reflejan la calidad real del trabajo en producción.
2. **Falta de visibilidad sobre el SDLC diario:** La verdadera destreza de un ingeniero se demuestra en la arquitectura de sus Pull Requests, la solidez de sus pruebas, la capacidad de refactorizar código legado y la pedagogía técnica con la que revisa el trabajo de sus pares.
3. **Planes de capacitación genéricos:** Los programas de formación corporativa suelen ser homogéneos, poco accionables y desalineados con los puntos de dolor reales de los equipos.

### La Propuesta de Valor
**TechProfiler** transforma el ciclo de evaluación y desarrollo de talento en un sistema vivo, objetivo y continuo:
* **Diagnóstico Multidimensional:** Ingesta señales no intrusivas de la actividad real en GitHub (calidad de PRs, rigor en code reviews, diseño modular) y las combina con retos técnicos prácticos interactivos (simuladores de revisión de código con bugs intencionales, laboratorios de refactorización y entrevistas socráticas de diseño de sistemas).
* **Matriz de Competencias Viva (Tech Radar):** Mapea las habilidades del desarrollador en un vector continuo contra benchmarks de roles objetivo (Junior, Mid, Senior, Tech Lead), aplicando decaimiento temporal para priorizar la evidencia reciente.
* **L&D Just-in-Time Agéntico:** Ante la detección de una brecha crítica, el sistema no asigna un curso estático de horas; orquesta agentes de IA que generan micro-módulos interactivos a la medida, acompañados de laboratorios prácticos en vivo dentro de la propia plataforma para cerrar la brecha de inmediato.

---

## 2. Arquitectura del Sistema

El flujo de procesamiento opera de manera desacoplada y orientada a eventos mediante una arquitectura de micro-servicios modularizada en un monorepo:

```text
       ┌────────────────────────────────────────────────────────┐
       │                 Fuentes de Señales SDLC                │
       │  - GitHub Webhooks (Merged PRs, Code Reviews, Commits) │
       │  - Interactive Challenge Runner (Labs, Bugfix, Design) │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             Capa de Ingesta & Sanitización             │
       │   - SecretSanitizer: Redacción de API Keys, PII, URLs  │
       │   - Extractor AST: Métricas de complejidad y testing   │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                 Colas Asíncronas (BullMQ)              │
       │     [IngestQueue] ──> [AgentEvalQueue] ──> [DB Persist]│
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │              Cluster de Agentes de Evaluación          │
       │   - CodeQualityProfilerAgent (SOLID, Clean Arch, Tests)│
       │   - ReviewerDynamicsAgent (Rigor y empatía en reviews) │
       │   - InteractiveChallengeAgent (Corrección y casos borde)
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │         Motor de Síntesis y Matriz de Habilidades      │
       │  - Ponderación Temporal Exponencial (w = e^-λΔt)       │
       │  - Cálculo de Brechas Semánticas en pgvector (HNSW)    │
       └───────────────────────────┬────────────────────────────┘
                                   │
                      ¿Existe brecha vs Target?
                      ├── NO ──> [Actualizar Radar en Web]
                      └── SÍ ──> [CurriculumBuilderAgent]
                                        │
                                        ▼
                               [Generar Módulo L&D + Lab]
                                        │
                                        ▼
                               [Consumo en Dashboard Web]
```

---

## 3. Stack Tecnológico

El proyecto está construido íntegramente sobre un stack moderno en **TypeScript / Node.js**, priorizando tipado estricto de extremo a extremo, rendimiento y aislamiento multitenant:

| Capa / Componente | Tecnología | Justificación Técnica |
| :--- | :--- | :--- |
| **Monorepo Manager** | [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) | Cache de compilación remota, orquestación eficiente de scripts y resolución estricta de dependencias compartidas. |
| **Frontend & Dashboard** | [Next.js](https://nextjs.org/) 15 (App Router) + [TailwindCSS](https://tailwindcss.com/) | Renderizado híbrido (RSC), experiencia de usuario fluida y diseño adaptable con componentes accesibles. |
| **Editor de Código en Web** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Mismo motor que VS Code, permitiendo a los ingenieros resolver retos de refactor y simular revisiones de código en el navegador. |
| **API Gateway & Workers** | [NestJS](https://nestjs.com/) + [tRPC](https://trpc.io/) | Arquitectura modular enterprise, inyección de dependencias, tipado seguro de extremo a extremo entre cliente y servidor. |
| **Colas Asíncronas** | [BullMQ](https://bullmq.io/) + [Redis](https://redis.io/) 7 | Desacoplamiento de llamadas pesadas a LLMs, procesamiento distribuido con reintentos automáticos y rate limiting. |
| **Base de Datos Principal** | [PostgreSQL](https://www.postgresql.org/) 16 + [pgvector](https://github.com/pgvector/pgvector) | Almacenamiento relacional transaccional (ACID) y búsqueda semántica de habilidades mediante embeddings vectoriales con índices HNSW. |
| **ORM & Migraciones** | [Drizzle ORM](https://orm.drizzle.team/) | Consultas TypeScript-first ligeras, sin sobrecarga de runtime y soporte nativo para tipos vectoriales de `pgvector`. |
| **Motor Agéntico e IA** | [Vercel AI SDK](https://sdk.vercel.ai/) / Google GenAI (Gemini) | Flujos agénticos basados en generación estructurada (`generateObject`) garantizada mediante esquemas Zod. |
| **Sanitización & Seguridad** | Regex + AST Parsers (`tree-sitter` / `@babel/parser`) | Eliminación determinista de credenciales, variables `.env` y secretos antes de enviar cualquier código a un LLM. |
| **Testing & Calidad** | [Vitest](https://vitest.dev/) + ESLint + Prettier | Ejecución ultrarrápida de pruebas unitarias y de integración con soporte nativo de TypeScript y ESM. |

---

## 4. Estructura del Repositorio

```text
perfiladorV2/
├── .github/                              # Gobernanza, CI/CD y Calidad de Código
│   ├── workflows/
│   │   ├── ci.yml                        # Pipeline automatizado (Lint, Typecheck, Tests, Build)
│   │   └── security.yml                  # Escaneo continuo de secretos (Gitleaks)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md                 # Plantilla estandarizada de reporte de bugs
│   │   └── feature_request.md            # Plantilla para nuevas funcionalidades
│   └── PULL_REQUEST_TEMPLATE.md          # Checklist de verificación previa al merge
├── apps/                                 # Aplicaciones ejecutables
│   ├── web/                              # Portal Web Next.js (Dashboard de Talento, Radar UI, Editor)
│   ├── api/                              # Backend NestJS (API Gateway, GitHub Webhooks, BullMQ Workers)
│   └── agents/                           # Core agéntico (Evaluadores de código, Síntesis, Generador L&D)
├── packages/                             # Librerías y paquetes compartidos
│   ├── database/                         # Esquema Drizzle, DDL PostgreSQL 16 + pgvector, Seeds
│   ├── schemas/                          # Contratos Zod compartidos (Eventos, Evaluaciones, Cursos)
│   ├── sanitizer/                        # Módulo SecretSanitizer (Regex + AST de código)
│   └── config/                           # Configuraciones compartidas de TypeScript y ESLint
├── docker/
│   └── postgres/init.sql                 # Script con extensiones uuid-ossp y vector
├── docker-compose.yml                    # Entorno local contenerizado (PostgreSQL + Redis)
├── pnpm-workspace.yaml                   # Definición de paquetes y apps del workspace
├── turbo.json                            # Configuración de pipeline de Turborepo
├── .gitignore                            # Exclusión de archivos transitorios y dependencias
├── .env.example                          # Plantilla de variables de entorno
├── ROADMAP.md                            # Registro dinámico de progreso por hitos
└── README.md                             # Documentación general del proyecto
```

---

## 5. Guía de Inicio Rápido (Entorno Local)

### Prerrequisitos
* **Node.js** >= 20.0.0
* **pnpm** >= 9.0.0 (`npm install -g pnpm`)
* **Docker** y **Docker Compose**

### 1. Clonar el Repositorio e Instalar Dependencias
```bash
git clone https://github.com/AlejoRoldan/perfiladorV2.git
cd perfiladorV2
pnpm install
```

### 2. Configurar Variables de Entorno
Copia la plantilla de entorno y ajusta las claves necesarias:
```bash
cp .env.example .env
```

### 3. Levantar los Servicios de Infraestructura (PostgreSQL + Redis)
Inicia los contenedores de base de datos con la extensión `pgvector` y el servidor Redis:
```bash
docker compose up -d
```
Verifica que PostgreSQL esté respondiendo en el puerto `5432` y Redis en el `6379`.

### 4. Ejecutar Migraciones y Poblar la Taxonomía Base
```bash
# Generar y aplicar migraciones DDL con Drizzle
pnpm --filter @perfilador/database db:migrate

# Ejecutar el seed con las 15 habilidades clave y benchmarks iniciales
pnpm --filter @perfilador/database db:seed
```

### 5. Iniciar el Entorno de Desarrollo
```bash
pnpm dev
```
Turborepo iniciará en paralelo:
* Portal Web (`apps/web`): `http://localhost:3000`
* API Gateway (`apps/api`): `http://localhost:4000`

---

## 6. Comandos de Calidad y Pruebas

El proyecto implementa un estándar de calidad estricto para desarrolladores humanos y agentes de código:

```bash
# Validar tipado estricto en todos los paquetes y apps
pnpm typecheck

# Ejecutar linter
pnpm lint

# Ejecutar la suite completa de pruebas unitarias con Vitest
pnpm test

# Compilar todos los paquetes y aplicaciones
pnpm build
```

---

## 7. Gobernanza y Multitenancy

El sistema está diseñado para operar en holdings empresariales multisectoriales (como el Grupo Vázquez en Paraguay), garantizando:
* **Aislamiento por Organización (`org_id`):** Cada consulta, evento y métrica se encuentra aislada a nivel de tenant (*ueno bank*, *itti*, *kaitel*).
* **Protección de Propiedad Intelectual:** Ningún fragmento de código fuente propietario es enviado a modelos externos sin haber sido previamente anonimizado y limpiado por el `SecretSanitizer`.
* **Trazabilidad para Auditoría:** Todos los cambios en la matriz de habilidades conservan un registro inmutable en `evaluation_signals` para revisiones de promoción o auditoría de cumplimiento normativo.
