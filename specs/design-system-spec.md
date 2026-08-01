# Especificación de Diseño UI/UX Pro Max & Impeccable Design System — Sistema "Pure"

**Proyecto**: Pure — Dashboard Académico Multi-Universidad para Doble Ingeniería
**Estilo Visual**: Cyber-Academic Dark Glassmorphism
**Librería & Reglas**: Impeccable Design Rules + Tailwind CSS + Lucide Icons + Google Fonts

---

## 🎨 1. Palette & Token Specs (Sistema de Color HSL / Hex)

```css
:root {
  /* Surface & Backgrounds */
  --bg-app: #070a12;               /* Slate ultra oscuro */
  --bg-card: rgba(15, 23, 42, 0.75);/* Glass Slate con backdrop-blur-xl */
  --bg-card-hover: rgba(30, 41, 59, 0.85);
  --border-glass: rgba(255, 255, 255, 0.08);
  --border-glass-hover: rgba(56, 189, 248, 0.3);

  /* Brand Accents */
  --accent-aeroespacial: #38bdf8;   /* Sky Blue / Cyan (Uni 1 - Aeroespacial) */
  --accent-software: #a855f7;       /* Violet / Purple (Uni 2 - Software) */
  --accent-synergy: #10b981;        /* Emerald Green (Sinergias & Tiempo Libre) */
  --accent-warning: #f59e0b;        /* Amber (Traslapes & Urgencia Media) */
  --accent-danger: #ef4444;         /* Crimson (Conflictos & Entregas Críticas) */

  /* Typography Colors */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
}
```

---

## 🖥️ 2. Especificación Detallada de los 5 Tableros (Dashboards)

### Tablero 1: Command Center (Panel de Control Principal)
- **Header Vivo de Métricas**:
  - Card 1: **Horas Libres Garantizadas esta Semana** (Contador gigante + Progress Ring animado).
  - Card 2: **Dosis Mínima Eficaz (DME) Total** vs. Estudio Realizado.
  - Card 3: **Sinergias Temáticas Activas** (Medidor de horas ahorradas por materias compartidas).
  - Card 4: **Promedio Ponderado** (Ing. Aeroespacial vs. Ing. Software).
- **Widget de Próximas Entregas & Evaluaciones Urgentes**: Lista ordenada por fecha límite con indicador de complejidad y peso %.
- **Widget de Sinergias Temáticas Recomendadas**: Sugerencias de la IA sobre temas equivalentes entre carreras.
- **Mini-Agenda Semanal**: Visualización del bloque de estudio activo hoy.

### Tablero 2: Sinergias & Syllabus (Ejes Temáticos Interactivos)
- **Filtro por Universidad y Asignatura**.
- **Vista de Árbol Jerárquico de Temarios** (`Unidad -> Tema -> Subtema`) con colapso/expansión suave.
- **Badges de Nivel de Dominio**:
  - `no_iniciado`: Slate con borde punteado.
  - `en_estudio`: Amber Neón animado.
  - `repasado`: Cyan Neón.
  - `dominado`: Emerald Neón con check de verificación.
- **Panel de Sinergias Cross-Degree**: Muestra tarjetas comparativas cuando un tema de Aeroespacial es 80%+ similar a un tema de Software, con botón de 1-clic `"Sincronizar Dominio en Ambas Carreras"`.
- **Botón "Ingestar Syllabus con IA"**: Modal con editor donde pegas el PDF o texto del plan de estudios y la IA (MCP) genera el árbol automáticamente.

### Tablero 3: Master Schedule & Conflict Matrix (Calendario Interactivo)
- **Grid Semanal (Lunes a Domingo, 06:00 a 23:00)**:
  - Clases Ing. Aeroespacial: Bloques sólidos Cyan.
  - Clases Ing. Software: Bloques sólidos Violeta.
  - Bloques de Estudio Dinámicos (DME): Bloques translúcidos verde Emerald con borde punteado.
- **Banner de Advertencia de Traslapes**: Alerta en rojo con animación pulso si dos clases o exámenes chocan en horario.

### Tablero 4: Entregas, Evaluaciones & Exámenes Finales (Deliverables Hub)
- **Filtros rápidos**: `Todas`, `Individuales`, `Grupales`, `Parciales / Exámenes Finales`, `Próximos 7 Días`.
- **Tarjeta de Entrega**:
  - Icono distintivo según modalidad (👥 Grupal vs 👤 Individual).
  - Badge de Complejidad (Fácil: Verde, Medio: Amarillo, Alta Complejidad: Rojo).
  - Medidor del Peso % en la nota final.
  - Calculadora de `"Nota Mínima Requerida en las Entregas Restantes"` para alcanzar la nota meta gastando el mínimo esfuerzo.

### Tablero 5: Universidades & Profesores (Directory & Config)
- **CRUD de Universidades**: Formulario modal para nombre, modalidad (`Presencial`, `Virtual`, `Híbrida`), escala min/max, nota aprobatoria y selector de color HSL.
- **CRUD de Profesores**: Registro de nombre, universidad asociada, email, horarios de tutoría y notas/observaciones sobre su estilo de examen.
- **CRUD de Asignaturas**: Asignación de créditos, dificultad (1 a 5), profesor, horario y nota meta.
