# Módulo 04: Calendario Interactivo y Detector de Traslapes de Horario

**Fichero de especificación modular**: `specs/modules/04-schedule-conflict-calendar.md`

---

## 🎯 Objetivo
Proporcionar una vista unificada de la agenda semanal de ambas universidades, destacando instantáneamente conflictos de horario entre instituciones y sugerencias de bloques de estudio generados por el algoritmo o la IA.

## ⚠️ Detección Algorítmica de Traslapes
Dos eventos de clase $E_1$ y $E_2$ presentan un conflicto si:

1. $E_1.\text{day\_of\_week} == E_2.\text{day\_of\_week}$
2. $\max(E_1.\text{start\_time}, E_2.\text{start\_time}) < \min(E_1.\text{end\_time}, E_2.\text{end\_time})$
3. $E_1.\text{university\_id} \neq E_2.\text{university\_id}$ (O entre dos materias de la misma universidad).

## 🎨 Representación Visual en el Calendario
- **Clases Universidad A**: Bloques con borde sólido del color primario de la Universidad A.
- **Clases Universidad B**: Bloques con borde sólido del color primario de la Universidad B.
- **Traslape / Solapamiento**: Banner de advertencia en rojo brillante con patrón de rayas y mensaje `"⚠️ CONFLICTO DE HORARIO MULTI-UNIVERSIDAD"`.
- **Bloques de Estudio Dinámicos**: Bloques traslúcidos punteados etiquetados con el logo de IA o el ícono de estudio.
