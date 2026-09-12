import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';

describe('[001] US4 — Pure en el iPhone', () => {
  it('US4-AS3 · el manifest declara standalone, íconos y colores (FR-030)', () => {
    // Verificar display standalone
    expect(manifest.display).toBe('standalone');

    // Verificar id y scope
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');

    // Verificar colores de fondo y tema
    expect(manifest.background_color).toBe('#191919');
    expect(manifest.theme_color).toBe('#191919');

    // Verificar íconos
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);

    // Verificar que existe icono de 192
    const icon192 = manifest.icons?.find(
      (icon) => icon.sizes?.includes('192') || icon.sizes === '192x192'
    );
    expect(icon192).toBeDefined();
    expect(icon192?.src).toBeDefined();

    // Verificar que existe icono de 512
    const icon512 = manifest.icons?.find(
      (icon) => icon.sizes?.includes('512') || icon.sizes === '512x512'
    );
    expect(icon512).toBeDefined();
    expect(icon512?.src).toBeDefined();

    // Verificar que existe icono maskable
    const maskableIcon = manifest.icons?.find(
      (icon) => icon.purpose?.includes('maskable')
    );
    expect(maskableIcon).toBeDefined();
    expect(maskableIcon?.sizes).toBeDefined();
  });
});
