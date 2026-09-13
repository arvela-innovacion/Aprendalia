# Aprendalia

Aprendalia es una aplicación web estática de estudio pensada para sesiones cortas, frecuentes y adaptativas. El objetivo actual es que un alumno pueda entrar con sus credenciales, elegir asignatura y completar sesiones de 10 preguntas mientras la aplicación registra su progreso, prioriza contenido nuevo y repasos, aplica repetición espaciada y ofrece a las familias una zona separada de seguimiento.

La aplicación no necesita un backend propio para funcionar: HTML, CSS y JavaScript se ejecutan en el navegador y el banco de preguntas se carga desde `questions.csv`. Esto hace que sea sencilla de desplegar en un hosting estático o repositorio web, pero también implica limitaciones de seguridad y sincronización que se documentan más abajo.

> **Estado de esta versión:** arquitectura y mecánicas de aprendizaje estabilizadas antes de la siguiente fase de trabajo sobre contenido. Incluye acceso individual por alumno, control opcional por dispositivo, Zona de padres, histórico local, selección adaptativa, repetición espaciada, ayudas, puntuación, ejercicios modulares, mejoras móviles y tests del motor.

---

## 1. Experiencia del alumno

El flujo normal es deliberadamente sencillo:

1. El alumno introduce **usuario y contraseña**.
2. Si el usuario tiene dispositivos restringidos, Aprendalia comprueba también el identificador del navegador/dispositivo.
3. El alumno elige una asignatura.
4. Se muestra una preparación de sesión con cobertura y estrellas acumuladas.
5. Empieza una sesión de **10 preguntas** (o menos si la asignatura no dispone de 10).
6. Durante la sesión se muestran estrellas, racha y progreso.
7. Cada pregunta permite, cuando procede, usar **Pista/Ayuda** o **No lo sé**.
8. Tras responder, se ofrece feedback y, cuando hay error, un segundo intento claramente diferenciado.
9. Al terminar se muestra el resumen de la sesión.
10. El progreso de cada pregunta queda guardado para decidir qué conviene estudiar en sesiones posteriores.

Durante una sesión activa, el logo/título **Aprendalia** del encabezado funciona también como salida. Al pulsarlo se pide confirmación antes de abandonar. Las preguntas ya finalizadas conservan su progreso; la pregunta que estaba a medias no cuenta como acierto ni fallo y la sesión incompleta no se guarda como una sesión terminada.

---

## 2. Estructura del proyecto

```text
/
├── index.html
├── style.css
├── script.js
├── girl.png
├── questions.csv
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
│   │   └── progress-repository.js
│   ├── exercises/
│   │   ├── audio-exercises.js
│   │   ├── interaction-exercises.js
│   │   └── text-exercises.js
│   └── ui/
│       └── progress-view.js
└── tests/
    └── run-tests.js
```

### Responsabilidad de cada archivo

**`index.html`** contiene la estructura de la aplicación: cabecera, login, selector de asignatura, preparación de sesión, Zona de padres, área de ejercicio y carga ordenada de módulos JavaScript.

**`style.css`** concentra el sistema visual, responsive, estados de botones, feedback, Zona de padres, ejercicios, animaciones y adaptaciones para móvil. Las microtransiciones respetan `prefers-reduced-motion`.

**`script.js`** actúa como orquestador principal. Gestiona login, navegación, creación y avance de sesiones, HUD, feedback común, intentos, ayudas, registro de resultados, salida de sesión, observabilidad y coordinación de los renderizadores.

**`src/config/access-config.js`** contiene usuarios, contraseñas, dispositivos autorizados, contraseña común de padres y generación/identificación del dispositivo.

**`src/data/storage.js`** encapsula `localStorage`, versiona el esquema y realiza migraciones de versiones anteriores.

**`src/data/progress-repository.js`** almacena y consulta progreso por pregunta, sesiones históricas, estados de dominio, fechas de próximo repaso y copias de seguridad.

**`src/core/question-selector.js`** decide qué preguntas forman una sesión usando cobertura, dificultad y repetición espaciada.

**`src/core/scoring-engine.js`** contiene las reglas de estrellas, rachas y recompensa según intento/ayuda/recuperación.

**`src/core/session-engine.js`** crea el estado de una sesión y lo transforma en un registro histórico al finalizar.

**`src/exercises/*.js`** contiene los renderizadores de ejercicios especializados. La lógica común de sesión permanece fuera de ellos.

**`src/ui/progress-view.js`** construye el panel de seguimiento de la Zona de padres.

**`tests/run-tests.js`** ejecuta tests unitarios/smoke tests del núcleo sin navegador real.

---

## 3. Orden de carga de JavaScript

El orden de los scripts en `index.html` es importante:

```text
src/config/access-config.js
src/data/storage.js
src/data/progress-repository.js
src/core/scoring-engine.js
src/core/session-engine.js
src/core/question-selector.js
src/ui/progress-view.js
src/exercises/text-exercises.js
src/exercises/audio-exercises.js
src/exercises/interaction-exercises.js
script.js
```

Los módulos se exponen actualmente mediante objetos globales en `window`, por lo que un módulo que depende de otro debe cargarse después de él. No reordenar estas etiquetas sin revisar dependencias.

---

## 4. Acceso de alumnos

Las cuentas se administran manualmente en:

```text
src/config/access-config.js
```

El formato actual es:

```js
const STUDENTS = Object.freeze({
  alba: Object.freeze({
    password: 'Alba27',
    devices: Object.freeze([])
  }),
  ana: Object.freeze({
    password: 'Ana42',
    devices: Object.freeze([])
  }),
  sergio: Object.freeze({
    password: 'Sergio58',
    devices: Object.freeze([])
  })
});
```

### Dar de alta un alumno

Añadir una entrada al objeto `STUDENTS`:

```js
lucas: Object.freeze({
  password: 'ClaveElegidaPorElAdministrador',
  devices: Object.freeze([])
})
```

El nombre de usuario se normaliza a minúsculas y sin acentos para el login. La contraseña sí se compara literalmente.

No existe registro público, recuperación de contraseña ni cambio de contraseña por parte del alumno. El administrador decide y conoce las credenciales.

### Seguridad de las credenciales

Aprendalia es una aplicación estática. El navegador necesita descargar `access-config.js`, por lo que una persona con conocimientos técnicos puede inspeccionar el JavaScript y encontrar credenciales y configuración. Este mecanismo está pensado como **control de acceso práctico/casual**, no como autenticación segura de nivel servidor.

Si el proyecto necesitara seguridad real, las contraseñas deberían salir del código cliente y validarse mediante un backend con hashes de contraseña, sesiones y autorización en servidor.

---

## 5. Control opcional usuario-dispositivo

Cada navegador recibe un identificador persistente con formato parecido a:

```text
DEV-AB12-CD34-EF56
```

Se guarda en:

```text
localStorage['aprendalia:device-id']
```

La política está diseñada para permitir un periodo inicial de observación.

### Usuario sin dispositivos configurados

```js
devices: Object.freeze([])
```

Significa: **usuario y contraseña correctos pueden entrar desde cualquier dispositivo**.

Esto permite compartir Aprendalia con la clase, observar durante unas semanas los dispositivos reales y no bloquear a nadie inicialmente.

### Usuario con uno o más dispositivos configurados

```js
devices: Object.freeze([
  'DEV-AB12-CD34-EF56',
  'DEV-7812-90AB-CDEF'
])
```

En cuanto el array contiene al menos un ID, se activa la restricción. Ese alumno sólo puede iniciar sesión desde los dispositivos listados.

Así, compartir únicamente usuario y contraseña con otro niño no basta para entrar desde otro navegador.

### Qué se considera “dispositivo”

El ID identifica realmente una **instalación/navegador**, no el hardware físico de forma criptográfica. Cambiar de navegador, borrar los datos del sitio, navegar en ciertos modos privados o impedir `localStorage` puede producir un ID diferente.

No se realiza fingerprinting invasivo. Además del ID se obtiene una etiqueta aproximada basada en `userAgent`, por ejemplo:

```text
iPad · Safari
Windows · Chrome
Android · Chrome
```

Esta etiqueta sirve para administración/observabilidad, no como factor de seguridad.

---

## 6. Zona de padres

La Zona de padres está separada del flujo infantil y se abre mediante el acceso discreto:

```text
⚙️ Zona de padres
```

La contraseña común se configura también en `src/config/access-config.js`:

```js
const PARENT_PASSWORD = 'Padres2026';
```

En esta versión la contraseña es común para todas las familias.

### Información disponible

Para la asignatura seleccionada, la Zona de padres muestra:

- cobertura del banco: preguntas vistas frente al total;
- porcentaje de cobertura;
- preguntas dominadas;
- preguntas en práctica;
- preguntas con dificultad;
- preguntas todavía sin ver;
- estadísticas de los últimos 7 días;
- evolución de sesiones recientes;
- preguntas que necesitan repaso;
- últimas sesiones, con aciertos y estrellas;
- tabla de preguntas practicadas;
- número de veces presentada cada pregunta;
- porcentaje de acierto;
- estado pedagógico;
- fecha prevista de próximo repaso;
- filtros por estado.

### Backup desde la Zona de padres

El progreso de un usuario puede exportarse a JSON e importarse posteriormente. Esto es importante porque el almacenamiento principal es local al navegador.

El fichero exportado contiene, entre otros datos:

```text
schemaVersion
exportedAt
user
progress
sessions
```

La importación reemplaza el progreso y sesiones locales de ese usuario con los datos del backup importado.

---

## 7. Sesiones de estudio

La constante principal está en `script.js`:

```js
const SESSION_SIZE = 10;
```

Una sesión normal intenta contener 10 preguntas. Si la asignatura tiene menos preguntas disponibles, se utilizan las disponibles.

La pantalla previa indica aproximadamente:

```text
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

Al finalizar, `SessionEngine.toHistory()` genera un registro histórico con inicio, fin, asignatura, total, aciertos, fallos, estrellas, mejor racha y resultados de preguntas.

Una sesión abandonada manualmente no se registra como sesión finalizada.

---

## 8. Selección adaptativa de preguntas

Aprendalia no hace simplemente `shuffle()` y toma diez preguntas. El selector está en:

```text
src/core/question-selector.js
```

Cada pregunta se divide conceptualmente en:

- **sin ver**;
- **repaso vencido con dificultad**;
- **repaso vencido normal**;
- **otras preguntas todavía no vencidas**.

Mientras existan preguntas sin ver, se reserva **al menos aproximadamente la mitad de la sesión** para cobertura nueva.

También se reservan plazas para preguntas difíciles y repasos vencidos. Después se rellenan los huecos según prioridad.

### Factores de prioridad

Entre otros, aumentan la prioridad:

- que el repaso esté vencido;
- que el último resultado haya sido incorrecto;
- que la pregunta esté clasificada como dificultad;
- tener una precisión inferior al 60 %;
- haber aparecido pocas veces;
- llevar muchos días sin verse.

Las preguntas dominadas y todavía no vencidas reciben una penalización fuerte para evitar repetición innecesaria.

Se añade una pequeña componente aleatoria para que dos sesiones no sean siempre idénticas ante puntuaciones equivalentes.

---

## 9. Repetición espaciada

El calendario se gestiona en `src/data/progress-repository.js`.

Para un acierto limpio se utilizan intervalos progresivos:

```text
1 día → 3 días → 7 días → 14 días → 30 días → 60 días
```

Un fallo reinicia la racha de éxito y programa un repaso cercano, normalmente al día siguiente.

Un acierto asistido, un acierto tras más de un intento o una recuperación no avanza tan agresivamente el intervalo. La intención es distinguir entre “lo sabía con soltura” y “he conseguido resolverlo con ayuda”.

Cada registro puede almacenar:

```text
successStreak
intervalDays
dueAt
lastSeen
lastResult
recentResults
```

El selector usa `dueAt` para decidir si una pregunta debe volver a aparecer.

---

## 10. Estados de dominio

Cada pregunta puede estar en uno de cuatro estados:

### ⚪ Sin ver (`new`)

Nunca se ha presentado al alumno.

### 🟡 En práctica (`practice`)

Ya se ha trabajado, pero todavía no cumple criterios de dominio ni dificultad.

### 🔴 Con dificultad (`difficulty`)

Se activa, entre otros casos, cuando hay varios fallos recientes o cuando, después de varias presentaciones, la precisión es inferior al 60 %.

### 🟢 Dominada (`mastered`)

Requiere varias presentaciones, al menos un 80 % de precisión y una racha reciente de éxitos suficiente.

Estos estados son dinámicos: una pregunta dominada puede volver a convertirse en práctica/dificultad si aparecen errores posteriores.

---

## 11. Puntuación y estrellas

Las reglas están centralizadas en:

```text
src/core/scoring-engine.js
```

### Acierto limpio a la primera

```text
+10 estrellas
```

Si la racha limpia es de 3 o más:

```text
+2 estrellas adicionales
```

Por tanto, un acierto limpio durante una racha puede dar 12 estrellas.

### Segundo intento o respuesta asistida

```text
+6 estrellas
```

Se considera asistida cuando se ha usado, por ejemplo:

- pista/ayuda;
- “No lo sé”;
- autoevaluación manual del ejercicio de hablar cuando no existe reconocimiento de voz.

Una respuesta asistida nunca recibe la recompensa máxima de primer intento.

### Pregunta recuperada

Una pregunta reintroducida como repaso tras un fallo y finalmente acertada concede:

```text
+3 estrellas
```

### Fallos

Los fallos no restan estrellas, pero rompen la racha.

### Persistencia de estrellas

Además de las estrellas de la sesión, existe un acumulado por usuario guardado localmente para mostrar progresión a largo plazo.

---

## 12. Intentos, errores y recuperación

La configuración general es:

```js
const MAX_ATTEMPTS = 2;
```

La regla común es:

```text
Primer error → feedback + segundo intento
Segundo error → solución + registro del fallo + posible repaso posterior
```

El segundo intento se presenta visualmente como **“2.º intento”** y la tarjeta cambia de estado para que el alumno entienda que sigue trabajando la misma pregunta.

Los controles se bloquean inmediatamente mientras se procesa una respuesta. Esto evita dobles clics o dobles toques, especialmente en móvil.

Al permitir un reintento, se reactivan los controles necesarios y, en respuestas escritas, el foco vuelve al campo de texto.

---

## 13. Ayudas: Pista y “No lo sé”

Durante las preguntas aparecen dos mecanismos pedagógicos:

```text
💡 Pista / Ayuda
🤔 No lo sé
```

Usar cualquiera de ellos marca la pregunta como asistida. El objetivo es que pedir ayuda sea preferible a responder aleatoriamente, pero que el sistema diferencie ese resultado de un dominio limpio.

La información queda registrada en el histórico mediante campos como:

```text
assisted
hintsUsed
dontKnow
```

Esto permite evolucionar en el futuro hacia métricas más finas de autonomía.

---

## 14. Tipos de ejercicio soportados

El banco actual utiliza 12 tipos.

### `test`

Pregunta de opciones. El alumno pulsa una respuesta y se compara con `respuesta`.

### `verdadero_falso`

Utiliza el flujo de botones de respuesta y la misma validación común que un test.

### `escribir`

Muestra un campo de texto y botón **Comprobar**. La respuesta se normaliza antes de compararse.

### `completar`

Renderizado especializado en `src/exercises/text-exercises.js`.

### `cual_no_encaja`

Ejercicio especializado para identificar el elemento que no pertenece al conjunto.

### `clasificar`

Permite clasificar elementos y utiliza el mismo ciclo común de intentos: primer fallo, segundo intento y, si vuelve a fallar, solución/repaso.

### `ordenar`

Permite ordenar palabras o elementos. Está adaptado a móvil y no depende exclusivamente del drag nativo del navegador.

Además del arrastre, existe interacción por toque: seleccionar un elemento y después otro permite recolocarlo, proporcionando un fallback fiable para Safari/iOS y otros navegadores táctiles.

### `arrastrar`

Ejercicio de emparejamiento/interacción. Los emparejamientos incorrectos consumen intentos de forma coherente con el resto del sistema.

### `listening`

Ejercicio puramente auditivo. El texto objetivo **no se muestra encima del botón de escuchar**; durante la resolución aparece un mensaje genérico como “Escucha con atención”. El texto real sólo debe revelarse cuando corresponda como solución/feedback.

### `guess`

Utiliza el flujo auditivo de listening y mantiene oculto el texto objetivo durante la resolución.

### `pronunciar`

Reproduce audio y permite escribir lo escuchado. La comparación admite tolerancia mediante distancia de edición para pequeñas diferencias.

### `hablar`

Permite escuchar/repetir y, cuando el navegador dispone de reconocimiento de voz, utilizar transcripción para evaluar.

Si `SpeechRecognition` no está disponible, **la sesión nunca queda bloqueada**. Se ofrece un fallback de autoevaluación del tipo **“Ya lo he dicho”**. Ese resultado se marca como asistido/autoevaluado y no recibe la puntuación máxima.

---

## 15. Audio, voz y compatibilidad

Aprendalia utiliza capacidades del navegador como:

- `speechSynthesis` para texto a voz cuando está disponible;
- `SpeechRecognition`/implementaciones compatibles cuando el navegador las ofrece;
- APIs de audio/grabación cuando procede.

Estas APIs no tienen soporte idéntico en todos los navegadores, especialmente en iOS/Safari y navegadores móviles.

La filosofía de la aplicación es **degradación funcional**: si una API avanzada no existe, el alumno debe seguir pudiendo completar la sesión mediante un mecanismo alternativo siempre que sea posible.

El ejercicio `hablar` incluye explícitamente ese fallback para evitar sesiones bloqueadas.

---

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
- animaciones reducidas/desactivadas cuando el sistema solicita `prefers-reduced-motion`;
- diseño responsive de Zona de padres y tablas.

---

## 17. Feedback y transición entre preguntas

El feedback diferencia varios escenarios:

- acierto limpio;
- racha;
- acierto tras ayuda;
- segundo intento recuperado;
- pregunta recuperada después de un fallo anterior;
- error con posibilidad de reintento;
- error definitivo con solución.

Las preguntas nuevas usan una microtransición breve para dar continuidad visual sin ralentizar la sesión.

Las celebraciones grandes se reservan para momentos relevantes, especialmente el final de sesión, evitando confeti excesivo en cada acierto rutinario.

---

## 18. Persistencia local y esquema de datos

El almacenamiento principal usa `localStorage`.

La versión actual del esquema es:

```js
VERSION = 3
```

Las claves administradas por `AprendaliaStorage` utilizan el prefijo:

```text
aprendalia:v3:
```

### Migración

Al iniciar, `storage.js` busca datos con el prefijo anterior:

```text
aprendalia:v2:
```

Si existen y todavía no hay copia v3, los copia al espacio v3 y registra la migración.

La migración no borra automáticamente los datos antiguos.

### Límite de sesiones

Se conservan como máximo:

```text
200 sesiones por usuario
```

---

## 19. Identidad interna de las preguntas

El banco puede contener IDs duplicados. Para evitar que el histórico mezcle dos preguntas distintas, el progreso no usa únicamente `question.id`.

La clave interna combina:

```text
asignatura + id + hash(tipo | pregunta | respuesta)
```

Esto permite convivir con IDs duplicados sin modificar los CSV actuales.

### Limitación importante

Si se cambia sustancialmente el texto, tipo o respuesta de una pregunta, su hash cambia y el sistema puede interpretarla como una pregunta nueva.

Cuando se revise el contenido en profundidad, lo ideal será evolucionar hacia un **ID único, estable e inmutable por pregunta**. Ese ID debería mantenerse aunque se corrija la redacción.

---

## 20. Modelo de progreso por pregunta

Un registro puede incluir campos como:

```text
key
id
subject
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

Esto permite reconstruir no sólo el porcentaje de acierto, sino cómo se está aprendiendo la pregunta y cuándo conviene volver a mostrarla.

---

## 21. Histórico de sesiones

Cada sesión completada contiene aproximadamente:

```text
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

---

## 22. Observabilidad y telemetría

`script.js` contiene actualmente una URL de Google Apps Script:

```js
const GOOGLE_SCRIPT_URL = "...";
```

Se utiliza para enviar eventos/observabilidad del uso. La información puede incluir contexto de la pregunta y, para administración del acceso, datos como:

- usuario;
- `deviceId`;
- etiqueta aproximada del dispositivo/navegador;
- resultado/evento asociado.

Antes de desplegar Aprendalia fuera del entorno previsto, revisar qué datos recibe exactamente el Apps Script, su hoja/destino, permisos y política de conservación.

No debe considerarse este canal un sistema de autenticación seguro.

---

## 23. Banco de preguntas y CSV

El fichero activo de preguntas es:

```text
questions.csv
```

También se conservan actualmente:

```text
questions_ayer.csv
questions_ayer2.csv
```

Durante la fase de arquitectura descrita en este README, estos CSV se han mantenido sin modificaciones deliberadamente. La siguiente fase del proyecto está prevista para centrarse en contenido, temario, calidad, variedad, IDs y estructura pedagógica.

### Asignaturas visibles actualmente

El selector de interfaz incluye:

```text
Lengua
Ingles
Matematicas
Socials
Naturals
Listening
```

La disponibilidad real de preguntas depende del contenido de `questions.csv`.

---

## 24. Carga del CSV

`script.js` carga `questions.csv` mediante `fetch()` y mantiene las preguntas en memoria durante la sesión de la aplicación.

Por este motivo, para probar Aprendalia es recomendable servir el proyecto mediante HTTP/HTTPS y no abrir simplemente `index.html` con `file://`, ya que algunos navegadores bloquean `fetch()` de archivos locales.

Ejemplos de servidor local:

```bash
python3 -m http.server 8000
```

Después abrir:

```text
http://localhost:8000/
```

También puede desplegarse en cualquier hosting estático compatible.

---

## 25. Tests

Los tests están en:

```text
tests/run-tests.js
```

Se ejecutan con Node desde la raíz del proyecto:

```bash
node tests/run-tests.js
```

La salida esperada es:

```text
OK - all Aprendalia core tests passed
```

### Qué comprueban actualmente

Entre otras cosas:

- un usuario con `devices: []` puede entrar desde cualquier dispositivo;
- una contraseña incorrecta sigue bloqueando el acceso;
- migración de almacenamiento v2 → v3;
- primer acierto limpio programa repaso a 1 día;
- segundo acierto limpio amplía a 3 días;
- un fallo devuelve la pregunta a repaso cercano;
- un fallo reinicia la racha de éxito;
- una pista limita la recompensa a 6;
- un primer intento limpio da 10;
- la autoevaluación manual de `hablar` se considera asistida;
- mientras hay suficiente contenido nuevo, al menos la mitad de una sesión seleccionada es contenido sin ver;
- no se seleccionan preguntas duplicadas dentro de la sesión;
- cálculo básico del histórico de sesión;
- exportación/importación de backup.

### Qué NO cubren todavía

Los tests actuales no sustituyen pruebas end-to-end en navegador. No simulan completamente:

- Safari/iOS real;
- Chrome/Android real;
- arrastre táctil físico;
- reconocimiento de voz real;
- síntesis de voz real;
- permisos de micrófono;
- rendering visual completo;
- comportamiento del Google Apps Script remoto.

Antes de una distribución amplia conviene probar manualmente esos escenarios.

---

## 26. Comprobaciones recomendadas antes de desplegar

Después de cambios de código:

```bash
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

Además conviene probar manualmente al menos una pregunta de cada tipo de ejercicio.

---

## 27. Lista de tipos a probar manualmente

Checklist rápida después de cambios relevantes:

```text
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

Para `hablar`, probar un navegador con reconocimiento de voz y otro sin soporte para verificar el fallback manual.

Para `listening`, comprobar específicamente que el texto objetivo no aparece antes de responder.

---

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

La accesibilidad todavía puede profundizarse con una auditoría específica WCAG y pruebas con lectores de pantalla reales.

---

## 29. Decisiones de diseño importantes

### Sesiones cortas

Diez preguntas reducen fricción y permiten estudiar con frecuencia sin que una sesión se perciba como larga.

### Los errores no quitan estrellas

Se evita convertir el error en castigo. El coste pedagógico del error es romper la racha, reducir recompensa y provocar repaso más cercano.

### Pedir ayuda es mejor que adivinar

Pista y “No lo sé” permiten continuar, pero quedan registrados como asistencia y reducen la recompensa.

### Cobertura y consolidación deben coexistir

El selector reserva espacio para contenido nuevo sin abandonar preguntas difíciles o repasos vencidos.

### La Zona de padres no invade el modo infantil

El alumno ve una experiencia centrada en estudiar. Las métricas detalladas están separadas.

### Restricción de dispositivo opt-in

Una cuenta empieza sin bloqueo por dispositivo. El administrador puede observar primero y activar después la restricción simplemente rellenando `devices`.

---

## 30. Limitaciones conocidas

### 30.1 El progreso es local al navegador

Aunque existe exportación/importación, no hay sincronización automática entre dispositivos. Un alumno que use dos dispositivos tendrá históricos locales separados salvo que se implemente un backend o mecanismo de sincronización.

### 30.2 Borrar datos del navegador elimina información local

Puede afectar al progreso, estrellas y `deviceId`. Los backups JSON mitigan el riesgo, pero requieren intervención manual.

### 30.3 Autenticación cliente

Usuarios, contraseñas y dispositivos autorizados están en JavaScript descargable. Es suficiente para el objetivo informal actual, pero no para información sensible ni control de acceso fuerte.

### 30.4 APIs de voz variables

El soporte de reconocimiento/síntesis depende del navegador y sistema operativo.

### 30.5 Identidad de preguntas basada parcialmente en contenido

Cambiar una pregunta puede generar una identidad nueva en el histórico. Se recomienda introducir IDs inmutables en la futura revisión del banco.

### 30.6 Tests principalmente de núcleo

Falta una suite end-to-end automatizada en navegadores reales.

---

## 31. Mantenimiento: tareas habituales

### Añadir un alumno

Editar:

```text
src/config/access-config.js
```

Añadir usuario, contraseña y `devices: []`.

### Cambiar contraseña de un alumno

Modificar únicamente su campo `password`.

### Restringir un alumno a dispositivos conocidos

Añadir uno o más IDs al array `devices`.

### Volver temporalmente a acceso desde cualquier dispositivo

Vaciar el array:

```js
devices: Object.freeze([])
```

### Cambiar contraseña de padres

Modificar:

```js
const PARENT_PASSWORD = '...';
```

### Cambiar tamaño de sesión

Modificar en `script.js`:

```js
const SESSION_SIZE = 10;
```

Revisar también los textos de interfaz que mencionan “10 preguntas”.

### Cambiar número de intentos

Modificar:

```js
const MAX_ATTEMPTS = 2;
```

Esta modificación tiene implicaciones en puntuación, feedback y registro, por lo que debe acompañarse de tests.

---

## 32. Cómo añadir un nuevo tipo de ejercicio

Antes de añadir un tipo nuevo, decidir si pertenece a:

```text
src/exercises/text-exercises.js
src/exercises/audio-exercises.js
src/exercises/interaction-exercises.js
```

El renderizador debería encargarse de la interacción específica, pero reutilizar siempre que sea posible el circuito común de:

```text
handleCorrect()
handleError()
finish()
```

Esto garantiza que puntuación, intentos, bloqueo de doble pulsación, progreso, telemetría, feedback y repetición espaciada sigan siendo coherentes.

Después hay que:

1. añadir el `tipo` al dispatcher de `nextQ()`;
2. añadir una etiqueta en `getExerciseLabel()`;
3. decidir si el enunciado debe mostrarse u ocultarse;
4. comprobar Pista/No lo sé;
5. comprobar dos intentos;
6. comprobar registro de resultado;
7. probar móvil y teclado;
8. añadir tests cuando la lógica sea testeable sin navegador.

---

## 33. Convenciones para no romper el histórico

Cuando se empiece a trabajar sobre contenido:

- evitar cambiar IDs existentes sin necesidad;
- idealmente introducir IDs únicos e inmutables;
- no reutilizar el mismo ID para conceptos distintos;
- considerar que cambiar `tipo`, `pregunta` o `respuesta` altera actualmente la clave interna;
- mantener nombres de asignatura exactamente coherentes con los valores usados por la aplicación;
- validar que `respuesta` sea compatible con `opciones` cuando el tipo lo requiera;
- evitar separadores que entren en conflicto con el formato del CSV/campos internos.

---

## 34. Arquitectura: estado actual y posible evolución

La aplicación ha pasado de un único `script.js` monolítico a una estructura con responsabilidades separadas. Aun así, `script.js` continúa siendo el controlador/orquestador principal.

Una futura modularización, si el proyecto sigue creciendo, podría separar:

```text
app-controller.js
auth-controller.js
session-controller.js
telemetry.js
```

No es una necesidad crítica en la versión actual. Conviene hacerlo cuando el crecimiento funcional lo justifique, evitando refactors por sí mismos.

La evolución arquitectónica más importante a medio plazo sería un backend opcional para:

- autenticación real;
- sincronización de progreso entre dispositivos;
- gestión de alumnos sin editar JavaScript;
- dispositivos autorizados administrables desde una interfaz;
- backups automáticos;
- estadísticas agregadas para familias/profesor;
- contenido versionado centralmente.

---

## 35. Prioridades futuras sugeridas

Con la mecánica actual estabilizada, la siguiente fase prevista es **contenido**. Algunas prioridades razonables son:

1. revisar calidad y coherencia del banco;
2. establecer IDs únicos e inmutables;
3. estructurar contenido por concepto/competencia, no sólo asignatura;
4. equilibrar dificultad;
5. ampliar variedad de preguntas sin duplicar mecánicas innecesariamente;
6. detectar preguntas ambiguas o respuestas incompatibles con opciones;
7. utilizar el histórico para identificar conceptos, no sólo preguntas, que necesitan refuerzo.

Una futura estructura conceptual podría permitir algo como:

```text
Matemáticas
└── Multiplicación
    └── Tabla del 7
```

Así la Zona de padres podría decir “necesita reforzar la tabla del 7” en lugar de limitarse a listar IDs concretos de preguntas.

---

## 36. Resumen técnico rápido

```text
Tipo de aplicación:       Web estática
Frontend:                 HTML + CSS + JavaScript vanilla
Banco principal:          questions.csv
Sesión estándar:          10 preguntas
Intentos:                 2
Persistencia:             localStorage
Esquema de progreso:      v3
Migración soportada:      v2 → v3
Histórico máximo:         200 sesiones/usuario
Selección:                Adaptativa
Repetición espaciada:     1, 3, 7, 14, 30, 60 días
Backup:                   Exportar/importar JSON
Login alumno:             Usuario + contraseña
Restricción dispositivo:  Opcional por usuario
Login padres:             Contraseña común
Tests:                    Node, tests/run-tests.js
Telemetría:               Google Apps Script
```

---

## 37. Filosofía del proyecto

Aprendalia intenta mantener un equilibrio entre tres objetivos:

**Sencillez para el niño.** Entrar, elegir asignatura y estudiar sin paneles ni configuraciones innecesarias.

**Información útil para la familia.** Saber qué se ha visto, qué está dominado, qué cuesta y cómo evoluciona, sin convertir el estudio en vigilancia constante.

**Arquitectura suficientemente sólida sin sobredimensionarla.** Para un proyecto compartido informalmente con compañeros de clase, una web estática permite desplegar y mantener muy rápido. Cuando las necesidades de seguridad, sincronización o administración superen ese modelo, la arquitectura deja preparado un camino razonable hacia servicios de servidor.

---

## 38. Nota para futuras sesiones de desarrollo

Antes de modificar Aprendalia:

1. partir siempre de la última versión desplegada/en repositorio;
2. ejecutar los tests antes del cambio;
3. realizar cambios pequeños y localizados;
4. volver a ejecutar tests;
5. probar manualmente los tipos afectados;
6. comprobar `git diff` para identificar archivos realmente modificados;
7. no usar la fecha de modificación del ZIP como sustituto de `git diff` o hashes;
8. evitar modificar los CSV durante cambios puramente técnicos;
9. actualizar este README cuando cambie una regla importante de arquitectura, acceso, puntuación, almacenamiento o aprendizaje.

Este README describe la versión consolidada de Aprendalia a fecha **13 de septiembre de 2026**.
