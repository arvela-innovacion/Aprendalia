# Aprendalia

Aprendalia es una aplicación web estática de estudio pensada para
sesiones cortas, frecuentes y adaptativas. El objetivo actual es que un
alumno pueda entrar con sus credenciales, elegir asignatura y completar
sesiones de 10 preguntas mientras la aplicación registra su progreso,
prioriza contenido nuevo y repasos, aplica repetición espaciada y ofrece
a las familias una zona separada de seguimiento.

La aplicación no necesita un backend propio para funcionar: HTML, CSS y
JavaScript se ejecutan en el navegador y el banco de preguntas se carga
desde `questions.csv`. Esto hace que sea sencilla de desplegar en un
hosting estático o repositorio web, pero también implica limitaciones de
seguridad y sincronización que se documentan más abajo.

> **Estado de esta versión:** arquitectura y mecánicas de aprendizaje
> estabilizadas antes de la siguiente fase de trabajo sobre contenido.
> Incluye acceso individual por alumno, control opcional por
> dispositivo, Zona de padres, histórico local, selección adaptativa,
> repetición espaciada, ayudas, puntuación, ejercicios modulares,
> mejoras móviles y tests del motor.

------------------------------------------------------------------------

## 1. Experiencia del alumno

El flujo normal es deliberadamente sencillo:

1.  El alumno introduce **usuario y contraseña**.
2.  Si el usuario tiene dispositivos restringidos, Aprendalia comprueba
    también el identificador del navegador/dispositivo.
3.  El alumno elige una asignatura.
4.  Se muestra una preparación de sesión con cobertura y estrellas
    acumuladas.
5.  Empieza una sesión de **10 preguntas** (o menos si la asignatura no
    dispone de 10).
6.  Durante la sesión se muestran estrellas, racha y progreso.
7.  Cada pregunta permite, cuando procede, usar **Pista/Ayuda** o **No
    lo sé**.
8.  Tras responder, se ofrece feedback y, cuando hay error, un segundo
    intento claramente diferenciado.
9.  Al terminar se muestra el resumen de la sesión.
10. El progreso de cada pregunta queda guardado para decidir qué
    conviene estudiar en sesiones posteriores.

Durante una sesión activa, el logo/título **Aprendalia** del encabezado
funciona también como salida. Al pulsarlo se pide confirmación antes de
abandonar. Las preguntas ya finalizadas conservan su progreso; la
pregunta que estaba a medias no cuenta como acierto ni fallo y la sesión
incompleta no se guarda como una sesión terminada.

### Ayuda integrada: “Cómo funciona”

La cabecera incorpora un acceso discreto `?` que abre una ayuda dentro
de la propia aplicación. Su objetivo es que un alumno o una familia
pueda entender Aprendalia sin tener que leer este README ni recibir una
explicación externa.

La ayuda resume, en lenguaje no técnico:

- qué es una sesión y por qué tiene 10 preguntas;
- qué significan las estrellas y las rachas;
- cómo funcionan el segundo intento, las pistas y “No lo sé”;
- por qué algunas preguntas vuelven a aparecer mediante repetición
  espaciada;
- qué información ofrece la Zona de padres;
- cómo funcionan usuario, contraseña y control opcional por dispositivo;
- qué información permanece en el navegador y qué información puede
  enviarse a Google como observabilidad.

La ayuda es un modal: no cambia de página ni destruye el estado de una
sesión. Puede cerrarse desde su control de cierre, tocando fuera del
panel o con `Esc`. El diseño es responsive y está pensado para móvil.

La ayuda **no contiene credenciales**, no permite modificar usuarios y
no sustituye la Zona de padres. Es únicamente documentación contextual
para el usuario final.

------------------------------------------------------------------------

## 2. Estructura del proyecto

``` text
/
├── index.html
├── style.css
├── script.js
├── girl.png
├── questions.csv
├── curriculum.json
├── questions_ayer.csv
├── questions_ayer2.csv
├── README.md
├── src/
│   ├── config/
│   │   └── access-config.js
│   ├── core/
│   │   ├── question-selector.js
│   │   ├── scoring-engine.js
│   │   └── session-engine.js
│   ├── data/
│   │   ├── storage.js
│   │   ├── content-model.js
│   │   ├── curriculum.js
│   │   ├── progress-repository.js
│   │   └── telemetry.js
│   ├── exercises/
│   │   ├── audio-exercises.js
│   │   ├── interaction-exercises.js
│   │   └── text-exercises.js
│   └── ui/
│       └── progress-view.js
├── tests/
│   └── run-tests.js
└── tools/
    └── validate-content.js
```

### Responsabilidad de cada archivo

**`index.html`** contiene la estructura de la aplicación: cabecera,
login, selector de asignatura, preparación de sesión, Zona de padres,
área de ejercicio y carga ordenada de módulos JavaScript.

**`style.css`** concentra el sistema visual, responsive, estados de
botones, feedback, Zona de padres, ejercicios, animaciones y
adaptaciones para móvil. Las microtransiciones respetan
`prefers-reduced-motion`.

**`script.js`** actúa como orquestador principal. Gestiona login,
navegación, creación y avance de sesiones, HUD, feedback común,
intentos, ayudas, registro de resultados, salida de sesión,
apertura/cierre de la ayuda integrada y coordinación de los
renderizadores. La comunicación externa con Google está delegada en
`src/data/telemetry.js`.

**`src/config/access-config.js`** contiene usuarios, contraseñas,
dispositivos autorizados, contraseña común de padres y
generación/identificación del dispositivo.

**`src/data/storage.js`** encapsula `localStorage`, versiona el esquema
y realiza migraciones de versiones anteriores.

**`src/data/content-model.js`** define el contrato del nuevo `questions.csv`, parsea CSV con separador `;`, normaliza campos y valida IDs, curso, asignatura, tema, concepto, nivel, tipo, opciones y estado activo.

**`src/data/curriculum.js`** carga `curriculum.json` y resuelve las etiquetas visibles de curso, asignatura, tema y concepto. El currículo es la fuente estructural; el CSV contiene ejercicios asociados a esa estructura.

**`src/data/progress-repository.js`** almacena y consulta progreso por
pregunta, sesiones históricas, estados de dominio, fechas de próximo
repaso y copias de seguridad. Es la capa de datos pedagógicos: Google
Sheets no sustituye este repositorio.

**`src/data/telemetry.js`** encapsula la única salida de observabilidad
hacia Google Apps Script/Sheets. Mantiene deliberadamente el contrato
histórico de 8 campos para no exigir cambios en el Apps Script
existente. Sólo transmite resultados asociados a preguntas
(`question_result`); los eventos internos de login, inicio, fin o
abandono de sesión no se envían a Google.

**`src/core/question-selector.js`** decide qué preguntas forman una
sesión usando prioridad por concepto y, dentro de cada concepto, cobertura, dificultad y repetición espaciada. La selección intenta mezclar conceptos antes de repetir uno.

**`src/core/scoring-engine.js`** contiene las reglas de estrellas,
rachas y recompensa según intento/ayuda/recuperación.

**`src/core/session-engine.js`** crea el estado de una sesión y lo
transforma en un registro histórico al finalizar.

**`src/exercises/*.js`** contiene los renderizadores de ejercicios
especializados. La lógica común de sesión permanece fuera de ellos.

**`src/ui/progress-view.js`** construye el panel de seguimiento de la
Zona de padres e identifica alumno, curso, asignatura, temas, conceptos, niveles, cobertura y dominio conceptual.

**`tests/run-tests.js`** ejecuta tests unitarios/smoke tests del núcleo
sin navegador real.

**`tools/validate-content.js`** valida `questions.csv` contra `curriculum.json` y, para el banco de prueba actual, comprueba que haya exactamente 10 preguntas por combinación curso/asignatura/tema/concepto/nivel/tipo.

------------------------------------------------------------------------

## 3. Orden de carga de JavaScript

El orden de los scripts en `index.html` es importante:

``` text
src/config/access-config.js
src/data/storage.js
src/data/content-model.js
src/data/curriculum.js
src/data/progress-repository.js
src/data/telemetry.js
src/core/scoring-engine.js
src/core/session-engine.js
src/core/question-selector.js
src/ui/progress-view.js
src/exercises/text-exercises.js
src/exercises/audio-exercises.js
src/exercises/interaction-exercises.js
script.js
```

Los módulos se exponen actualmente mediante objetos globales en
`window`, por lo que un módulo que depende de otro debe cargarse después
de él. No reordenar estas etiquetas sin revisar dependencias.

------------------------------------------------------------------------

## 4. Acceso de alumnos

Las cuentas se administran manualmente en:

``` text
src/config/access-config.js
```

El formato actual es:

``` js
const STUDENTS = Object.freeze({
  alba: Object.freeze({
    password: 'Alba27',
    course: '3EP',
    devices: Object.freeze([])
  }),
  ana: Object.freeze({
    password: 'Ana42',
    course: '3EP',
    devices: Object.freeze([])
  }),
  sergio: Object.freeze({
    password: 'Sergio58',
    course: '3EP',
    devices: Object.freeze([])
  })
});
```

### Dar de alta un alumno

Añadir una entrada al objeto `STUDENTS`:

``` js
lucas: Object.freeze({
  password: 'ClaveElegidaPorElAdministrador',
  devices: Object.freeze([])
})
```

El nombre de usuario se normaliza a minúsculas y sin acentos para el
login. La contraseña sí se compara literalmente.

No existe registro público, recuperación de contraseña ni cambio de
contraseña por parte del alumno. El administrador decide y conoce las
credenciales.

### Curso asignado al alumno

Cada usuario incluye `course`. Ese valor gobierna qué parte de `curriculum.json` y qué filas de `questions.csv` puede utilizar. El alumno no elige curso manualmente.

Ejemplo:

``` js
course: '3EP'
```

Al cambiar un alumno de curso se conserva su histórico local, pero las sesiones normales pasan a utilizar el currículo del nuevo curso.

### Seguridad de las credenciales

Aprendalia es una aplicación estática. El navegador necesita descargar
`access-config.js`, por lo que una persona con conocimientos técnicos
puede inspeccionar el JavaScript y encontrar credenciales y
configuración. Este mecanismo está pensado como **control de acceso
práctico/casual**, no como autenticación segura de nivel servidor.

Si el proyecto necesitara seguridad real, las contraseñas deberían salir
del código cliente y validarse mediante un backend con hashes de
contraseña, sesiones y autorización en servidor.

------------------------------------------------------------------------

## 5. Control opcional usuario-dispositivo

Cada navegador recibe un identificador persistente con formato parecido
a:

``` text
DEV-AB12-CD34-EF56
```

Se guarda en:

``` text
localStorage['aprendalia:device-id']
```

La política está diseñada para permitir un periodo inicial de
observación.

### Usuario sin dispositivos configurados

``` js
devices: Object.freeze([])
```

Significa: **usuario y contraseña correctos pueden entrar desde
cualquier dispositivo**.

Esto permite compartir Aprendalia con la clase, observar durante unas
semanas los dispositivos reales y no bloquear a nadie inicialmente.

### Usuario con uno o más dispositivos configurados

``` js
devices: Object.freeze([
  'DEV-AB12-CD34-EF56',
  'DEV-7812-90AB-CDEF'
])
```

En cuanto el array contiene al menos un ID, se activa la restricción.
Ese alumno sólo puede iniciar sesión desde los dispositivos listados.

Así, compartir únicamente usuario y contraseña con otro niño no basta
para entrar desde otro navegador.

### Qué se considera “dispositivo”

El ID identifica realmente una **instalación/navegador**, no el hardware
físico de forma criptográfica. Cambiar de navegador, borrar los datos
del sitio, navegar en ciertos modos privados o impedir `localStorage`
puede producir un ID diferente.

No se realiza fingerprinting invasivo. Además del ID se obtiene una
etiqueta aproximada basada en `userAgent`, por ejemplo:

``` text
iPad · Safari
Windows · Chrome
Android · Chrome
```

Esta etiqueta sirve para administración/observabilidad, no como factor
de seguridad.

------------------------------------------------------------------------

## 6. Zona de padres

La Zona de padres está separada del flujo infantil y se abre mediante el
acceso discreto:

``` text
⚙️ Zona de padres
```

La contraseña común se configura también en
`src/config/access-config.js`:

``` js
const PARENT_PASSWORD = 'Padres2026';
```

En esta versión la contraseña es común para todas las familias.

### Información disponible

La cabecera de la Zona de padres identifica explícitamente **alumno, curso y asignatura**. Para la asignatura seleccionada muestra:

- cobertura de preguntas;
- conceptos dominados, en práctica, con dificultad y sin empezar;
- resumen global del curso;
- mapa curricular con **tema → concepto → niveles vistos**;
- precisión agregada por concepto;
- conceptos que necesitan repaso;
- estadísticas de los últimos 7 días;
- evolución y sesiones recientes;
- tabla detallada de preguntas practicadas con tema, concepto, nivel, estado y próximo repaso;
- exportación e importación de backup.

El objetivo es que el seguimiento deje de depender principalmente de IDs de preguntas y pueda responder a preguntas como “¿qué concepto necesita reforzar?”.

### Backup desde la Zona de padres

El progreso de un usuario puede exportarse a JSON e importarse
posteriormente. Esto es importante porque el almacenamiento principal es
local al navegador.

El fichero exportado contiene, entre otros datos:

``` text
schemaVersion
exportedAt
user
progress
sessions
```

La importación reemplaza el progreso y sesiones locales de ese usuario
con los datos del backup importado.

------------------------------------------------------------------------

## 7. Sesiones de estudio

La constante principal está en `script.js`:

``` js
const SESSION_SIZE = 10;
```

Una sesión normal intenta contener 10 preguntas. Si la asignatura tiene
menos preguntas disponibles, se utilizan las disponibles.

La pantalla previa indica aproximadamente:

``` text
10 preguntas · unos 5 minutos
```

Durante la sesión se registran:

- estrellas obtenidas;
- aciertos;
- fallos;
- aciertos a la primera;
- aciertos a la segunda;
- preguntas recuperadas;
- racha actual;
- mejor racha;
- preguntas presentadas;
- resultados individuales.

Al finalizar, `SessionEngine.toHistory()` genera un registro histórico
con inicio, fin, asignatura, total, aciertos, fallos, estrellas, mejor
racha y resultados de preguntas.

Una sesión abandonada manualmente no se registra como sesión finalizada.

------------------------------------------------------------------------

## 8. Selección adaptativa de preguntas

Aprendalia selecciona en dos capas. Primero prioriza **conceptos curriculares** y después elige preguntas concretas dentro de esos conceptos. El selector está en:

``` text
src/core/question-selector.js
```

La clave conceptual es:

``` text
curso + asignatura + tema + concepto
```

Cada concepto recibe prioridad según su estado agregado (`new`, `practice`, `difficulty`, `mastered`), su cobertura y su precisión. Los conceptos nuevos o con dificultad suben; los dominados bajan.

Dentro de cada concepto, cada pregunta conserva la prioridad por repetición espaciada: vencimiento, último fallo, precisión, número de presentaciones y tiempo desde la última aparición.

La sesión se construye en rondas por concepto. Esto favorece diversidad: si hay varios conceptos disponibles, se intenta mostrar uno de cada uno antes de repetir el mismo concepto.

### Factores de prioridad

A nivel de concepto aumentan la prioridad:

- concepto todavía sin empezar;
- concepto marcado con dificultad;
- baja cobertura;
- precisión agregada baja.

A nivel de pregunta aumentan la prioridad:

- repaso vencido;
- último resultado incorrecto;
- estado `difficulty`;
- precisión inferior al 60 %;
- pocas presentaciones;
- muchos días sin aparecer.

Se añade una pequeña aleatoriedad para evitar sesiones idénticas.

------------------------------------------------------------------------

## 9. Repetición espaciada

El calendario se gestiona en `src/data/progress-repository.js`.

Para un acierto limpio se utilizan intervalos progresivos:

``` text
1 día → 3 días → 7 días → 14 días → 30 días → 60 días
```

Un fallo reinicia la racha de éxito y programa un repaso cercano,
normalmente al día siguiente.

Un acierto asistido, un acierto tras más de un intento o una
recuperación no avanza tan agresivamente el intervalo. La intención es
distinguir entre “lo sabía con soltura” y “he conseguido resolverlo con
ayuda”.

Cada registro puede almacenar:

``` text
successStreak
intervalDays
dueAt
lastSeen
lastResult
recentResults
```

El selector usa `dueAt` para decidir si una pregunta debe volver a
aparecer.

------------------------------------------------------------------------

## 10. Estados de dominio

Cada pregunta puede estar en uno de cuatro estados:

### ⚪ Sin ver (`new`)

Nunca se ha presentado al alumno.

### 🟡 En práctica (`practice`)

Ya se ha trabajado, pero todavía no cumple criterios de dominio ni
dificultad.

### 🔴 Con dificultad (`difficulty`)

Se activa, entre otros casos, cuando hay varios fallos recientes o
cuando, después de varias presentaciones, la precisión es inferior al 60
%.

### 🟢 Dominada (`mastered`)

Requiere varias presentaciones, al menos un 80 % de precisión y una
racha reciente de éxitos suficiente.

Estos estados son dinámicos: una pregunta dominada puede volver a
convertirse en práctica/dificultad si aparecen errores posteriores.

------------------------------------------------------------------------

## 11. Puntuación y estrellas

Las reglas están centralizadas en:

``` text
src/core/scoring-engine.js
```

### Acierto limpio a la primera

``` text
+10 estrellas
```

Si la racha limpia es de 3 o más:

``` text
+2 estrellas adicionales
```

Por tanto, un acierto limpio durante una racha puede dar 12 estrellas.

### Segundo intento o respuesta asistida

``` text
+6 estrellas
```

Se considera asistida cuando se ha usado, por ejemplo:

- pista/ayuda;
- “No lo sé”;
- autoevaluación manual del ejercicio de hablar cuando no existe
  reconocimiento de voz.

Una respuesta asistida nunca recibe la recompensa máxima de primer
intento.

### Pregunta recuperada

Una pregunta reintroducida como repaso tras un fallo y finalmente
acertada concede:

``` text
+3 estrellas
```

### Fallos

Los fallos no restan estrellas, pero rompen la racha.

### Persistencia de estrellas

Además de las estrellas de la sesión, existe un acumulado por usuario
guardado localmente para mostrar progresión a largo plazo.

------------------------------------------------------------------------

## 12. Intentos, errores y recuperación

La configuración general es:

``` js
const MAX_ATTEMPTS = 2;
```

La regla común es:

``` text
Primer error → feedback + segundo intento
Segundo error → solución + registro del fallo + posible repaso posterior
```

El segundo intento se presenta visualmente como **“2.º intento”** y la
tarjeta cambia de estado para que el alumno entienda que sigue
trabajando la misma pregunta.

Los controles se bloquean inmediatamente mientras se procesa una
respuesta. Esto evita dobles clics o dobles toques, especialmente en
móvil.

Al permitir un reintento, se reactivan los controles necesarios y, en
respuestas escritas, el foco vuelve al campo de texto.

------------------------------------------------------------------------

## 13. Ayudas: Pista y “No lo sé”

Durante las preguntas aparecen dos mecanismos pedagógicos:

``` text
💡 Pista / Ayuda
🤔 No lo sé
```

Usar cualquiera de ellos marca la pregunta como asistida. El objetivo es
que pedir ayuda sea preferible a responder aleatoriamente, pero que el
sistema diferencie ese resultado de un dominio limpio.

La información queda registrada en el histórico mediante campos como:

``` text
assisted
hintsUsed
dontKnow
```

Esto permite evolucionar en el futuro hacia métricas más finas de
autonomía.

------------------------------------------------------------------------

## 14. Tipos de ejercicio soportados

El banco actual utiliza 12 tipos.

### `test`

Pregunta de opciones. El alumno pulsa una respuesta y se compara con
`respuesta`.

### `verdadero_falso`

Utiliza el flujo de botones de respuesta y la misma validación común que
un test.

### `escribir`

Muestra un campo de texto y botón **Comprobar**. La respuesta se
normaliza antes de compararse.

### `completar`

Renderizado especializado en `src/exercises/text-exercises.js`.

### `cual_no_encaja`

Ejercicio especializado para identificar el elemento que no pertenece al
conjunto.

### `clasificar`

Permite clasificar elementos y utiliza el mismo ciclo común de intentos:
primer fallo, segundo intento y, si vuelve a fallar, solución/repaso.

### `ordenar`

Permite ordenar palabras o elementos. Está adaptado a móvil y no depende
exclusivamente del drag nativo del navegador.

Además del arrastre, existe interacción por toque: seleccionar un
elemento y después otro permite recolocarlo, proporcionando un fallback
fiable para Safari/iOS y otros navegadores táctiles.

### `arrastrar`

Ejercicio de emparejamiento/interacción. Los emparejamientos incorrectos
consumen intentos de forma coherente con el resto del sistema.

### `listening`

Ejercicio puramente auditivo. El texto objetivo **no se muestra encima
del botón de escuchar**; durante la resolución aparece un mensaje
genérico como “Escucha con atención”. El texto real sólo debe revelarse
cuando corresponda como solución/feedback.

### `guess`

Utiliza el flujo auditivo de listening y mantiene oculto el texto
objetivo durante la resolución.

### `pronunciar`

Reproduce audio y permite escribir lo escuchado. La comparación admite
tolerancia mediante distancia de edición para pequeñas diferencias.

### `hablar`

Permite escuchar/repetir y, cuando el navegador dispone de
reconocimiento de voz, utilizar transcripción para evaluar.

Si `SpeechRecognition` no está disponible, **la sesión nunca queda
bloqueada**. Se ofrece un fallback de autoevaluación del tipo **“Ya lo
he dicho”**. Ese resultado se marca como asistido/autoevaluado y no
recibe la puntuación máxima.

------------------------------------------------------------------------

## 15. Audio, voz y compatibilidad

Aprendalia utiliza capacidades del navegador como:

- `speechSynthesis` para texto a voz cuando está disponible;
- `SpeechRecognition`/implementaciones compatibles cuando el navegador
  las ofrece;
- APIs de audio/grabación cuando procede.

Estas APIs no tienen soporte idéntico en todos los navegadores,
especialmente en iOS/Safari y navegadores móviles.

La filosofía de la aplicación es **degradación funcional**: si una API
avanzada no existe, el alumno debe seguir pudiendo completar la sesión
mediante un mecanismo alternativo siempre que sea posible.

El ejercicio `hablar` incluye explícitamente ese fallback para evitar
sesiones bloqueadas.

------------------------------------------------------------------------

## 16. Experiencia móvil y prevención de errores de interacción

La UI se ha diseñado para funcionar tanto con ratón como con táctil.

Entre las mejoras específicas:

- botones grandes y consistentes;
- estados de foco accesibles;
- reordenación táctil alternativa en `ordenar`;
- bloqueo inmediato al enviar respuesta;
- prevención de dobles toques/dobles puntuaciones;
- segundo intento visualmente diferenciado;
- transición breve al cargar una pregunta nueva;
- animaciones reducidas/desactivadas cuando el sistema solicita
  `prefers-reduced-motion`;
- diseño responsive de Zona de padres y tablas.

------------------------------------------------------------------------

## 17. Feedback y transición entre preguntas

El feedback diferencia varios escenarios:

- acierto limpio;
- racha;
- acierto tras ayuda;
- segundo intento recuperado;
- pregunta recuperada después de un fallo anterior;
- error con posibilidad de reintento;
- error definitivo con solución.

Las preguntas nuevas usan una microtransición breve para dar continuidad
visual sin ralentizar la sesión.

Las celebraciones grandes se reservan para momentos relevantes,
especialmente el final de sesión, evitando confeti excesivo en cada
acierto rutinario.

------------------------------------------------------------------------

## 18. Persistencia local y esquema de datos

El almacenamiento principal usa `localStorage`.

La versión actual del esquema es:

``` js
VERSION = 4
```

Las claves administradas por `AprendaliaStorage` utilizan el prefijo:

``` text
aprendalia:v4:
```

### Migración

Al iniciar, `storage.js` busca datos con el prefijo anterior:

``` text
aprendalia:v3:
aprendalia:v2:
```

Si existen y todavía no hay copia v4, copia los datos al espacio v4 y registra la migración. Los registros antiguos pueden quedar sin asociar a las nuevas preguntas si proceden del banco anterior, porque la identidad de pregunta ha cambiado deliberadamente al nuevo ID inmutable.

La migración no borra automáticamente los datos antiguos.

### Límite de sesiones

Se conservan como máximo:

``` text
200 sesiones por usuario
```

------------------------------------------------------------------------

## 19. Identidad interna de las preguntas

La identidad pedagógica de una pregunta es ahora exclusivamente su **ID estable e inmutable**.

Ejemplo:

``` text
Q000001
```

`ProgressRepository.questionKey(question)` devuelve ese ID. El validador exige que sea globalmente único.

Esto permite corregir la redacción, cambiar una pista o ajustar otros metadatos sin perder el progreso acumulado. Un ID publicado no debe reutilizarse para otra pregunta diferente.

El curso, asignatura, tema, concepto y nivel son clasificación curricular y pueden evolucionar; no forman parte de la identidad inmutable.

------------------------------------------------------------------------

## 20. Modelo de progreso por pregunta

Un registro puede incluir campos como:

``` text
key
id
course
subject
topic
concept
level
type
question
presentations
attempts
correct
wrong
firstTryCorrect
secondTryCorrect
recovered
assisted
hintsUsed
dontKnow
recentResults
lastSeen
lastResult
totalDurationMs
successStreak
intervalDays
dueAt
status
```

Esto permite reconstruir no sólo el porcentaje de acierto, sino cómo se
está aprendiendo la pregunta y cuándo conviene volver a mostrarla.

------------------------------------------------------------------------

## 21. Histórico de sesiones

Cada sesión completada contiene aproximadamente:

``` text
id
subject
startedAt
endedAt
total
correct
firstTry
secondTry
recovered
failed
bestStreak
stars
questions[]
```

Este histórico alimenta la Zona de padres y las estadísticas semanales.

------------------------------------------------------------------------

## 22. Observabilidad y telemetría

La telemetría externa está aislada en:

``` text
src/data/telemetry.js
```

El módulo se publica como:

``` js
window.AprendaliaTelemetry
```

y expone:

``` js
AprendaliaTelemetry.send(eventName, data)
```

### 22.1 Objetivo

Google Apps Script/Sheets se utiliza únicamente como **observabilidad
ligera**. No es la fuente de verdad del aprendizaje y no participa en la
selección de preguntas, puntuación, repetición espaciada, histórico ni
Zona de padres.

La separación es intencionada:

``` text
Aprendizaje y progreso
    ↓
ProgressRepository + localStorage
    ↓
Zona de padres / selector adaptativo / repetición espaciada

Observabilidad externa
    ↓
AprendaliaTelemetry
    ↓
Google Apps Script
    ↓
Google Sheets
```

Si Google no responde, no hay conexión a Internet o el `fetch` falla, el
alumno puede seguir estudiando con normalidad. El error se captura y
sólo se escribe una advertencia en consola.

### 22.2 Compatibilidad con el Google Apps Script existente

El módulo actual conserva **exactamente el contrato histórico** para no
obligar a modificar el Apps Script o la hoja existentes.

Sólo se envía a Google el evento interno:

``` text
question_result
```

Otros eventos que la aplicación pueda manejar internamente, como login,
inicio de sesión, sesión completada o sesión abandonada, son ignorados
por `telemetry.js` y **no salen del navegador**.

### 22.3 Payload enviado

Cada resultado de pregunta se envía mediante `FormData` y una petición
`POST` al endpoint configurado en `src/data/telemetry.js`.

Los únicos campos enviados son:

| Campo           | Contenido                                                      |
|-----------------|----------------------------------------------------------------|
| `fecha`         | Fecha ISO local al envío en formato `YYYY-MM-DD`               |
| `alumno`        | Usuario normalizado del alumno                                 |
| `device_key`    | ID persistente del navegador, por ejemplo `DEV-AB12-CD34-EF56` |
| `device_info`   | Etiqueta aproximada, por ejemplo `iPad · Safari`               |
| `asignatura`    | Asignatura de la pregunta                                      |
| `id_pregunta`   | ID procedente del banco de preguntas                           |
| `tipo_pregunta` | Tipo de ejercicio                                              |
| `estado`        | Resultado/estado que el orquestador registra para esa pregunta |

No se añaden actualmente campos de duración, evento, detalle, puntuación
acumulada, contraseña, respuesta escrita por el alumno ni contenido
completo del histórico.

### 22.4 Endpoint

El endpoint de Google Apps Script está definido como constante
`ENDPOINT` dentro de:

``` text
src/data/telemetry.js
```

Si cambia el despliegue del Apps Script, ése es el lugar que debe
actualizarse.

No duplicar la URL en `script.js` ni en los renderizadores de
ejercicios.

### 22.5 Dispositivo y telemetría

El `device_key` que se envía es el mismo identificador utilizado por el
control opcional usuario-dispositivo de `src/config/access-config.js`.

Esto permite utilizar la hoja para observar durante un periodo qué
dispositivos usa realmente cada alumno antes de rellenar su array
`devices`.

La etiqueta `device_info` es descriptiva y aproximada. Se obtiene de
características normales del navegador (`userAgent`, plataforma y
soporte táctil). No pretende ser un fingerprint criptográfico ni una
identificación física inequívoca del aparato.

### 22.6 Qué NO debe enviarse

Por diseño, la telemetría no debería recibir:

- contraseñas de alumnos;
- contraseña de padres;
- contenido completo del backup;
- todo el estado de `localStorage`;
- historial pedagógico completo;
- grabaciones de voz;
- audio del micrófono;
- información personal adicional que no sea necesaria para administrar
  Aprendalia.

Si en el futuro se amplía el payload, hay que revisar simultáneamente
`telemetry.js`, el Apps Script, la estructura de la hoja y este README.

### 22.7 Relación con `script.js`

`script.js` conserva la función de alto nivel que decide **cuándo**
registrar actividad. La implementación de **cómo** se transmite a Google
está encapsulada en `AprendaliaTelemetry`.

Los renderizadores de ejercicios no deberían hacer `fetch` directamente
a Google. Deben devolver el resultado al flujo común y dejar que el
orquestador registre el evento.

### 22.8 Diagnóstico

Si dejan de aparecer filas en Google Sheets, revisar en este orden:

1.  que el ejercicio termine y produzca un `question_result`;
2.  que `src/data/telemetry.js` se cargue antes de `script.js`;
3.  que el endpoint siga siendo válido;
4.  la consola del navegador por el aviso
    `No se pudo registrar la actividad`;
5.  permisos y despliegue del Google Apps Script;
6.  que el Apps Script siga esperando los ocho nombres de campo
    históricos.

Una caída de telemetría no debe diagnosticarse como pérdida de progreso:
son sistemas independientes.

------------------------------------------------------------------------

## 23. Banco de preguntas, currículo y CSV

El banco activo es `questions.csv`. La estructura curricular separada vive en `curriculum.json`.

### Esquema de `questions.csv`

``` text
id
curso
asignatura
tema
concepto
nivel
tipo
pregunta
opciones
respuesta_correcta
extra
activa
```

- `id`: identidad única e inmutable.
- `curso`: por ejemplo `3EP`.
- `asignatura`: ID de asignatura definido en el currículo.
- `tema`: ID estable del tema.
- `concepto`: ID estable del concepto.
- `nivel`: dificultad interna del concepto; actualmente 1, 2 o 3 en el banco de prueba.
- `tipo`: uno de los tipos que Aprendalia sabe renderizar.
- `pregunta`, `opciones`, `respuesta_correcta`, `extra`: contenido del ejercicio.
- `activa`: `1` permite usar la pregunta; `0` la retira sin borrar su ID ni su histórico.

### `curriculum.json`

El currículo define **curso → asignatura → tema → concepto**, etiquetas visibles, orden, niveles permitidos y tipos de ejercicio autorizados. Los nombres visibles pueden cambiar sin tener que cambiar los IDs internos.

El banco de prueba incluido actualmente contiene sólo `3EP` y cuatro asignaturas: Lengua, Matemáticas, Inglés y Socials. Incluye 8 conceptos, 3 niveles y 2 tipos por concepto. Hay exactamente **10 preguntas por combinación** curso/asignatura/tema/concepto/nivel/tipo: 48 combinaciones y 480 preguntas. Su finalidad es probar la estructura, no representar el contenido definitivo.

Los ficheros `questions_ayer.csv` y `questions_ayer2.csv` se conservan como snapshots históricos y no participan en la carga actual.

------------------------------------------------------------------------

## 24. Carga y validación del contenido

`script.js` carga primero `curriculum.json` y después `questions.csv`. `src/data/content-model.js` parsea el CSV con soporte de campos entrecomillados y valida el banco contra el currículo antes de iniciar sesiones.

Si el CSV contiene errores estructurales o referencias a curso/asignatura/tema/concepto/nivel/tipo no definidos, la carga falla de forma explícita en lugar de dejar que aparezcan ejercicios rotos durante una sesión.

La selección visible de asignaturas se genera dinámicamente a partir del curso del alumno y de las asignaturas que tengan preguntas activas.

Para validar desde Node:

``` bash
node tools/validate-content.js
```

El validador comprueba, entre otras cosas, IDs únicos, columnas obligatorias, referencias al currículo, tipos soportados, niveles permitidos, respuestas incluidas en opciones cuando corresponde, opciones duplicadas y estructura de ejercicios de ordenar/arrastrar/clasificar. En el CSV de prueba también verifica las 10 preguntas por combinación.

Para probar en navegador debe servirse por HTTP/HTTPS, por ejemplo:

``` bash
python3 -m http.server 8000
```

------------------------------------------------------------------------

## 25. Tests

Los tests están en:

``` text
tests/run-tests.js
```

Se ejecutan con Node desde la raíz del proyecto:

``` bash
node tests/run-tests.js
```

La salida esperada es:

``` text
OK - all Aprendalia core tests passed
```

### Qué comprueban actualmente

Entre otras cosas:

- autenticación y curso asignado al alumno;
- migración de almacenamiento v3 → v4;
- parseo y validación del nuevo CSV contra `curriculum.json`;
- 480 preguntas de prueba y 10 por cada una de las 48 combinaciones;
- identidad de progreso basada en ID inmutable;
- conservación de progreso si se corrige el texto manteniendo el ID;
- repetición espaciada;
- puntuación y ayudas;
- selección con diversidad de conceptos;
- agregación de progreso por concepto;
- histórico de sesión con curso;
- exportación/importación de backup.

### Qué NO cubren todavía

Los tests actuales no sustituyen pruebas end-to-end en navegador. No
simulan completamente:

- Safari/iOS real;
- Chrome/Android real;
- arrastre táctil físico;
- reconocimiento de voz real;
- síntesis de voz real;
- permisos de micrófono;
- rendering visual completo;
- comportamiento del Google Apps Script remoto.

Antes de una distribución amplia conviene probar manualmente esos
escenarios.

------------------------------------------------------------------------

## 26. Comprobaciones recomendadas antes de desplegar

Después de cambios de código:

``` bash
node --check script.js
node --check src/config/access-config.js
node --check src/data/storage.js
node --check src/data/progress-repository.js
node --check src/core/scoring-engine.js
node --check src/core/session-engine.js
node --check src/core/question-selector.js
node --check src/ui/progress-view.js
node --check src/exercises/text-exercises.js
node --check src/exercises/audio-exercises.js
node --check src/exercises/interaction-exercises.js
node tests/run-tests.js
```

Además conviene probar manualmente al menos una pregunta de cada tipo de
ejercicio.

------------------------------------------------------------------------

## 27. Lista de tipos a probar manualmente

Checklist rápida después de cambios relevantes:

``` text
[ ] test
[ ] verdadero_falso
[ ] escribir
[ ] completar
[ ] cual_no_encaja
[ ] clasificar
[ ] ordenar
[ ] arrastrar
[ ] listening
[ ] guess
[ ] pronunciar
[ ] hablar
```

Para `ordenar`, probar tanto ratón como táctil.

Para `hablar`, probar un navegador con reconocimiento de voz y otro sin
soporte para verificar el fallback manual.

Para `listening`, comprobar específicamente que el texto objetivo no
aparece antes de responder.

------------------------------------------------------------------------

## 28. Accesibilidad

La interfaz incorpora varias medidas básicas:

- etiquetas `aria-label`/`aria-live` en elementos relevantes;
- feedback anunciado mediante regiones vivas;
- controles con foco visible;
- navegación por teclado en elementos importantes;
- logo de Aprendalia accesible como botón durante una sesión;
- soporte de `prefers-reduced-motion`;
- textos alternativos en imágenes;
- controles suficientemente grandes para interacción táctil.

La accesibilidad todavía puede profundizarse con una auditoría
específica WCAG y pruebas con lectores de pantalla reales.

------------------------------------------------------------------------

## 29. Decisiones de diseño importantes

### Sesiones cortas

Diez preguntas reducen fricción y permiten estudiar con frecuencia sin
que una sesión se perciba como larga.

### Los errores no quitan estrellas

Se evita convertir el error en castigo. El coste pedagógico del error es
romper la racha, reducir recompensa y provocar repaso más cercano.

### Pedir ayuda es mejor que adivinar

Pista y “No lo sé” permiten continuar, pero quedan registrados como
asistencia y reducen la recompensa.

### Cobertura y consolidación deben coexistir

El selector reserva espacio para contenido nuevo sin abandonar preguntas
difíciles o repasos vencidos.

### La Zona de padres no invade el modo infantil

El alumno ve una experiencia centrada en estudiar. Las métricas
detalladas están separadas.

### Restricción de dispositivo opt-in

Una cuenta empieza sin bloqueo por dispositivo. El administrador puede
observar primero y activar después la restricción simplemente rellenando
`devices`.

------------------------------------------------------------------------

## 30. Limitaciones conocidas

### 30.1 El progreso es local al navegador

Aunque existe exportación/importación, no hay sincronización automática
entre dispositivos. Un alumno que use dos dispositivos tendrá históricos
locales separados salvo que se implemente un backend o mecanismo de
sincronización.

### 30.2 Borrar datos del navegador elimina información local

Puede afectar al progreso, estrellas y `deviceId`. Los backups JSON
mitigan el riesgo, pero requieren intervención manual.

### 30.3 Autenticación cliente

Usuarios, contraseñas y dispositivos autorizados están en JavaScript
descargable. Es suficiente para el objetivo informal actual, pero no
para información sensible ni control de acceso fuerte.

### 30.4 APIs de voz variables

El soporte de reconocimiento/síntesis depende del navegador y sistema
operativo.

### 30.5 Identidad de preguntas basada parcialmente en contenido

Cambiar una pregunta puede generar una identidad nueva en el histórico.
Se recomienda introducir IDs inmutables en la futura revisión del banco.

### 30.6 Tests principalmente de núcleo

Falta una suite end-to-end automatizada en navegadores reales.

------------------------------------------------------------------------

## 31. Mantenimiento: tareas habituales

### Añadir un alumno

Editar:

``` text
src/config/access-config.js
```

Añadir usuario, contraseña y `devices: []`.

### Cambiar contraseña de un alumno

Modificar únicamente su campo `password`.

### Restringir un alumno a dispositivos conocidos

Añadir uno o más IDs al array `devices`.

### Volver temporalmente a acceso desde cualquier dispositivo

Vaciar el array:

``` js
devices: Object.freeze([])
```

### Cambiar contraseña de padres

Modificar:

``` js
const PARENT_PASSWORD = '...';
```

### Cambiar tamaño de sesión

Modificar en `script.js`:

``` js
const SESSION_SIZE = 10;
```

Revisar también los textos de interfaz que mencionan “10 preguntas”.

### Cambiar número de intentos

Modificar:

``` js
const MAX_ATTEMPTS = 2;
```

Esta modificación tiene implicaciones en puntuación, feedback y
registro, por lo que debe acompañarse de tests.

------------------------------------------------------------------------

## 32. Cómo añadir un nuevo tipo de ejercicio

Antes de añadir un tipo nuevo, decidir si pertenece a:

``` text
src/exercises/text-exercises.js
src/exercises/audio-exercises.js
src/exercises/interaction-exercises.js
```

El renderizador debería encargarse de la interacción específica, pero
reutilizar siempre que sea posible el circuito común de:

``` text
handleCorrect()
handleError()
finish()
```

Esto garantiza que puntuación, intentos, bloqueo de doble pulsación,
progreso, telemetría, feedback y repetición espaciada sigan siendo
coherentes.

Después hay que:

1.  añadir el `tipo` al dispatcher de `nextQ()`;
2.  añadir una etiqueta en `getExerciseLabel()`;
3.  decidir si el enunciado debe mostrarse u ocultarse;
4.  comprobar Pista/No lo sé;
5.  comprobar dos intentos;
6.  comprobar registro de resultado;
7.  probar móvil y teclado;
8.  añadir tests cuando la lógica sea testeable sin navegador.

------------------------------------------------------------------------

## 33. Convenciones para no romper el histórico

Cuando se empiece a trabajar sobre contenido:

- evitar cambiar IDs existentes sin necesidad;
- idealmente introducir IDs únicos e inmutables;
- no reutilizar el mismo ID para conceptos distintos;
- considerar que cambiar `tipo`, `pregunta` o `respuesta` altera
  actualmente la clave interna;
- mantener nombres de asignatura exactamente coherentes con los valores
  usados por la aplicación;
- validar que `respuesta` sea compatible con `opciones` cuando el tipo
  lo requiera;
- evitar separadores que entren en conflicto con el formato del
  CSV/campos internos.

------------------------------------------------------------------------

## 34. Arquitectura: estado actual y posible evolución

La aplicación ha pasado de un único `script.js` monolítico a una
estructura con responsabilidades separadas. Aun así, `script.js`
continúa siendo el controlador/orquestador principal.

Una futura modularización, si el proyecto sigue creciendo, podría
separar:

``` text
app-controller.js
auth-controller.js
session-controller.js
telemetry.js
```

No es una necesidad crítica en la versión actual. Conviene hacerlo
cuando el crecimiento funcional lo justifique, evitando refactors por sí
mismos.

La evolución arquitectónica más importante a medio plazo sería un
backend opcional para:

- autenticación real;
- sincronización de progreso entre dispositivos;
- gestión de alumnos sin editar JavaScript;
- dispositivos autorizados administrables desde una interfaz;
- backups automáticos;
- estadísticas agregadas para familias/profesor;
- contenido versionado centralmente.

------------------------------------------------------------------------

## 35. Prioridades futuras sugeridas

Con la mecánica actual estabilizada, la siguiente fase prevista es
**contenido**. Algunas prioridades razonables son:

1.  revisar calidad y coherencia del banco;
2.  establecer IDs únicos e inmutables;
3.  estructurar contenido por concepto/competencia, no sólo asignatura;
4.  equilibrar dificultad;
5.  ampliar variedad de preguntas sin duplicar mecánicas
    innecesariamente;
6.  detectar preguntas ambiguas o respuestas incompatibles con opciones;
7.  utilizar el histórico para identificar conceptos, no sólo preguntas,
    que necesitan refuerzo.
------------------------------------------------------------------------

## 36. Resumen técnico rápido

**Telemetría externa:** `src/data/telemetry.js`, compatible con el
payload histórico de Google Sheets y desacoplada del progreso local.

``` text
Tipo de aplicación:       Web estática
Frontend:                 HTML + CSS + JavaScript vanilla
Banco principal:          questions.csv
Currículo:                 curriculum.json
Modelo:                    curso → asignatura → tema → concepto → nivel
Sesión estándar:          10 preguntas
Intentos:                 2
Persistencia:             localStorage
Esquema de progreso:      v4
Migración soportada:      v2/v3 → v4
Histórico máximo:         200 sesiones/usuario
Selección:                Adaptativa y consciente de conceptos
Repetición espaciada:     1, 3, 7, 14, 30, 60 días
Backup:                   Exportar/importar JSON
Login alumno:             Usuario + contraseña + curso asignado
Restricción dispositivo:  Opcional por usuario
Login padres:             Contraseña común
Tests:                    Node, tests/run-tests.js
Validador contenido:       tools/validate-content.js
Telemetría:               Google Apps Script
```

------------------------------------------------------------------------

## 37. Filosofía del proyecto

Aprendalia intenta mantener un equilibrio entre tres objetivos:

**Sencillez para el niño.** Entrar, elegir asignatura y estudiar sin
paneles ni configuraciones innecesarias.

**Información útil para la familia.** Saber qué se ha visto, qué está
dominado, qué cuesta y cómo evoluciona, sin convertir el estudio en
vigilancia constante.

**Arquitectura suficientemente sólida sin sobredimensionarla.** Para un
proyecto compartido informalmente con compañeros de clase, una web
estática permite desplegar y mantener muy rápido. Cuando las necesidades
de seguridad, sincronización o administración superen ese modelo, la
arquitectura deja preparado un camino razonable hacia servicios de
servidor.

------------------------------------------------------------------------

## 38. Nota para futuras sesiones de desarrollo

Antes de modificar Aprendalia:

1.  partir siempre de la última versión desplegada/en repositorio;
2.  ejecutar los tests antes del cambio;
3.  realizar cambios pequeños y localizados;
4.  volver a ejecutar tests;
5.  probar manualmente los tipos afectados;
6.  comprobar `git diff` para identificar archivos realmente
    modificados;
7.  no usar la fecha de modificación del ZIP como sustituto de
    `git diff` o hashes;
8.  evitar modificar los CSV durante cambios puramente técnicos;
9.  actualizar este README cuando cambie una regla importante de
    arquitectura, acceso, puntuación, almacenamiento, aprendizaje, ayuda
    integrada o contrato de telemetría.

Este README describe la versión consolidada de Aprendalia a fecha **13
de septiembre de 2026**.
