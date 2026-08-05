# Especificación SDD — Arquitectura & Experiencia Mobile-First

**Proyecto**: Pure — Sistema de Gestión Académica Multi-Universidad
**Metodología**: Spec-Driven Development (SDD) & Test-Driven Development (TDD)
**Objetivo**: Garantizar el uso cómodo, intuitivo y responsivo en smartphones (pantallas angostas `< 640px`) y tablets.

---

## 📱 1. Breakpoints & Layout Adaptativo

| Breakpoint | Ancho Pantalla | Navegación | Vista de Master Schedule | Diálogos/Modales |
|---|---|---|---|---|
| **Mobile (`sm`)** | `< 640px` | `BottomNav` fija inferior (5 pestañas) | Selector por Día (Lunes..Domingo) + Agenda vertical | Pantalla Completa / Drawer inferior |
| **Tablet (`md`)** | `640px - 1024px` | `Sidebar` lateral compacto (64px) | Grid Semanal Scrollable | Modal Centrado Adaptable |
| **Desktop (`lg`)** | `> 1024px` | `Sidebar` lateral completo (256px) | Grid Semanal Completo | Modal Centrado Estándar |

---

## 👆 2. Ergonomía Táctil & Usabilidad

1. **Touch Targets**:
   - Todo botón, pestaña, chip o control interactivo debe tener un área táctil mínima de **44x44px** (`min-h-[44px] min-w-[44px]`).
   - Margen mínimo entre elementos interactivos: **8px**.

2. **Navegación Móvil (Bottom Navigation Bar)**:
   - Fija en `position: fixed; bottom: 0; left: 0; right: 0; z-index: 40`.
   - Contiene 5 accesos directos: `Command`, `Syllabus`, `Schedule`, `Deliverables`, `Config`.
   - Indicador de estado activo con brillo cyan/violeta neón.
   - Padded bottom dinámico en el Shell (`pb-20 md:pb-6`) para evitar tapar contenido.

3. **Master Schedule Móvil**:
   - Pestañas de días de la semana con badge indicador de número de clases en el día.
   - Formato de tarjeta de agenda con horario, asignatura, aula y tag de traslape en rojo.

---

## 🛡️ 3. Reglas de Validación de Datos (Zod Validation Engine)

1. **Universidad (`UniversitySchema`)**:
   - `name`: No vacío (mín 2 caracteres).
   - `scale_min`: Número `>= 0`.
   - `scale_max`: Número `> scale_min`.
   - `passing_grade`: Número entre `scale_min` y `scale_max`.

2. **Profesor (`ProfessorSchema`)**:
   - `name`: No vacío (mín 2 caracteres).
   - `email`: Formato de email válido opcional/requerido si no está vacío.

3. **Asignatura (`SubjectSchema`)**:
   - `name`: No vacío.
   - `code`: No vacío (ej. "AERO-101").
   - `credits`: Entero positivo `>= 1` y `<= 30`.
   - `difficulty`: Entero de 1 a 5.
   - `target_grade`: Número dentro del rango min/max de su Universidad asociada.

4. **Horario de Clase (`ScheduleSchema`)**:
   - `start_time`: Formato `HH:mm` (00:00 a 23:59).
   - `end_time`: Formato `HH:mm`, estrictamente posterior a `start_time`.
   - `day_of_week`: Entre 1 (Lunes) y 7 (Domingo).

5. **Entrega / Parcial (`DeliverableSchema`)**:
   - `title`: No vacío.
   - `weight_percentage`: Número `> 0` y `<= 100`.
   - `grade`: Opcional, pero si existe debe estar dentro del rango min/max de la universidad.

6. **Eje Temático (`SyllabusTopicSchema`)**:
   - `title`: No vacío.
   - `order_index`: Entero `>= 0`.
