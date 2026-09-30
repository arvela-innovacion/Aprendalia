# APRENDALIA — CONTEXTO DEL PROYECTO PARA COPILOT

Este documento es el contexto maestro para GitHub Copilot del proyecto Aprendalia.

## Objetivo
Aprendalia es una aplicación web educativa para una alumna de 3º de Primaria. Cada dos semanas aproximadamente se añaden nuevos temas, conceptos y preguntas. Añadir temas o conceptos NO debe requerir modificar código ni currículo.

## Arquitectura
- `curriculum.json`: solo cursos y asignaturas autorizadas, con label, icono y orden. No contiene temas, conceptos ni tipos.
- `question-types.json`: fuente de verdad de los tipos de ejercicios soportados.
- `questions.csv`: contenido educativo. Tema y concepto son libres.
- Una asignatura nueva NO se carga automáticamente: debe estar autorizada en `curriculum.json`.

## IDs importantes
IDs internos de asignaturas: `Lengua`, `Matematicas`, `Ingles`, `Socials`.
El ID es `Matematicas`; `Matemáticas` es únicamente el label visual.

## CSV
Separador: `;`.
Exactamente 12 columnas:
`id;curso;asignatura;tema;concepto;nivel;tipo;pregunta;opciones;respuesta_correcta;extra;activa`

- `id`: único y estable; no cambiar IDs existentes gratuitamente.
- `curso`: p. ej. `3EP`.
- `asignatura`: ID autorizado por curriculum.
- `tema`: libre.
- `concepto`: libre; si está vacío, normalizar a `general`.
- `nivel`: 1, 2 o 3, siempre adecuado a 3º de Primaria.
- `tipo`: debe existir en `question-types.json`.
- `pregunta`: enunciado claro e inequívoco.
- `opciones`: opciones separadas por `|`; no duplicadas.
- `respuesta_correcta`: respuesta esperada; debe ser compatible con opciones cuando corresponda.
- `extra`: pista útil sin revelar normalmente la respuesta.
- `activa`: estado de la pregunta.

## Tipos soportados
`test`, `verdadero_falso`, `completar`, `ordenar`, `arrastrar`, `cual_no_encaja`, `escribir`, `clasificar`, `guess`, `listening`, `pronunciar`, `hablar`.

No declarar un tipo válido si el motor no sabe renderizarlo/evaluarlo. Un tipo nuevo requiere catálogo + renderizador + evaluación + tests + documentación.

## Validación
Errores bloqueantes: estructura/columnas incorrectas, ID duplicado, curso inexistente, asignatura no autorizada, pregunta vacía, tipo desconocido, nivel inválido, respuesta/opciones obligatorias ausentes, opciones duplicadas, respuesta incompatible y formatos imposibles de renderizar/evaluar.

NO son errores ni warnings: tema nuevo, concepto nuevo, combinación tema/concepto nueva, asociación tipo/asignatura nueva o nivel/tipo nuevo para un concepto.

## Duplicados
Detectar preguntas equivalentes aunque cambie el orden de las opciones. Normalizar razonablemente mayúsculas, espacios, puntuación y orden de opciones. No eliminar automáticamente casos dudosos.

## Adaptación
Sesiones de unas 10 preguntas. Modos: `adaptive`, `review`, `discover`.
Priorizar conceptos nuevos, empezar favoreciendo nivel 1, introducir niveles 2–3 con dominio, reforzar errores recientes, recuperar conceptos dominados con repaso espaciado y mantener diversidad de conceptos.

## Progreso
Componentes relevantes: `ProgressRepository`, `QuestionSelector`, `SessionEngine`, `ScoringEngine`, `ProgressView`.
Analizar progreso por asignatura, tema, concepto y pregunta. Los conceptos nuevos aparecen sin registrarlos previamente.
Zona de padres: mostrar qué conviene practicar y distinguir contenido nuevo, en aprendizaje, con necesidad de refuerzo y dominado.

## Dictado
Usar capacidades TTS. `pronunciar` puede funcionar como dictado:
- reproducir audio;
- ocultar el texto objetivo;
- escribir lo escuchado;
- respetar ortografía y acentos;
- tolerancia solo razonable;
- no revelar respuesta antes de contestar.

## Flujo quincenal
Mantener bloques en `question-banks/`, por ejemplo:
`question-banks/2026-10-lengua.csv`
`question-banks/2026-10-matematicas.csv`

`tools/compile-questions.js`: leer bancos, normalizar, asignar IDs cuando proceda, validar, detectar duplicados, combinar y generar `questions.csv`. No publicar con errores bloqueantes.

`tools/validate-content.js`: validar banco completo o bloques y mostrar errores accionables con fila, ID y causa.

`QUESTION_AUTHORING.md`: contrato de autoría para IA. Las preguntas deben ser apropiadas para 3º de Primaria, claras, sin trampas, con distractores plausibles, variedad real, niveles 1–3 y pistas útiles. Evitar pseudo-variaciones mecánicas.

## Archivos relevantes
- `README.md`
- `QUESTION_AUTHORING.md`
- `question-schema.json`
- `question-types.json`
- `curriculum.json`
- `questions.csv`
- `script.js`
- `style.css`
- `question-banks/README.md`
- `src/core/question-selector.js`
- `src/data/content-model.js`
- `src/data/curriculum.js`
- `src/data/progress-repository.js`
- `src/exercises/audio-exercises.js`
- `src/ui/progress-view.js`
- `tools/compile-questions.js`
- `tools/validate-content.js`
- `tests/run-tests.js`

Inspeccionar siempre el repositorio real: esta lista puede no ser exhaustiva.

## Responsabilidades
`src/data/content-model.js`: parseo, normalización, validación estructural, defaults, tipos/asignaturas y consistencia. NO validar tema/concepto contra currículo.
`src/data/curriculum.js`: cursos/asignaturas, labels, iconos y presentación.
`src/core/question-selector.js`: selección adaptativa/repaso/descubrimiento.
`src/data/progress-repository.js`: progreso, preservando compatibilidad.
`src/exercises/audio-exercises.js`: TTS/listening/dictado/speaking.
`src/ui/progress-view.js`: visualización de progreso.
`script.js`: orquestación; evitar lógica especializada innecesaria.

## Error histórico
Un banco de 500 preguntas tuvo 255 errores: 250 usaban `Matemáticas` en lugar de `Matematicas` y 5 tenían opciones duplicadas. El banco corregido quedó con 500 preguntas, 0 errores, 0 warnings y 0 duplicados. No confundir IDs internos con labels.

## Contenido trabajado
Lengua: sinónimos; CA–QUE–QUI–CO–CU; comunicación y lenguaje; formas de comunicación; lenguas dentro/fuera de España; dictado.
Matemáticas: números de 3/4 cifras; escritura y ordenación; unidades/decenas/centenas/unidades de millar; composición/descomposición; valor posicional; ordinales hasta vigésimo; problemas.

## Antes de entregar cambios
1. Ejecutar tests.
2. Validar `questions.csv`.
3. Comprobar duplicados.
4. Comprobar sintaxis JS.
5. Comprobar JSON.
6. Recompilar preguntas si corresponde.
7. Verificar que el CSV validado es EXACTAMENTE el entregado.
8. Listar TODOS los archivos modificados.
9. Explicar migraciones.
10. Cuando sea posible, probar login → asignatura → sesión → respuestas/pista → final → progreso → zona de padres.

## Compatibilidad
No cambiar gratuitamente IDs, claves localStorage, IDs de asignaturas ni estructura CSV. No romper progreso existente ni eliminar soporte de preguntas existentes.

## Objetivo final
Padre aporta temario → IA genera bloque siguiendo `QUESTION_AUTHORING.md` → se guarda en `question-banks/` → valida → detecta duplicados → compila → tests → publica → la app descubre temas/conceptos → el selector adaptativo enseña y repasa.

Tema/concepto nuevo: NO requiere modificar JS/JSON.
Asignatura nueva: SÍ requiere `curriculum.json`.
Tipo nuevo: SÍ requiere `question-types.json` + implementación + tests.

## Instrucciones para Copilot
Inspecciona primero los archivos reales. No conviertas tema/concepto en enums. No reintroduzcas validaciones curriculares para ellos. No permitas asignaturas arbitrarias. Usa `question-types.json` como catálogo de capacidades. Prioriza robustez y mantenibilidad para crecimiento quincenal. Si este documento contradice el código real, señala la contradicción antes de cambios destructivos.
