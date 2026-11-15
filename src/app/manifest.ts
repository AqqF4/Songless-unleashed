import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Glowtune',
    short_name: 'Glowtune',
    description: 'Угадай трек SoundCloud по первым секундам',
    start_url: '/',
    display: 'standalone',
    background_color: '#030806',
    theme_color: '#030806',
    icons: [
      { src: '/api/icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/api/icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
