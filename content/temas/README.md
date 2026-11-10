# Temas para estudiar

Un archivo por unidad temática del PER: `content/temas/tema-NN.json` (NN = 01…11). `npm run temas` los valida y los publica en `dist/temas/N.json`; la app los carga al abrir el tema.

## Para qué sirven

Para **repasar y aprobar**: después de leer un tema se tiene que poder responder **cualquier pregunta del banco de ese tema**. Ninguna pregunta puede quedar fuera: cada una se asigna al apartado que contiene el dato o la regla que la resuelve, y el validador rechaza el tema si falta alguna.

## Cómo se escriben

- Para alguien que empieza de cero: español de España, claro, frases cortas, tono cercano. Cada término náutico se define la primera vez que aparece.
- Con palabras propias: se sintetiza y se explica el temario, sin copiar párrafos.
- Lo que cae en el examen manda: datos exactos (grados, metros, millas, colores, números de pitadas, plazos, zonas de navegación…) tal como los pregunta el banco. Si varias preguntas insisten en un dato, se destaca.
- Listas y tablas en lugar de párrafos largos cuando hay enumeraciones o comparaciones.
- Cada apartado termina con un bloque `key` y, cuando hay una trampa habitual en las preguntas, un bloque `exam`.
- Solo se interpreta `**negrita**`; el resto del texto se muestra tal cual (sin HTML ni Markdown).

## Formato

```json
{
  "topic": 2,
  "title": "Elementos de amarre y fondeo",
  "minutes": 20,
  "intro": {
    "why": "Por qué importa este tema, en 2-4 frases.",
    "before": ["Idea previa que conviene tener, en una frase."],
    "goals": ["Distinguir noray, bita y cornamusa."]
  },
  "sections": [
    {
      "id": "elementos-de-amarre",
      "title": "Dónde se hace firme un cabo",
      "blocks": [
        { "type": "p", "text": "Texto. Admite **negrita**." },
        { "type": "analogy", "text": "Piensa en… como si fuera…" },
        { "type": "term", "term": "Noray", "text": "Definición sencilla." },
        { "type": "list", "title": "Opcional", "items": ["…", "…"] },
        { "type": "steps", "title": "Opcional", "items": ["Primero…", "Después…"] },
        { "type": "table", "title": "Opcional", "head": ["Elemento", "Dónde está"], "rows": [["Noray", "En el muelle"]] },
        { "type": "example", "title": "Opcional", "text": "Caso práctico." },
        { "type": "exam", "text": "Cómo lo pregunta el test y la trampa típica." },
        { "type": "key", "text": "La idea que hay que llevarse del apartado." }
      ]
    }
  ],
  "summary": ["Idea clave 1", "Idea clave 2"],
  "glossary": [{ "term": "Noray", "text": "…" }],
  "questions": { "id-de-la-pregunta": "elementos-de-amarre" }
}
```

Reglas que comprueba el validador (`node scripts/build-temas.mjs --check content/temas/tema-NN.json`):

- `topic` y `title` coinciden con `dist/bank.json`.
- Los `id` de apartado son únicos, en minúsculas, con letras, números y guiones (no valen `resumen` ni `glosario`).
- Cada bloque es de uno de los tipos anteriores, con texto no vacío; las tablas tienen filas del mismo ancho que la cabecera.
- `questions` contiene **todas** las preguntas del tema en el banco, cada una asignada a un apartado existente, y ninguna de otro tema.

La respuesta que se enseña es siempre la clave del banco. Si el temario la contradice, se explica la clave del banco y se avisa en un bloque `exam` del apartado.
