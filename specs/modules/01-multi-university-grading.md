# Módulo 01: Multi-Universidad y Sistema de Calificación Ponderada

**Fichero de especificación modular**: `specs/modules/01-multi-university-grading.md`

---

## 🎯 Objetivo
Permitir al usuario administrar 2 o más universidades en simultáneo, ajustando la escala de notas de cada una y calculando automáticamente la nota actual ponderada en función del peso porcentual (%) de las entregas calificadas.

## 📐 Entidades de Datos
* `University`: `{ id, name, scale_min, scale_max, passing_grade, color }`
* `Subject`: `{ id, university_id, name, code, credits, difficulty, target_grade, current_grade }`
* `Deliverable`: `{ id, subject_id, title, due_date, weight_percentage, grade, status }`

## 🧮 Lógica de Cálculo de Calificación
Para cada materia $s$:

$$\text{Nota Actual}(s) = \frac{\sum_{i \in \text{Calificados}} (\text{Grade}_i \times \text{Weight}_i)}{\sum_{i \in \text{Calificados}} \text{Weight}_i}$$

$$\text{Porcentaje Evaluado Tot.}(s) = \sum_{i \in \text{Calificados}} \text{Weight}_i$$

$$\text{Nota Mínima Requerida en Entregas Restantes}(s) = \frac{\text{PassingGrade}(u) - \sum (\text{Grade}_i \times \text{Weight}_i)}{100 - \text{Porcentaje Evaluado Tot.}(s)}$$

## 🖥️ Requisitos de UI
- Tarjetas superiores por Universidad con badge de color personalizado.
- Indicador visual tipo velocímetro/barra de progreso con la relación entre **Nota Actual**, **Nota Mínima de Aprobación** y **Nota Meta**.
- Alerta visual en color rojo si la nota requerida en el resto del semestre supera la nota máxima posible de la escala.
