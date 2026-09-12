# Aprendalia

Aplicación web familiar de estudio con sesiones cortas, puntuación motivadora, repaso inteligente e histórico de progreso.

## Ejecutar

Sirve esta carpeta con un servidor web local (por ejemplo, Live Server) y abre `index.html`. La aplicación carga `questions.csv` mediante `fetch`, por lo que no conviene abrirla directamente con `file://`.

## Arquitectura

- `script.js`: coordinación de la aplicación, navegación, sesión y observabilidad.
- `src/core/session-engine.js`: estado y cierre de sesiones.
- `src/core/scoring-engine.js`: estrellas, rachas y recompensas.
- `src/core/question-selector.js`: selección de preguntas y planificación de repaso.
- `src/data/storage.js`: almacenamiento versionado y migraciones.
- `src/data/progress-repository.js`: histórico por pregunta, sesiones y copias de seguridad.
- `src/ui/progress-view.js`: Zona de padres.
- `src/exercises/text-exercises.js`: completar, clasificar y cuál no encaja.
- `src/exercises/audio-exercises.js`: listening, pronunciación y speaking.
- `src/exercises/interaction-exercises.js`: ordenar y relacionar.
- `tests/run-tests.js`: pruebas automáticas del núcleo.

## Selección y repaso

Las sesiones siguen teniendo 10 preguntas, pero ya no se eligen al azar. Mientras existan preguntas sin ver, se reserva aproximadamente la mitad de cada sesión para cobertura nueva. El resto se reparte entre preguntas vencidas, falladas o con dificultad y repaso de mantenimiento.

Después de cada respuesta se calcula cuándo conviene volver a verla. Los aciertos limpios espacian progresivamente el próximo repaso (1, 3, 7, 14, 30 y 60 días). Los errores y respuestas con ayuda vuelven antes.

## Histórico

Se registra por pregunta: veces vista, intentos, aciertos, errores, ayudas, pistas, `No lo sé`, recuperaciones, tiempo, estado de dominio, última fecha y próximo repaso. También se guardan hasta 200 sesiones.

El almacenamiento actual usa `localStorage` con esquema v3. Al abrir esta versión se migran automáticamente los datos v2 existentes. La Zona de padres permite exportar e importar una copia JSON del progreso.

## Puntuación

- Primer intento limpio: +10 ⭐
- Primer intento limpio con racha ≥ 3: +12 ⭐
- Segundo intento o respuesta con ayuda: +6 ⭐
- Pregunta recuperada durante el repaso: +3 ⭐
- Los errores no restan estrellas.

## Ayudas

Cada pregunta ofrece `Pista/Ayuda` y `No lo sé`. Usarlas evita que una respuesta se considere un acierto limpio y limita la recompensa a la categoría de respuesta con ayuda.

## Pruebas

Con Node.js instalado:

```bash
node tests/run-tests.js
```

Las pruebas cubren migración de almacenamiento, repetición espaciada, selección con cobertura, puntuación con ayudas, sesiones y exportación/importación de progreso.


## Acceso de alumnos y familias

Los alumnos ya no comparten una contraseña. Sólo pueden entrar los usuarios dados de alta previamente en `src/config/access-config.js`, donde cada alumno tiene su propia combinación de usuario + contraseña.

Ejemplo:

```js
const STUDENTS = Object.freeze({
  alba: 'Alba27',
  ana: 'Ana42',
  sergio: 'Sergio58',
  // lucia: 'Lucia83',
});
```

Para añadir un compañero basta con incorporar una línea y volver a publicar la web. Los usuarios deben escribirse en minúsculas y sin tildes en el archivo; en la pantalla de acceso la aplicación normaliza mayúsculas y tildes automáticamente. No existe usuario invitado ni contraseña infantil común.

La Zona de padres mantiene una única contraseña común (`Padres2026`), también definida en `src/config/access-config.js`.

Como Aprendalia sigue siendo una web estática, esta protección está pensada para evitar accesos casuales. Las credenciales forman parte del código que descarga el navegador y no sustituyen a una autenticación con servidor.

## Acceso por alumno + dispositivo opcional

Cada alumno necesita siempre usuario y contraseña. La restricción por dispositivo es opcional y se activa sólo cuando tú quieras.

La configuración está en `src/config/access-config.js`:

```js
maria: {
  password: 'Sol39',
  devices: []
}
```

Con `devices: []`, María puede entrar desde cualquier dispositivo si conoce su usuario y contraseña. El identificador y la descripción básica del dispositivo siguen enviándose con la telemetría para que puedas observar qué equipos utiliza durante las primeras semanas.

Cuando quieras restringirla, rellena el array:

```js
maria: {
  password: 'Sol39',
  devices: ['DEV-AB12-CD34-EF56', 'DEV-7812-90AB-CDEF']
}
```

Desde ese momento María sólo podrá entrar desde esos dispositivos. Si intenta acceder desde otro, Aprendalia mostrará el nuevo código para que decidas si quieres añadirlo.

Si se borra el almacenamiento del navegador, se usa otro navegador o se cambia de dispositivo, se generará un código nuevo. Esto sólo será bloqueante para alumnos cuyo array `devices` ya tenga al menos un código.

La telemetría existente envía también `device_key` (el código autorizado) y `device_info` (descripción básica, por ejemplo `iPad · Safari`) al Google Apps Script. No se utiliza fingerprinting invasivo.

La contraseña común de la Zona de padres sigue siendo `Padres2026`.
