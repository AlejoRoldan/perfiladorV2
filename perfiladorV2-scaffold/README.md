# TechProfiler & L&D Platform (`perfiladorV2`)

## Documentation

Reviewer-facing documentation starts in [`docs/README.md`](./docs/README.md).

It covers architecture, backend/frontend structure, the agent catalog, product scope, delivery roadmap, engineering standards, and pilot operations.

> **Plataforma agÃ©ntica de perfilamiento continuo de capacidades tÃ©cnicas a lo largo del SDLC y generaciÃ³n personalizada de rutas de aprendizaje y laboratorios para ingenieros de software.**

---

## 1. VisiÃ³n del Proyecto

En las organizaciones de ingenierÃ­a de software de alto crecimiento, la evaluaciÃ³n del talento tÃ©cnico suele sufrir de tres problemas crÃ­ticos:
1. **Evaluaciones teÃ³ricas desconectadas de la realidad:** Pruebas estÃ¡ticas de opciÃ³n mÃºltiple o algoritmos descontextualizados que no reflejan la calidad real del trabajo en producciÃ³n.
2. **Falta de visibilidad sobre el SDLC diario:** La verdadera destreza de un ingeniero se demuestra en la arquitectura de sus Pull Requests, la solidez de sus pruebas, la capacidad de refactorizar cÃ³digo legado y la pedagogÃ­a tÃ©cnica con la que revisa el trabajo de sus pares.
3. **Planes de capacitaciÃ³n genÃ©ricos:** Los programas de formaciÃ³n corporativa suelen ser homogÃ©neos, poco accionables y desalineados con los puntos de dolor reales de los equipos.

### La Propuesta de Valor
**TechProfiler** transforma el ciclo de evaluaciÃ³n y desarrollo de talento en un sistema vivo, objetivo y continuo:
* **DiagnÃ³stico Multidimensional:** Ingesta seÃ±ales no intrusivas de la actividad real en GitHub (calidad de PRs, rigor en code reviews, diseÃ±o modular) y las combina con retos tÃ©cnicos prÃ¡cticos interactivos (simuladores de revisiÃ³n de cÃ³digo con bugs intencionales, laboratorios de refactorizaciÃ³n y entrevistas socrÃ¡ticas de diseÃ±o de sistemas).
* **Matriz de Competencias Viva (Tech Radar):** Mapea las habilidades del desarrollador en un vector continuo contra benchmarks de roles objetivo (Junior, Mid, Senior, Tech Lead), aplicando decaimiento temporal para priorizar la evidencia reciente.
* **L&D Just-in-Time AgÃ©ntico:** Ante la detecciÃ³n de una brecha crÃ­tica, el sistema no asigna un curso estÃ¡tico de horas; orquesta agentes de IA que generan micro-mÃ³dulos interactivos a la medida, acompaÃ±ados de laboratorios prÃ¡cticos en vivo dentro de la propia plataforma para cerrar la brecha de inmediato.

---

## 2. Arquitectura del Sistema

El flujo de procesamiento opera de manera desacoplada y orientada a eventos mediante una arquitectura de micro-servicios modularizada en un monorepo:

```text
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚                 Fuentes de SeÃ±ales SDLC                â”‚
       â”‚  - GitHub Webhooks (Merged PRs, Code Reviews, Commits) â”‚
       â”‚  - Interactive Challenge Runner (Labs, Bugfix, Design) â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                                   â–¼
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚             Capa de Ingesta & SanitizaciÃ³n             â”‚
       â”‚   - SecretSanitizer: RedacciÃ³n de API Keys, PII, URLs  â”‚
       â”‚   - Extractor AST: MÃ©tricas de complejidad y testing   â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                                   â–¼
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚                 Colas AsÃ­ncronas (BullMQ)              â”‚
       â”‚     [IngestQueue] â”€â”€> [AgentEvalQueue] â”€â”€> [DB Persist]â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                                   â–¼
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚              Cluster de Agentes de EvaluaciÃ³n          â”‚
       â”‚   - CodeQualityProfilerAgent (SOLID, Clean Arch, Tests)â”‚
       â”‚   - ReviewerDynamicsAgent (Rigor y empatÃ­a en reviews) â”‚
       â”‚   - InteractiveChallengeAgent (CorrecciÃ³n y casos borde)
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                                   â–¼
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚         Motor de SÃ­ntesis y Matriz de Habilidades      â”‚
       â”‚  - PonderaciÃ³n Temporal Exponencial (w = e^-Î»Î”t)       â”‚
       â”‚  - CÃ¡lculo de Brechas SemÃ¡nticas en pgvector (HNSW)    â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                      Â¿Existe brecha vs Target?
                      â”œâ”€â”€ NO â”€â”€> [Actualizar Radar en Web]
                      â””â”€â”€ SÃ â”€â”€> [CurriculumBuilderAgent]
                                        â”‚
                                        â–¼
                               [Generar MÃ³dulo L&D + Lab]
                                        â”‚
                                        â–¼
                               [Consumo en Dashboard Web]
```

---

## 3. Stack TecnolÃ³gico

El proyecto estÃ¡ construido Ã­ntegramente sobre un stack moderno en **TypeScript / Node.js**, priorizando tipado estricto de extremo a extremo, rendimiento y aislamiento multitenant:

| Capa / Componente | TecnologÃ­a | JustificaciÃ³n TÃ©cnica |
| :--- | :--- | :--- |
| **Monorepo Manager** | [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) | Cache de compilaciÃ³n remota, orquestaciÃ³n eficiente de scripts y resoluciÃ³n estricta de dependencias compartidas. |
| **Frontend & Dashboard** | [Next.js](https://nextjs.org/) 15 (App Router) + [TailwindCSS](https://tailwindcss.com/) | Renderizado hÃ­brido (RSC), experiencia de usuario fluida y diseÃ±o adaptable con componentes accesibles. |
| **Editor de CÃ³digo en Web** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Mismo motor que VS Code, permitiendo a los ingenieros resolver retos de refactor y simular revisiones de cÃ³digo en el navegador. |
| **API Gateway & Workers** | [NestJS](https://nestjs.com/) + [tRPC](https://trpc.io/) | Arquitectura modular enterprise, inyecciÃ³n de dependencias, tipado seguro de extremo a extremo entre cliente y servidor. |
| **Colas AsÃ­ncronas** | [BullMQ](https://bullmq.io/) + [Redis](https://redis.io/) 7 | Desacoplamiento de llamadas pesadas a LLMs, procesamiento distribuido con reintentos automÃ¡ticos y rate limiting. |
| **Base de Datos Principal** | [PostgreSQL](https://www.postgresql.org/) 16 + [pgvector](https://github.com/pgvector/pgvector) | Almacenamiento relacional transaccional (ACID) y bÃºsqueda semÃ¡ntica de habilidades mediante embeddings vectoriales con Ã­ndices HNSW. |
| **ORM & Migraciones** | [Drizzle ORM](https://orm.drizzle.team/) | Consultas TypeScript-first ligeras, sin sobrecarga de runtime y soporte nativo para tipos vectoriales de `pgvector`. |
| **Motor AgÃ©ntico e IA** | [Vercel AI SDK](https://sdk.vercel.ai/) / Google GenAI (Gemini) | Flujos agÃ©nticos basados en generaciÃ³n estructurada (`generateObject`) garantizada mediante esquemas Zod. |
| **SanitizaciÃ³n & Seguridad** | Regex + AST Parsers (`tree-sitter` / `@babel/parser`) | EliminaciÃ³n determinista de credenciales, variables `.env` y secretos antes de enviar cualquier cÃ³digo a un LLM. |
| **Testing & Calidad** | [Vitest](https://vitest.dev/) + ESLint + Prettier | EjecuciÃ³n ultrarrÃ¡pida de pruebas unitarias y de integraciÃ³n con soporte nativo de TypeScript y ESM. |

---

## 4. Estructura del Repositorio

```text
perfiladorV2/
â”œâ”€â”€ .github/                              # Gobernanza, CI/CD y Calidad de CÃ³digo
â”‚   â”œâ”€â”€ workflows/
â”‚   â”‚   â”œâ”€â”€ ci.yml                        # Pipeline automatizado (Lint, Typecheck, Tests, Build)
â”‚   â”‚   â””â”€â”€ security.yml                  # Escaneo continuo de secretos (Gitleaks)
â”‚   â”œâ”€â”€ ISSUE_TEMPLATE/
â”‚   â”‚   â”œâ”€â”€ bug_report.md                 # Plantilla estandarizada de reporte de bugs
â”‚   â”‚   â””â”€â”€ feature_request.md            # Plantilla para nuevas funcionalidades
â”‚   â””â”€â”€ PULL_REQUEST_TEMPLATE.md          # Checklist de verificaciÃ³n previa al merge
â”œâ”€â”€ apps/                                 # Aplicaciones ejecutables
â”‚   â”œâ”€â”€ web/                              # Portal Web Next.js (Dashboard de Talento, Radar UI, Editor)
â”‚   â”œâ”€â”€ api/                              # Backend NestJS (API Gateway, GitHub Webhooks, BullMQ Workers)
â”‚   â””â”€â”€ agents/                           # Core agÃ©ntico (Evaluadores de cÃ³digo, SÃ­ntesis, Generador L&D)
â”œâ”€â”€ packages/                             # LibrerÃ­as y paquetes compartidos
â”‚   â”œâ”€â”€ database/                         # Esquema Drizzle, DDL PostgreSQL 16 + pgvector, Seeds
â”‚   â”œâ”€â”€ schemas/                          # Contratos Zod compartidos (Eventos, Evaluaciones, Cursos)
â”‚   â”œâ”€â”€ sanitizer/                        # MÃ³dulo SecretSanitizer (Regex + AST de cÃ³digo)
â”‚   â””â”€â”€ config/                           # Configuraciones compartidas de TypeScript y ESLint
â”œâ”€â”€ docker/
â”‚   â””â”€â”€ postgres/init.sql                 # Script con extensiones uuid-ossp y vector
â”œâ”€â”€ docker-compose.yml                    # Entorno local contenerizado (PostgreSQL + Redis)
â”œâ”€â”€ pnpm-workspace.yaml                   # DefiniciÃ³n de paquetes y apps del workspace
â”œâ”€â”€ turbo.json                            # ConfiguraciÃ³n de pipeline de Turborepo
â”œâ”€â”€ .gitignore                            # ExclusiÃ³n de archivos transitorios y dependencias
â”œâ”€â”€ .env.example                          # Plantilla de variables de entorno
â”œâ”€â”€ ROADMAP.md                            # Registro dinÃ¡mico de progreso por hitos
â””â”€â”€ README.md                             # DocumentaciÃ³n general del proyecto
```

---

## 5. GuÃ­a de Inicio RÃ¡pido (Entorno Local)

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
Inicia los contenedores de base de datos con la extensiÃ³n `pgvector` y el servidor Redis:
```bash
docker compose up -d
```
Verifica que PostgreSQL estÃ© respondiendo en el puerto `5432` y Redis en el `6379`.

### 4. Ejecutar Migraciones y Poblar la Taxonomia Base
```bash
# Aplicar schema SQL versionado
pnpm db:migrate

# Cargar organizaciones, rubricas y benchmarks base
pnpm db:seed

# O ejecutar ambos pasos
pnpm db:setup
```

### 5. Iniciar el Entorno de Desarrollo
```bash
pnpm dev
```
Turborepo iniciara en paralelo cuando las apps scaffold esten implementadas:
* Portal Web (`apps/web`): `http://localhost:3000`
* API Gateway (`apps/api`): `http://localhost:4000`

El MVP actual tambien puede ejecutarse directamente con:

```bash
node dashboard.mjs
```

Dashboard MVP: `http://localhost:3005`

---
## 6. Comandos de Calidad y Pruebas

El proyecto implementa un estÃ¡ndar de calidad estricto para desarrolladores humanos y agentes de cÃ³digo:

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

El sistema estÃ¡ diseÃ±ado para operar en holdings empresariales multisectoriales (como el Grupo VÃ¡zquez en Paraguay), garantizando:
* **Aislamiento por OrganizaciÃ³n (`org_id`):** Cada consulta, evento y mÃ©trica se encuentra aislada a nivel de tenant (*ueno bank*, *itti*, *kaitel*).
* **ProtecciÃ³n de Propiedad Intelectual:** NingÃºn fragmento de cÃ³digo fuente propietario es enviado a modelos externos sin haber sido previamente anonimizado y limpiado por el `SecretSanitizer`.
* **Trazabilidad para AuditorÃ­a:** Todos los cambios en la matriz de habilidades conservan un registro inmutable en `evaluation_signals` para revisiones de promociÃ³n o auditorÃ­a de cumplimiento normativo.
