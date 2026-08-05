# Módulo 05: Arquitectura Local-First y Motor de Sincronización Offline

**Fichero de especificación modular**: `specs/modules/05-local-first-pwa-sync.md`

---

## 🎯 Objetivo
Garantizar que la aplicación funcione al 100% de manera local en el navegador usando IndexedDB (Dexie.js), permitiendo crear, editar y consultar información sin conexión a internet ni dependencia del servidor central, y sincronizando cambios automáticamente con Supabase en cuanto haya conexión.

## 🔄 Flujo de Datos Local-First

```
[Acción del Usuario]
       │
       ▼
[Dexie.js / IndexedDB Local] ─── (Respuesta Instantánea a la UI < 10ms)
       │
       ▼
[Mutation Queue (Tabla SyncQueue local)]
       │
   ¿Hay Red Online?
      ├── Sí ──> [Procesar Queue] ──> [Supabase PostgreSQL (Cloud/Local)]
      └── No ──> [Esperar evento 'online'] ──> [Procesar Queue al reconectar]
```

## 🛠️ Regla de Resolución de Conflictos
Se aplica la estrategia **"Last-Write-Wins" (El cambio más reciente prevalece)** basada en marcas de tiempo UTC (`updated_at`).

## 📱 PWA Service Worker
- Registro de Service Worker para almacenamiento en caché de assets estáticos (HTML, CSS, JS, Fonts, Icons).
- Manifiesto web `manifest.json` configurado para instalación como aplicación nativa de escritorio y móvil.
