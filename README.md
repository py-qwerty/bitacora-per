# Bitácora PER

Web personal de estudio del **Patrón de Embarcaciones de Recreo**: 1.464 preguntas, 149 tests de origen y 11 temas. App minimalista: una sola columna con navegación inferior en el móvil y diseño a lo ancho en el ordenador. Cada tema se divide en tests de exactamente 10 preguntas, una por pantalla, con respuestas, posición y resultado guardados en el navegador. El último bloque parcial se completa con preguntas del inicio del tema para incluir todo el banco.

## Explicaciones

Al comprobar una respuesta en estudio, y al repasar un simulacro entregado, cada pregunta muestra por qué la opción correcta lo es y por qué no lo son las demás. Las explicaciones se escriben en `explanations/*.json` (`{id: {a, b, c, d, review?}}`) y se unen con:

```sh
python3 scripts/build-explanations.py
```

que valida los IDs y genera `dist/explanations.json`; las preguntas repetidas comparten explicación. `review` marca una solución del banco dudosa y se muestra como aviso. Son explicaciones redactadas con ayuda de IA a partir de la normativa, sin revisión académica.

## Simulacros

45 preguntas aleatorias sin repetición de enunciado/opciones, 90 minutos, 32 aciertos mínimos. Reparto por temas: **4 / 2 / 4 / 2 / 5 / 10 / 2 / 3 / 4 / 5 / 4**. Máximos de errores: Balizamiento 2; Reglamento Internacional para Prevenir los Abordajes 5; Carta de navegación 2; total 13. Las preguntas en blanco cuentan como error. Las opciones conservan su orden original.

[Fuente oficial: Real Decreto 875/2014, anexo II](https://www.boe.es/buscar/act.php?id=BOE-A-2014-10344#ai-2). Verificado el 1 de noviembre de 2026. Examen completo; no implementa la modalidad complementaria para quien tiene el título de Patrón para Navegación Básica.

Los simulacros existen solo en memoria mientras la pestaña siga abierta. El reloj no se pausa en la navegación interna. Cerrar o recargar descarta el intento; se guarda únicamente el resultado final al entregar o agotarse el tiempo. El resultado informa de cada límite, incluso si el total de aciertos bastaría para aprobar.

## Temario para repasar

La pestaña «Temario» reúne las once unidades explicadas para repasar: apartados numerados con definiciones, tablas, pasos, trampas habituales del test e idea clave, resumen y glosario. Se pueden marcar apartados como estudiados y continuar donde se dejó (se guarda en el navegador). Cada apartado lista **las preguntas del banco que se resuelven con él**, para ponerse a prueba al momento: las 1.464 preguntas están asignadas a un apartado y `npm run check` falla si alguna queda fuera.

Los temas se escriben en `content/temas/tema-NN.json` (formato y criterios en `content/temas/README.md`) y se publican con:

```sh
npm run temas
```

Son explicaciones propias redactadas con ayuda de IA a partir del temario y de las preguntas del banco, sin revisión académica. Cuando la clave del banco parece discutible, el tema explica la respuesta del banco y lo avisa.

## En el ordenador

Desde 1024 px de ancho la app usa la pantalla: la navegación pasa a un carril lateral, las listas van a dos columnas, la página de un tema pone el estudio junto a los tests, la práctica muestra la explicación al lado de la pregunta y el tema para estudiar añade un índice fijo de apartados y las preguntas de cada apartado en un panel lateral. En el móvil sigue siendo una sola columna.

## Carta interactiva

Cada pregunta del tema 11 (en tests, simulacros y repasos) tiene un botón que abre la carta L105 de enseñanza del Estrecho de Gibraltar a pantalla completa, con el enunciado a mano. El tema 11 ofrece además una carta de práctica libre. Útiles:

- **Punto**: tocando la carta o por latitud y longitud; muestra su situación.
- **Regla**: recta entre dos puntos con rumbo/demora verdadera, opuesta y distancia; se puede prolongar, invertir o fijar por rumbo y distancia.
- **Demora**: recta desde un punto con un rumbo o demora verdadera (o su opuesta) y distancia opcional.
- **Transportador**: círculo graduado de 360° con el 000° al norte verdadero. Se lleva a un faro o a la situación, se fija en la carta y el ángulo se lee donde la recta corta la graduación.
- **Compás**: compás de puntas. Se abre llevando las dos puntas a la escala de latitudes, se fija la abertura (una longitud sobre el papel), se lleva la punta al centro y se traza el círculo. La abertura también puede escribirse en millas.
- **Imán**: ajusta los toques a puntos, extremos, cruces y al centro del transportador, y alinea las rectas casi N, S, E, W o cuadrantales. Los cruces muestran su situación.
- **12°** (medidas automáticas): al desactivarlo se ocultan rumbos, distancias y coordenadas, para leerlos en el transportador y las escalas como en el examen. La preferencia se guarda en el navegador.

Rumbos y distancias son loxodrómicos sobre la proyección Mercator (1 milla = 1′ de latitud), como al trabajar con transportador y compás sobre el papel. Los trazos de los tests se guardan por pregunta en `localStorage`; los de un simulacro viven en memoria y se descartan con él.

La carta se genera desde el KAP de enseñanza (no incluido en el repositorio) con:

```sh
python3 scripts/build-chart.py /ruta/a/L105_ensenanza_PER.kap   # teselas WebP en dist/assets/chart
python3 scripts/calibrate-chart.py                              # dist/chart-warp.js
```

El segundo script mide la retícula impresa: el escaneo es un mosaico que se aparta hasta 9 px (≈0,1′) de la calibración nominal, y `chart-geo.js` corrige esa deformación con una malla de 2′. Carta de enseñanza, **no válida para la navegación**.

## Ejecutar

Sin dependencias de producción ni compilación:

```sh
npm run dev
```

Abrir http://127.0.0.1:4173. Requiere Python 3 para el servidor local; se puede servir `dist/` desde cualquier servidor estático. La navegación usa fragmentos de URL y funciona sin configurar reescrituras.

```sh
npm run check
```

Las pruebas usan el ejecutor incluido en Node.js. Validan integridad del banco, 1.000 exámenes aleatorios, proporciones, límites de aprobado, blancos, reloj y recuperación de datos corruptos. No hay paquetes que instalar. El manifiesto web permite abrirla con presentación de app desde los navegadores que ofrecen añadir a la pantalla de inicio; no incluye un modo sin conexión.

## Publicación

Código público en [py-qwerty/bitacora-per](https://github.com/py-qwerty/bitacora-per).
Web pública: [Bitácora PER en GitHub Pages](https://py-qwerty.github.io/bitacora-per/).

GitHub Actions comprueba los tests y publica `dist/` automáticamente al subir cambios a `main`. Existe además una copia privada en [Sites](https://bitacora-per-qwerty.codex4coding.chatgpt.site).
Sites sirve `dist/`; `.openai/hosting.json` conserva la identidad del proyecto. Los archivos del repositorio no contienen credenciales. GitHub Pages se actualiza automáticamente con su workflow. La copia de Sites usa su propio flujo con esa identidad y no se actualiza mediante el workflow de GitHub.

## Datos y límites

Banco propio de Boat Málaga exportado el 1 de noviembre de 2026; 8 imágenes originales. Las soluciones son las del banco, sin certificación académica independiente. Se mantienen repeticiones entre tests en estudio. Los ejercicios de carta se resuelven sobre la carta de prácticas del Estrecho de Gibraltar, incluida en la web (véase «Carta interactiva»). No son exámenes oficiales de una convocatoria.

El progreso de los tests de diez y los resultados finales de los simulacros se guardan en `localStorage` del navegador, sin backend, analítica ni sincronización entre dispositivos. Borrar datos del navegador elimina el progreso. Un aviso informa si no es posible guardar. No se publican datos personales ni historial de la academia.

Las fuentes tipográficas Manrope y Barlow Condensed se alojan localmente (SIL Open Font License, véase `FONT-LICENSES/`).
