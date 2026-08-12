# Módulo 02: Algoritmo de Dosis Mínima Eficaz (DME) y Maximización de Tiempo Libre

**Fichero de especificación modular**: `specs/modules/02-study-hours-algorithm.md`

---

## 🎯 Objetivo
Calcular la **Dosis Mínima Eficaz (DME)** de estudio semanal para cada materia, garantizando que el usuario alcance o mantenga su **Nota Meta** invirtiendo el menor tiempo posible, maximizando el **Tiempo Libre Disponible** para otros proyectos.

---

## 🧮 Lógica de Asignación Horaria Eficiente (DME)

### 1. Horas Base y Trabajo Independiente por Norma (Decreto 1075 de 2015)
De acuerdo con el Decreto 1075 de 2015 (compilatorio del Decreto 1295 de 2010), 1 crédito académico equivale a **48 horas de trabajo académico por semestre**, repartidas en 16 semanas:

$$H_{\text{norma\_total}} = \text{Créditos} \times 3\text{ h/semana}$$

El trabajo independiente no se asume fijo, sino que se deriva restando las horas de acompañamiento directo (clases presenciales/virtuales sincronizadas del horario real):

$$H_{\text{independiente\_base}} = \max(0, H_{\text{norma\_total}} - H_{\text{clase\_real}})$$

*Ponderación de Horarios*: Las clases agendadas con periodicidad `sabado_a` o `sabado_b` (dictadas cada 2 semanas) ponderan **×0.5** en la suma semanal de acompañamiento directo $H_{\text{clase\_real}}$. Si la universidad desactiva los sábados alternos (`has_alternating_saturdays = false`), se fuerzan como semanales completas.

### 2. Multiplicador de Dificultad
$$M_{\text{dificultad}} = 0.8 + (\text{Dificultad [1..5]} \times 0.1)$$

### 3. Factor de Margen de Nota (Seguridad vs. Meta)
Si la materia ya tiene calificaciones registradas, el factor ajusta la recomendación. Si aún no hay evaluaciones (`current_grade === 0` o sin calificaciones), se aplica una rama neutral de `1.0x`:

$$F_{\text{margen}} = \begin{cases} 
1.0 & \text{si } \text{Nota Actual} = 0 \text{ (rama neutral de inicio)} \\
0.6 & \text{si } \text{Nota Actual} \ge \text{Nota Meta} + 0.5 \text{ (excelente colchón)} \\
0.8 & \text{si } \text{Nota Actual} \ge \text{Nota Meta} \\
1.0 + \min(1.0, \text{Nota Meta} - \text{Nota Actual}) & \text{si } \text{Nota Actual} < \text{Nota Meta} \text{ (cap máximo +1.0x)}
\end{cases}$$

### 4. Factor de Descuento por Sinergia Temática
$$F_{\text{sinergia}} = 1.0 - (0.3 \times \text{PorcentajeTemasCompartidos})$$

### 5. Término de Bonus por Urgencia de Entregables
$$\text{Urgencia7Días} = \text{PesoPorcentajeEvaluacionesPróximas7Días} \times 0.05$$

### 6. Fórmula Final de Dosis Mínima Eficaz ($H_{\text{DME}}$)
$$H_{\text{DME}} = (H_{\text{independiente\_base}} \times M_{\text{dificultad}} \times F_{\text{margen}} \times F_{\text{sinergia}}) + \text{Urgencia7Días}$$

---

## 📊 Matriz de Tiempo Libre Resultante
El sistema calcula el balance semanal a partir de las 168 horas totales:

$$\text{Tiempo Libre Neto} = 168\text{h} - (H_{\text{clase\_real}} + H_{\text{sueño}} [49\text{h}] + H_{\text{independiente\_norma}})$$

*Estado de Sobrecarga*: `calculateNetFreeTime` no recorta el resultado a cero. Si el tiempo demandado excede la capacidad de la semana, $\text{Tiempo Libre Neto} < 0$, visibilizando un déficit real en el Command Center.

