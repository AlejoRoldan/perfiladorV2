# Resultado funcional del despliegue — 20 de octubre de 2026

## Alcance real ejecutado

Entorno designado por el usuario como staging: `https://dashboard-production-5443.up.railway.app/`. Commit desplegado no identificado. Acceso Basic Auth proporcionado por el usuario. Participante A y facilitador F corresponden a las dos identidades autorizadas en la conversación; no se incluyen credenciales ni correos personales en este informe.

Se ejecutaron solicitudes HTTPS reales contra la plataforma, lectura del HTML publicado y cuatro llamadas de aplicación a Gemini: inicio, dos turnos de chat y certificación. El proveedor puede aplicar sus reintentos internos; no se midió facturación. No hubo reintento de certificación desde esta prueba.

**Resultado: recorrido parcial aprobado hasta radar persistido; E2E completo del MVP no completado.** No hubo automatización ni comprobación visual en navegador: la herramienta no tiene navegadores conectados. La revisión del HTML y su JavaScript no acredita diseño, clics, foco, alertas, descarga efectiva ni comportamiento visual.

Las 31 regresiones locales aprobadas en la preparación utilizan servicios simulados y se registran por separado; no certifican el comportamiento del despliegue.

## Versión funcional observada

La portada autenticada expone un selector compartido de perfiles, Tech Radar, Proof of Skills, Cápsulas L&D, Piloto Itti y registro de colaboradores. El selector incluye opciones de más de una organización. No hay acceso individual verificable: `/api/session/login` devuelve 404 y las rutas de entrevista reciben `devId` e historial del navegador.

Las dos identidades autorizadas ya existían y sus páginas respondieron 200. No se crearon perfiles ni se modificó el perfil de F. Los nombres de rol A/F describen el recorrido deseado, no roles independientes acreditados en este despliegue.

## Comprobaciones reales

| Caso | Acción / evidencia | Resultado |
| --- | --- | --- |
| Acceso sin credenciales | GET `/` y `/auth/confirm` | 401, desafío Basic Auth; barrera externa operativa. |
| Acceso con Basic Auth | GET `/` | 200; HTML de la plataforma y navegación disponibles. |
| Perfiles autorizados | GET `/?devId=…` de A y F | 200; ambas identidades reconocidas. |
| Login individual | POST `/api/session/login` con correo autorizado | 404, `Endpoint no encontrado`. NO IMPLEMENTADO en la versión observada. |
| Registro inválido | POST `/api/register` con `email: not-an-email` | 500, error genérico. FALLIDO: debería responder validación 4xx. |
| Importación sin token administrativo | POST `/api/admin/import-collaborators` con CSV vacío | 403. Rechazo correcto; importación válida BLOQUEADA por falta del token. |
| Exportación sin token administrativo | POST `/api/admin/itti-report` | 403. Rechazo correcto; generación/descarga de CSV BLOQUEADA por falta del token. |
| Inicio sin identidad | POST `/api/pos/start` con `{}` | 400, `devId es obligatorio para Proof of Skills`. |
| Inicio de entrevista de A | POST `/api/pos/start` con ID autorizado | 200, pregunta inicial real; 6.860 ms. Respuesta sin identificador de sesión persistente. |
| Primer turno sintético | POST `/api/pos/chat` | 200, seguimiento real; 4.979 ms. |
| Segundo turno sintético | POST `/api/pos/chat` | 200, seguimiento real; 5.914 ms. |
| Recuperación | GET nuevo de A y POST `/api/pos/resume` | HTML nuevo no contiene la primera pregunta confirmada, no usa sessionStorage y resume devuelve 404. Recuperación de entrevista NO DISPONIBLE. |
| Certificación de A | POST `/api/pos/evaluate`, una sola vez | 200, `success: true`, seis habilidades y referencia de evaluación; 12.465 ms. |
| Persistencia del radar | Dos GET de A después de certificar | Seis puntajes coinciden con el veredicto y permanecen estables. APROBADO por lectura de aplicación; no inspección SQL. |
| Asignación automática | Cápsulas de A antes/después de certificar | 0 antes y 0 después, aun con gaps de -1.50 y -1.80 en habilidades evaluadas. No se observó asignación automática durante la prueba. |
| Finalización vacía | POST `/api/pos/evaluate` con `history: []` | 400, transcripción inválida. |
| Tipo de contenido | POST `/api/pos/chat` con text/plain | 415, exige application/json. |
| Origen cruzado | POST `/api/pos/start` con Origin ajeno | 403, origen no autorizado. No se inició otra entrevista. |
| Cuerpo excesivo | POST `/api/pos/start` con JSON de más de 260 KB | 413, solicitud demasiado grande. No se inició otra entrevista. |
| Sintaxis publicada | Compilación sintáctica de scripts inline del HTML de A | JavaScript válido sintácticamente; no se ejecutaron controles del navegador. |

Los tiempos miden cada endpoint de aplicación, incluyendo proveedor y persistencia cuando corresponda, no exclusivamente latencia de Gemini.

## Radar observado tras la entrevista sintética

Antes de la prueba, las ocho habilidades de A mostraban 1.00 y no tenía módulos. Después de certificar:

| Habilidad | Puntaje | Requerido | Brecha | Incluida en el veredicto |
| --- | --- | --- | --- | --- |
| CLEAN_ARCHITECTURE | 3.50 | 3.70 | -0.20 | Sí |
| SYSTEM_DESIGN_SCALABILITY | 3.50 | 3.80 | -0.30 | Sí |
| API_CONTRACTS | 3.50 | 3.80 | -0.30 | Sí |
| SQL_OPTIMIZATION_CONCURRENCY | 4.50 | 3.90 | +0.60 | Sí |
| CODE_REVIEW_RIGOR | 1.00 | 3.60 | -2.60 | No |
| OBSERVABILITY_INCIDENTS | 2.00 | 3.50 | -1.50 | Sí |
| TESTING_STRATEGY | 2.00 | 3.80 | -1.80 | Sí |
| OWASP_INPUT_VALIDATION | 1.00 | 3.80 | -2.80 | No |

El veredicto retornó justificación por habilidad y confianza global 0.94; las tarjetas publicadas no muestran esas justificaciones, citas, confianza ni siguiente paso. La confianza no se validó como medida calibrada de competencia.

Referencia retornada: `POS-20261020-201210177-9829d20906f44ebc`. Modelo declarado: `gemini-3-flash-preview`. Cinco turnos en el historial de certificación, dos de usuario. El contenido fue sintético para probar la aplicación y **no representa una evaluación profesional de la persona titular del perfil**.

## Hallazgos y siguiente corrección

| ID | Prioridad propuesta | Hallazgo | Acción |
| --- | --- | --- | --- |
| QA-E2E-01 | P0 | Identidad compartida: selector con perfiles y organizaciones; no login individual publicado. | Integrar magic links y autorización por identidad/rol/tenant; probar dos usuarios y dos organizaciones con sesiones independientes. |
| QA-E2E-02 | P0 | Conversación depende del historial enviado por cliente; no resume publicado. | Integrar sesiones/turnos de servidor y probar recarga, nuevo navegador e idempotencia con PostgreSQL real. |
| QA-E2E-03 | P1 | Registro inválido devuelve 500. | Convertir errores de entrada en respuesta 4xx y feedback claro; revisar trazas privadas sin mostrar secretos. |
| QA-E2E-04 | P1 | Radar muestra déficit en habilidades ausentes del veredicto. | Distinguir «sin evidencia suficiente» del puntaje bajo; usar evidencia explícita. |
| QA-E2E-05 | P1 | Se completó evaluación con déficits relevantes, pero no se observó asignación de módulos. | Conectar PoS a asignación persistente y recuperable; definir umbral de brecha crítica y verificarla con datos de prueba. |
| QA-E2E-06 | P1 | Cápsulas de A vacías y sin entrega de reto en el HTML publicado. | Agregar estado vacío comprensible y envío/evaluación del reto para completar aprendizaje. |
| QA-E2E-07 | P1 | Radar no expone la explicación/evidencia del veredicto. | Mostrar justificaciones, citas verificadas, confianza y siguiente paso. |
| QA-E2E-08 | P1 | No se identificaron consentimiento y utilidad en las pantallas publicadas. | Conectar aviso/aceptación y encuesta con persistencia y métricas. Confirmar interacción cuando haya navegador. |

La definición de brecha crítica no está acreditada por configuración del despliegue. QA-E2E-05 describe el resultado observado y el incumplimiento del recorrido deseado; no presupone un umbral oculto ni demuestra el estado de un eventual worker externo.

## Pendientes para cerrar la prueba

- Navegador conectado: recorrer pestañas, modal, formularios y tamaños de pantalla; comprobar foco, alertas, recarga interactiva y errores visibles.
- Token administrativo: probar importación válida/parcial/duplicada y exportación real. El usuario confirmó que no dispone del token; no se intentó adivinarlo ni sustituirlo.
- Acceso individual publicado: verificar enlace consumido/vencido, aislamiento de roles/organizaciones, revocación y logout. No se enviaron magic links porque la ruta publicada devuelve 404.
- PostgreSQL/observabilidad del entorno: acreditar una sola señal durable, transacciones, concurrencia, rollback y preservación de radar ante fallo de persistencia. No se usó la configuración DB local, cuyo entorno no está confirmado.
- Módulos automáticos y entrega: repetir E2E hasta completar reto, feedback y resumen ejecutivo cuando estén disponibles.
- Fallos de proveedor/costo: probar únicamente con mecanismo controlado del entorno; no se deshabilitaron claves ni se hicieron llamadas repetidas para provocar fallos.

## Datos modificados por la prueba

Se ejecutó una certificación sintética sobre el perfil autorizado A, actualizando su radar según la tabla. No se borró esa evidencia, no se restauraron puntajes manualmente y no se modificaron perfiles ajenos. La referencia anterior identifica el resultado de QA para su tratamiento posterior por el operador del entorno.

Este informe se prepara como evidencia documental para revisión y no contiene credenciales ni correos personales. Las credenciales suministradas no se guardaron en archivos del proyecto.
