# MVP del piloto: alcance y criterios de aceptación

Fecha: 20 de octubre de 2026. Alcance funcional propuesto por el usuario para el piloto de 20 participantes. Este documento define trabajo y aceptación; no acredita funcionalidades desplegadas ni historias terminadas.

El recorrido que debe funcionar es: invitación individual → consentimiento → entrevista comparable y recuperable → radar explicado → módulo automático por brecha crítica → reto corto evaluado → retroalimentación. El facilitador supervisa y actúa sobre su organización.

## 1. Estado contrastado con el árbol local

Este estado es una fotografía del workspace revisado el 20 de octubre, incluyendo cambios sin commit. El PR de alcance contiene solo documentación: no incorpora `pilot-service.mjs`, la migración de sesiones ni las guías locales del piloto. En `main` continúa la barrera Basic Auth hasta integrar la implementación individual en un PR separado. Los nombres de archivos locales de la tabla no son rutas disponibles en este PR.

| Punto | Implementación local existente | Pendiente para aceptar el MVP |
| --- | --- | --- |
| Acceso por participante | Supabase magic links, membresías explícitas, sesiones revocables y consultas por participante/rol/organización en `pilot-service.mjs` y `dashboard.mjs`. | Integrar los cambios locales y verificar PostgreSQL, proveedor, correo, callback y aislamiento en navegador. |
| Sesiones confiables | Historial persistente, reanudación por ID, reintentos de turnos, finalización transaccional e idempotente; estados `ACTIVE` y `COMPLETED`. | Estado fallido persistente, descubrimiento de la sesión desde servidor al volver a entrar y reapertura auditada por facilitador. |
| Aprendizaje automático | `CurriculumBuilderAgent`, tablas de módulos y visor. Scripts independientes generan y resuelven ejemplos. | Conectar la entrevista con asignación automática recuperable y agregar entrega/evaluación del reto desde el portal. |
| Radar explicable | Puntaje, benchmark y brecha; resultado con feedback y auditoría en señales. | Mostrar justificación, citas verificadas, confianza y siguiente paso por habilidad. Distinguir ausencia de evidencia de puntaje bajo. |
| Calidad de evaluación | Taxonomía, rúbricas y contratos; pruebas de texto de prompts. | Banco común por track y 20–30 transcripts con rangos esperados, revisión humana y ejecución de regresión. |
| Facilitador con acción | Selector de perfiles, agregados básicos, importación y CSV por organización. | Avance individual, recuperación de fallos y resumen ejecutivo con denominadores correctos. |
| Confianza y privacidad | Sesiones y autorización; sanitización parcial y timeout/reintentos del modelo. | Consentimiento registrado, sanitización compartida completa y presupuesto persistente por sesión. |
| Retroalimentación | No se identificó captura de utilidad en el flujo. | Pregunta al finalizar, persistencia y métricas de utilidad y participación. |

La descripción de contraseña compartida y selección pública de perfil corresponde a una etapa anterior. Los cambios de acceso individual aún son locales: su existencia no equivale a aceptación en staging. El facilitador ve su cohorte autorizada, nunca otras organizaciones.

## 2. Criterios de aceptación por funcionalidad

### MVP-01 — Acceso individual

- Solo identidades invitadas pueden entrar mediante un enlace personal de un solo uso verificado por el proveedor. Solicitar un enlace no inicia sesión.
- Un participante ve y opera únicamente su radar, módulos y entrevista. Alterar IDs, URLs o payloads no permite acceder a otra persona u organización.
- El facilitador ve a las personas de su organización. Organización y rol se resuelven en servidor.
- Historial y propietario de cada entrevista residen en servidor; el navegador entrega la siguiente respuesta y los identificadores de control.
- Enlace consumido/vencido, revocación, expiración y logout deniegan acceso. Probar dos participantes y dos organizaciones, además del correo real autorizado en staging.

Base: HU-AUTH-001, HU-REG-001 y HU-POS-001. Conservar lo implementado y cerrar su validación.

### MVP-02 — Sesiones recuperables

- Mostrar «No iniciada», «En progreso», «Completada» y «Fallida». «No iniciada» puede derivarse de no existir intento; no implica crear una fila vacía.
- Al volver a entrar, el servidor encuentra la entrevista recuperable sin depender de `sessionStorage`. La recarga, el cierre del navegador o un fallo del modelo conservan los turnos confirmados.
- Un fallo muestra una causa operativa segura y una acción de recuperación. No incorpora turnos inventados ni modifica el radar previo.
- El facilitador puede reabrir/reintentar una entrevista de su organización. Registrar actor, motivo, fecha y relación con el intento original.
- Reabrir un intento completado conserva su evidencia y crea un nuevo intento relacionado; no borra ni vuelve a contabilizar el original.
- Dos finalizaciones simultáneas o un reintento tras perder la respuesta producen una única señal por intento y una actualización atómica del radar.
- Probar fallo del proveedor, fallo de persistencia, reanudación desde otra sesión de navegador, revocación y concurrencia con PostgreSQL desechable.

Base: ampliar HU-POS-001 y trabajo operativo QA-09.

### MVP-03 — Cierre automático de brechas

- Versionar una regla determinista de «brecha crítica» basada en puntaje y benchmark. El umbral debe quedar explícito y revisado antes del piloto.
- Una entrevista completada asigna automáticamente un módulo por cada brecha crítica identificada. Nunca asignar por una habilidad sin evidencia.
- La asignación tiene una clave estable por evidencia/habilidad para evitar duplicados en reintentos. Registrar generación pendiente, completada o fallida y permitir recuperación.
- El fallo de generación de un módulo conserva la entrevista y su radar ya confirmados. Un trabajo persistente recupera la generación pendiente después de reiniciar el proceso.
- El módulo ofrece explicación, caso breve, criterios de evaluación y campo de respuesta textual. El participante envía su respuesta; completar depende de una evaluación válida y feedback, no de un botón que omita el reto.
- Aprobar el reto marca el módulo como completado y registra una nueva evidencia de manera atómica e idempotente. Una respuesta insuficiente permite volver a intentarlo sin perder el módulo.
- El fallo del evaluador conserva la respuesta recuperable y no completa el módulo ni cambia puntajes.

Nueva historia funcional: conexión PoS → CurriculumBuilder → módulo → entrega → evidencia. Reutilizar el agente existente y contratos compartidos. Un campo de texto basta para el MVP.

### MVP-04 — Radar explicable

- Cada habilidad evaluada muestra puntaje, nivel requerido, brecha, justificación, confianza y siguiente paso.
- La justificación incluye referencias a turnos y citas que el servidor comprueba contra la conversación persistida. Rechazar o regenerar citas inventadas; no presentarlas como evidencia válida.
- Las citas visibles pasan por sanitización. El facilitador accede solo a evidencia de su organización.
- La confianza describe suficiencia de evidencia y sus límites; no se presenta como probabilidad calibrada de competencia.
- Mostrar «Sin evidencia suficiente» cuando corresponda, en lugar de convertir el valor inicial de matriz en una evaluación negativa.
- Cada resultado conserva referencia de evidencia, fecha, modelo, versión del caso/prompt/rúbrica y regla de consolidación de puntajes.
- El siguiente paso conduce a un módulo asignado, a práctica recomendada o a recopilar más evidencia. El lenguaje describe desarrollo, no aprobado/reprobado global.

Base: HU-SCORE-001 y ampliación del contrato y presentación de resultados.

### MVP-05 — Calidad defendible

- Banco versionado para `BACKEND_NODE`, `FRONTEND_REACT` y `FULLSTACK`, con cobertura de habilidades, dificultad y criterios de puntuación explícitos.
- Las personas del mismo track y nivel objetivo reciben un núcleo común o casos equivalentes revisados. Los seguimientos no sustituyen la cobertura mínima común.
- Preparar 20–30 transcripts de referencia distribuidos entre tracks y niveles de respuesta, incluidos casos incompletos o ambiguos. No usar datos personales reales sin autorización y anonimización.
- Cada referencia incluye caso/track/nivel, puntajes o intervalos esperados por habilidad, citas de respaldo y explicación de esos intervalos.
- Las referencias sintéticas son un punto de partida; un referente técnico revisa los rangos antes de utilizarlos para defender resultados. Registrar revisión y desacuerdos.
- Un runner evalúa cambios de prompt/modelo/rúbrica contra las referencias y reporta desviaciones por habilidad. Una prueba con proveedor mock valida el flujo, pero no calibra la calidad del modelo.
- Ejecutar una corrida controlada con el proveedor real y revisar las desviaciones antes del piloto. Registrar versión, costo y resultados sin afirmar calibración por tests de texto.

Nueva historia de banco, referencias y evaluación de regresión; complementa HU-SCH-001 y HU-QA-001.

### MVP-06 — Facilitador con acción

- Mostrar por persona: estado del intento, última actividad, finalización, fallos recuperables y módulos asignados/completados.
- Mostrar la acción de reapertura/reintento autorizada por MVP-02 y su resultado, también cuando el navegador pierde la respuesta.
- El resumen ejecutivo incluye personas invitadas/completadas, tasa de completitud, incidencia de fallos, brechas críticas más frecuentes, módulos recomendados/asignados/completados y utilidad reportada.
- Contar personas únicas para la meta de completitud; separar cantidad de intentos. Una persona con tres entrevistas completadas cuenta una vez.
- Mostrar números absolutos y denominadores junto a porcentajes. Una persona sin evaluación no cuenta como brecha observada.
- El CSV concuerda con el resumen y conserva negativos numéricos sin convertirlos en texto. El acceso permanece limitado a la organización del facilitador.

Base: HU-REP-001, HU-REG-001 y recuperación operativa.

### MVP-07 — Consentimiento, privacidad y costo

- Antes del primer turno, explicar qué se evalúa, qué datos se envían al proveedor, quién ve los resultados y el propósito de desarrollo. Indicar expresamente que no se utiliza para decisiones de promoción ni salario.
- Registrar aceptación explícita, fecha y versión del aviso vinculadas al participante/intento. Definir retención y un canal de contacto antes de publicar el aviso. Rechazar el inicio sin aceptación.
- Todos los campos del prompt final pasan por la frontera de sanitización compartida, incluidos instrucciones, respuestas y citas. Cubrir las regresiones descritas en HU-SAN-001.
- Configurar un límite monetario por sesión y un límite de tokens por llamada. Versionar precios/configuración del modelo en el cálculo; no inventar tarifas ni asumir que un límite de turnos es un límite de costo.
- Reservar presupuesto de forma persistente y atómica antes de cada llamada; incluir reintentos, certificación, generación y evaluación de módulos en un presupuesto definido. Un rollback funcional no devuelve automáticamente el gasto externo.
- Bloquear nuevas llamadas cuando no alcance el presupuesto. La reapertura no reinicia el gasto del mismo intento. Definir explícitamente el presupuesto de un nuevo intento.
- Mostrar un mensaje claro ante timeout, indisponibilidad o presupuesto agotado, con una acción útil y conservación del progreso confirmado.

Base: HU-SAN-001 y tareas explícitas de QA-09. La aceptación de presupuesto requiere probar intentos concurrentes y fallos después de llamar al proveedor.

### MVP-08 — Retroalimentación

- Al terminar, preguntar: «¿Te resultó útil esta evaluación para identificar qué mejorar?» Respuestas: «Sí», «En parte», «No»; comentario opcional.
- La respuesta puede omitirse y no bloquea el radar ni los módulos. Se asocia a la identidad verificada y a una evaluación completada, sin duplicados por reintento.
- Reportar personas únicas que respondieron, «Sí», «En parte», «No» y sin respuesta. Usar la respuesta más reciente de cada persona en el corte del piloto y conservar su referencia.
- Mostrar utilidad entre quienes respondieron y cobertura de respuesta. No equiparar automáticamente «En parte» con «Sí» ni ocultar personas que no respondieron.
- Para acreditar literalmente que el 80% de los 20 participantes la considera útil, exigir al menos 16 personas con «Sí». La tasa entre encuestados se reporta además, con su denominador.

Nueva historia funcional de feedback y extensión del reporte del piloto.

## 3. Orden de entrega

1. **Acceso y recuperación:** integrar/validar MVP-01; completar MVP-02 y consentimiento de MVP-07. Mantener tests de aislamiento y PostgreSQL como puerta de salida.
2. **Evaluación explicable y comparable:** desarrollar MVP-05 y MVP-04 juntos; cerrar sanitización y presupuesto antes de las corridas reales del modelo.
3. **Aprendizaje:** conectar MVP-03 con evidencia y generación recuperable; probar el circuito completo hasta la entrega del reto.
4. **Operación y medición:** completar MVP-06 y MVP-08. Su modelo de eventos y denominadores debe definirse desde la primera entrega.
5. **Aceptación supervisada:** comprobar invitación → consentimiento → entrevista → recuperación → radar → módulo → reto → feedback → resumen, incluyendo fallos y otras identidades/organizaciones.

Transversal: HU-QA-001 para CI en la raíz Git, comandos reproducibles, tipos reales y pruebas significativas. HU-TAX-001/HU-DB-001 para integridad y conexión/migraciones. Evitar mezclar estas correcciones con una migración completa de framework.

## 4. Puerta de salida y medición

- Antes de invitar a la cohorte: ocho capacidades aceptadas en staging, pruebas críticas aprobadas y configuración de identidad/correo/base/modelo comprobada. Nombrar facilitador, soporte y responsable de revisión técnica.
- Durante la semana del piloto: 20 personas invitadas y al menos 16 personas con una entrevista completada; conservar intentos repetidos sin inflar el numerador.
- Reportar intentos fallidos por causa técnica / intentos iniciados, y personas afectadas. Mantener el objetivo del plan de menos de 10% de intentos fallidos; mostrar también recuperados y fallos todavía abiertos.
- Reportar utilidad y cobertura según MVP-08. El objetivo de utilidad se evalúa al recoger respuestas, no se declara satisfecho antes del piloto.
- Cada entrevista completada tiene evidencia durable y cada brecha crítica tiene asignación automática o fallo visible y recuperable.
- Verificar restauración/rollback y recuperación de trabajos; las suites con mocks no sustituyen aceptación de correo/proveedor/navegador ni revisión de los rangos de puntaje.

## 5. Alcance posterior

Monaco, ejecución de código arbitrario, ingesta GitHub, BullMQ, migración completa a Nest/Next y despliegue corporativo amplio quedan fuera de este MVP. Google Workspace SSO mantiene el criterio existente: obligatorio antes de ampliar el despliegue o antes de un piloto cuyo cliente lo exija. El MVP puede entregarse sobre `dashboard.mjs` con módulos/servicios separados.

Referencias publicadas: [distribución de HUs](HU_DISTRIBUTION.md), [plan del piloto](ITTI_PILOT_PLAN.md). Los criterios ampliados de este documento guían el próximo desglose de HUs; las HUs históricas no acreditan por sí solas su cumplimiento. Las guías locales `PILOT_AUTH.md` y `SUPABASE_PILOT_SETUP.md` acompañarán el PR de implementación correspondiente.
