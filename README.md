# Bitácora PER

Web personal de estudio del **Patrón de Embarcaciones de Recreo**: 1.464 preguntas, 149 tests de origen y 11 temas. App móvil minimalista de una sola columna, con navegación inferior. Cada tema se divide en tests de exactamente 10 preguntas, una por pantalla, con respuestas, posición y resultado guardados en el navegador. El último bloque parcial se completa con preguntas del inicio del tema para incluir todo el banco.

## Simulacros

45 preguntas aleatorias sin repetición de enunciado/opciones, 90 minutos, 32 aciertos mínimos. Reparto por temas: **4 / 2 / 4 / 2 / 5 / 10 / 2 / 3 / 4 / 5 / 4**. Máximos de errores: Balizamiento 2; Reglamento Internacional para Prevenir los Abordajes 5; Carta de navegación 2; total 13. Las preguntas en blanco cuentan como error. Las opciones conservan su orden original.

[Fuente oficial: Real Decreto 875/2014, anexo II](https://www.boe.es/buscar/act.php?id=BOE-A-2014-10344#ai-2). Verificado el 1 de noviembre de 2026. Examen completo; no implementa la modalidad complementaria para quien tiene el título de Patrón para Navegación Básica.

Los simulacros existen solo en memoria mientras la pestaña siga abierta. El reloj no se pausa en la navegación interna. Cerrar o recargar descarta el intento; se guarda únicamente el resultado final al entregar o agotarse el tiempo. El resultado informa de cada límite, incluso si el total de aciertos bastaría para aprobar.

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

Fuente privada en [py-qwerty/bitacora-per](https://github.com/py-qwerty/bitacora-per).
Web privada en [Bitácora PER](https://bitacora-per-qwerty.codex4coding.chatgpt.site).
Sites sirve `dist/`; `.openai/hosting.json` conserva la identidad del proyecto. Los archivos del repositorio no contienen credenciales. Para futuros despliegues usar el flujo de Sites con esa identidad; subir cambios a GitHub por sí solo no publica automáticamente en Sites.

## Datos y límites

Banco propio de Boat Málaga exportado el 1 de noviembre de 2026; 8 imágenes originales. Las soluciones son las del banco, sin certificación académica independiente. Se mantienen repeticiones entre tests en estudio. Los ejercicios de carta pueden requerir carta de prácticas del Estrecho de Gibraltar y útiles de trazado; la web no sustituye ese material. No son exámenes oficiales de una convocatoria.

El progreso de los tests de diez y los resultados finales de los simulacros se guardan en `localStorage` del navegador, sin backend, analítica ni sincronización entre dispositivos. Borrar datos del navegador elimina el progreso. Un aviso informa si no es posible guardar. No se publican datos personales ni historial de la academia.

Las fuentes tipográficas Manrope y Barlow Condensed se alojan localmente (SIL Open Font License, véase `FONT-LICENSES/`).
