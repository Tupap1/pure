# Módulo 03: Ejes Temáticos (Syllabus) y Motor de Sinergias Temáticas (Cross-Degree Synergies)

**Fichero de especificación modular**: `specs/modules/03-syllabus-ejes-tematicos.md`

---

## 🎯 Objetivo
Permitir la gestión de ejes temáticos por materia y detectar automáticamente **temas duplicados o compartidos entre las dos Ingenierías** (ej. *Matemáticas Especiales, Física III, Programación Orientada a Objetos, Bases de Datos, Métodos Numéricos*). 

Con esto, cuando estudias un tema para una Universidad, automáticamente avanzas en la materia equivalente de la otra Universidad, **reduciendo radicalmente el tiempo de estudio total**.

---

## 🔗 Lógica del Motor de Sinergias (Synergy Engine)

```
       [Carrera 1: Ing. Sistemas (Uni 1)]             [Carrera 2: Ing. Electrónica (Uni 2)]
         Materia: Estructuras de Datos                  Materia: Algoritmos y Programación
                       │                                             │
                       └─── Eje Temático: Árboles y Grafos <─────────┘
                                         │
                                [Detección de Sinergia]
                                         │
                                         ▼
                        Estudias 1 sola sesión de 45 mins
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      Marca como "Dominado" en Uni 1               Marca como "Dominado" en Uni 2
```

## 🛠️ Herramientas MCP para Sinergias Temáticas

1. `find_cross_subject_synergies`:
   - La IA escanea los nombres de unidades y temas de todas las materias de ambas universidades.
   - Retorna una matriz de similitud temática:
     ```json
     {
       "synergies": [
         {
           "topic_uni1": { "subject": "Estructuras de Datos", "topic": "Grafos y Dijkstra" },
           "topic_uni2": { "subject": "Teoría de Redes", "topic": "Algoritmos de Rutas Cortas" },
           "similarity_score": 0.92,
           "recommendation": "Estudiar conjuntamente. 1 sesión cubre ambas materias."
         }
       ]
     }
     ```

2. `sync_topic_mastery_across_degrees`:
   - Al actualizar el estado de dominio de un tema en Uni 1, la IA o el sistema pregunta si se desea propagar al tema enlazado en Uni 2.

## 📊 Medidor de Eficiencia por Sinergia
- Muestra el indicador: **"Horas Ahorradas por Sinergia esta Semana: X horas"**.
- Muestra cuántas horas se eliminaron del calendario gracias a temas compartidos.
