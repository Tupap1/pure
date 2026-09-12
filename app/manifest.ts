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
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/192-maskable',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
