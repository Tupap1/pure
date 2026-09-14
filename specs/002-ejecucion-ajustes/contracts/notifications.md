# Contrato — Correo del reporte y avisos (cambios de la 002)

Complementa `specs/001-modulo-ejecucion/contracts/notifications.md`.

## Avisos en el teléfono

Sin cambios: siguen solo los tres tipos de la 001 (fin de tanda, reporte congelado y fallo de
envío). Retirar una medida de fricción no envía ningún aviso (FR-B20).

## Texto del correo

Cambios en `renderReportText` (`lib/execution/report.ts`). El texto se sigue reconstruyendo solo a
partir del payload congelado (FR-019).

1. **Hábitos (US-B4).** No se listan los hábitos sin días activos en la semana, porque el payload ya
   no los trae.
2. **Aperturas (US-B3).** Va en la misma posición que hoy, después de "Ediciones después del
   cierre":
   - con `aperturas_plan`: `Aperturas del plan: {total}`, y si `con_razon > 0` se agrega
     ` ({con_razon} con razón)`. Por ejemplo, `Aperturas del plan: 3 (1 con razón)` o
     `Aperturas del plan: 0`;
   - sin `aperturas_plan` pero con `plan_openings` (payload congelado antes de la 002):
     `Aperturas del plan: {plan_openings}`, igual que antes.
3. **Fricción (US-B5).** Una línea por cada elemento de `friccion_retiradas`, justo después de la
   línea de aperturas: `Fricción: se retiró "{etiqueta}" por irritación.` Si la lista está vacía o
   no existe, no se agrega nada.

| `measure_key` | Etiqueta |
|---|---|
| `sin_biometria` | sin biometría |
| `clave_larga` | clave larga |
| `escala_grises` | escala de grises |
| `redes_fuera_home` | redes fuera de la pantalla de inicio |
| `app_desinstalada` | app desinstalada |
