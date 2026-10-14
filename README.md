# Ruta Git

Curso interactivo de Git para todo público. Se aprende escribiendo comandos en una terminal de práctica
y viendo cómo crece el mapa del proyecto (cada commit es una estación, cada rama es una línea).

## Cómo verlo

```bash
npm install
npm run dev
```

Abre http://localhost:5173 en el navegador.

## Otros comandos

| Comando | Para qué sirve |
| --- | --- |
| `npm test` | Corre las pruebas del simulador y recorre todos los capítulos y misiones con su solución |
| `npm run build` | Genera la versión lista para publicar en `dist/` |
| `npm run preview` | Prueba esa versión localmente |

## Contenido

**10 paradas guiadas** (explicación, sugerencias y pistas):

1. ¿Qué es Git?
2. Tu primer repositorio
3. Viajar en el tiempo
4. Ramas
5. Conflictos
6. Trabajar en equipo
7. GitHub y pull requests
8. Deshacer errores
9. Buenas prácticas
10. Reto final

**4 misiones sin ayuda** (historia, objetivos, giros inesperados y hasta 3 estrellas):

- M1 El archivo fugitivo
- M2 Dos cocineros, una receta
- M3 Rescate en la nube
- M4 El gran lanzamiento

## Cómo está armado

- `src/engine/`: el simulador de Git (commits, ramas, fusiones, conflictos, remoto, stash, etiquetas).
- `src/engine/scenario.ts`: ayudas para preparar escenarios (compañeros que suben cambios, ramas ajenas).
- `src/course/chapters/`: las paradas. Cada paso tiene su objetivo, su explicación y su solución (para las pruebas).
- `src/course/missions.tsx`: las misiones con sus objetivos y giros.
- `src/components/`: lo que se ve en pantalla (mapa, zonas, terminal, editor, lección, misión).

## Agregar un capítulo o misión

1. Crea el archivo en `src/course/chapters/` (o agrega la misión en `missions.tsx`).
2. Regístralo en `src/course/index.ts`.
3. Corre `npm test`: la prueba comprueba que cada paso se cumple con su `solution` y que ninguno
   viene resuelto de antemano.
