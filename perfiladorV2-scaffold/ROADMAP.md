# Roadmap de Implementación - TechProfiler & L&D Platform

## Prioridad actual: MVP del piloto

El alcance funcional del 20 de octubre de 2026 está en [MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md). Sus criterios prevalecen para el piloto sobre las fases de plataforma siguientes. Las casillas de esta sección indican aceptación completa, no solo existencia de código.

- [ ] **Entrega 1 — Acceso y continuidad:** validar magic links/roles/aislamiento ya implementados localmente; completar estados, recuperación desde servidor, reapertura por facilitador y consentimiento.
- [ ] **Entrega 2 — Evaluación defendible:** banco de casos por track, 20–30 transcripts revisados, citas verificadas, confianza y siguiente paso por habilidad; sanitización completa y presupuesto persistente por sesión.
- [ ] **Entrega 3 — Aprendizaje:** generar/asignar automáticamente módulos por brechas críticas y permitir responder un reto breve, evaluarlo y registrar evidencia con recuperación e idempotencia.
- [ ] **Entrega 4 — Operación y medición:** avance por persona, acciones de recuperación, resumen ejecutivo, pregunta de utilidad y métricas con denominadores explícitos.
- [ ] **Aceptación de staging:** recorrido completo con correo/proveedor reales autorizados, PostgreSQL, navegador, recuperación ante fallos y revisión técnica de puntajes.

Transversal: corregir CI/comandos de calidad e integridad de datos. No hace falta migrar a Nest/Next ni implementar Monaco para entregar este MVP.

## Evolución de plataforma

Esta lista histórica describe la arquitectura objetivo y requiere reconciliación por componente. Ya existen schema SQL, contratos compartidos, sanitizer y los cuatro agentes; sus casillas históricas no deben interpretarse como ausencia de implementación ni como aceptación del piloto.

- [ ] **Fase 1: Infraestructura y Datos Fundacionales**
  - [ ] Validar inicialización de PostgreSQL 16 con `pgvector` y Redis
  - [ ] Implementar esquema DDL en `packages/database` con Drizzle ORM
  - [ ] Configurar seed inicial con taxonomía de 15 habilidades clave
  - [ ] Implementar `packages/schemas` con contratos Zod de evaluación y módulos L&D
- [ ] **Fase 2: Motor de Ingesta y Sanitización**
  - [ ] Implementar `SecretSanitizer` en `packages/sanitizer` (detección de tokens, llaves y URLs)
  - [ ] Suite de pruebas unitarias exhaustiva para `SecretSanitizer`
  - [ ] Webhook controller en `apps/api` para eventos de Pull Request y Review de GitHub
- [ ] **Fase 3: Runtime de Agentes de Evaluación**
  - [ ] Implementar `CodeQualityProfilerAgent` con Vercel AI SDK / Gemini y Zod
  - [ ] Implementar `ReviewerDynamicsAgent` para calificar feedback en PRs
  - [ ] Implementar `SkillSynthesizerAgent` con decaimiento temporal exponencial
  - [ ] Implementar `CurriculumBuilderAgent` para generar especificaciones de cursos y labs
  - [ ] Fixtures y tests deterministas con mocks
- [ ] **Fase 4: Orquestación Asíncrona (Colas y Workers)**
  - [ ] Configuración de colas BullMQ (`IngestQueue`, `AgentEvalQueue`, `CourseGenQueue`)
  - [ ] Procesadores de colas con reintentos y actualización de `developer_skill_matrix`
  - [ ] Endpoints tRPC / REST para consultar el radar de habilidades
- [ ] **Fase 5: Interfaz Web y Runner de Retos**
  - [ ] Dashboard de Radar de Competencias y desglose de evidencias en `apps/web`
  - [ ] Integración de Monaco Editor para el PR Review Simulator y Refactor Labs
  - [ ] Visor de Módulos L&D con evaluación interactiva
