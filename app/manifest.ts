import type { MetadataRoute } from 'next';

interface ManifestWithId extends MetadataRoute.Manifest {
  id?: string;
}

export default function manifest(): ManifestWithId {
  return {
    name: 'Pure',
    short_name: 'Pure',
    description: 'Sistema de gestión académica multi-universidad para doble ingeniería.',
    start_url: '/',
    display: 'standalone',
    scope: '/',
    id: '/',
    background_color: '#191919',
    theme_color: '#191919',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
