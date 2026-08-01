# Módulo 02: Algoritmo de Dosis Mínima Eficaz (DME) y Maximización de Tiempo Libre

**Fichero de especificación modular**: `specs/modules/02-study-hours-algorithm.md`

---

## 🎯 Objetivo
Calcular la **Dosis Mínima Eficaz (DME)** de estudio semanal para cada materia, garantizando que el usuario alcance o mantenga su **Nota Meta** invirtiendo el menor tiempo posible, maximizando el **Tiempo Libre Disponible** para otros proyectos.

---

## 🧮 Lógica de Asignación Horaria Eficiente (DME)

### 1. Horas Base por Créditos
$$H_{\text{base}} = \text{Créditos} \times 1.2 \quad (\text{Ajustado a enfoque de eficiencia})$$

### 2. Factor de Margen de Nota (Seguridad vs. Meta)
Si la materia ya tiene una nota ponderada alta ($\text{Nota Actual} \ge \text{Nota Meta}$), las horas de estudio se **reducen preventivamente**:

$$F_{\text{margen}} = \begin{cases} 
0.6 & \text{si } \text{Nota Actual} \ge \text{Nota Meta} + 0.5 \\
0.8 & \text{si } \text{Nota Actual} \ge \text{Nota Meta} \\
1.0 + (\text{Nota Meta} - \text{Nota Actual}) & \text{si } \text{Nota Actual} < \text{Nota Meta}
\end{cases}$$

### 3. Factor de Descuento por Sinergia Temática
Si la materia comparte ejes temáticos con otra asignatura cursada en el mismo período:

$$F_{\text{sinergia}} = 1.0 - (0.3 \times \text{PorcentajeTemasCompartidos})$$

### 4. Fórmula Final de Dosis Mínima Eficaz ($H_{\text{DME}}$)
$$H_{\text{DME}} = (H_{\text{base}} \times M_{\text{dificultad}} \times F_{\text{margen}} \times F_{\text{sinergia}}) + \text{Urgencia7Días}$$

---

## 📊 Matriz de Tiempo Libre Resultante
El sistema genera un desglose de tiempo semanal de 168 horas:

$$\text{Tiempo Libre Neto} = 168\text{h} - (\text{Horas Clase} + \text{Horas Sueño Estimadas} + \sum H_{\text{DME}})$$

### Métricas Visuales en Dashboard:
1. **Horas Totales de Estudio Requeridas esta Semana** (Mínimo necesario).
2. **Horas Ahorradas por Sinergia de Doble Titulación**.
3. **Tiempo Libre Neto Garantizado para Proyectos Personales**.
