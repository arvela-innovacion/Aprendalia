# Question banks

Los CSV de esta carpeta son bloques quincenales de contenido. Los temas y conceptos pueden ser nuevos y no necesitan darse de alta en `curriculum.json`.

Antes de compilar:

```bash
node tools/validate-content.js --file question-banks/mi-bloque.csv
```

La asignatura debe existir en `curriculum.json` para el curso correspondiente y el tipo debe existir en `question-types.json`. La herramienta bloquea duplicados, opciones repetidas y estructuras incompatibles con el tipo.

Para generar el banco final:

```bash
node tools/compile-questions.js
```

El resultado se escribe en `questions.csv`. No se crean asignaturas automáticamente a partir de los bloques.
