import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, HOME_TAB } from '../../lib/navigation';

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  it('US1-AS9 · Hoy es la primera pantalla; en el teléfono la barra inferior no incluye Configuración', () => {
    expect(HOME_TAB).toBe('hoy');
    expect(NAV_ITEMS[0].id).toBe('hoy');

    // BottomNav filtra por `mobile !== false`: Configuración sale de la barra inferior (FR-041)
    // y se abre desde el encabezado en su lugar.
    const mobileItems = NAV_ITEMS.filter((item) => item.mobile !== false);
    expect(mobileItems.map((item) => item.id)).not.toContain('config');
    expect(mobileItems[0].id).toBe('hoy');

    const configItem = NAV_ITEMS.find((item) => item.id === 'config');
    expect(configItem?.mobile).toBe(false);
  });
});
