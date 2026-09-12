// Service worker para avisos push de PURE OS
//
// Este worker maneja dos eventos únicamente:
// 1. Push: recibe el aviso y lo muestra como notificación del sistema.
// 2. Notificationclick: maneja el clic en la notificación.
//
// IMPORTANTE: El evento push SIEMPRE llama a showNotification, incluso si el
// payload es vacío, inválido o no es JSON. Esto es crítico en iOS: si un evento
// push no genera notificación visible, el sistema de Apple revoca la suscripción
// automáticamente, y Andres dejaría de recibir avisos sin enterarse. Usamos valores
// de respaldo para el título y el cuerpo cuando faltan o el JSON no es válido.

self.addEventListener('push', (event) => {
  // Intentar extraer el payload JSON del evento push.
  let notification = {
    title: 'Aviso de Pure',  // valor de respaldo
    body: '',
    tag: undefined,
    url: '/',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      // Si el JSON es válido, usar sus campos. Mantener los respaldos para lo que falte.
      if (data.title) notification.title = data.title;
      if (data.body) notification.body = data.body;
      if (data.tag) notification.tag = data.tag;
      if (data.url) notification.url = data.url;
    } catch {
      // El payload no es JSON válido; usar los valores de respaldo.
      // No lanzar error; mostrar la notificación de todas formas.
    }
  }

  // Mostrar la notificación. El navegador garantiza que el worker
  // no se cierre antes de que esto termine si está envuelto en waitUntil.
  const options = {
    body: notification.body || 'Notificación de Pure',
    tag: notification.tag,
    data: {
      url: notification.url,
    },
  };

  event.waitUntil(self.registration.showNotification(notification.title, options));
});

// Evento notificationclick: el usuario hace clic en la notificación.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  // Buscar una ventana ya abierta de la aplicación.
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Si hay al menos una ventana de la app abierta, enfocarla y navegar si es posible.
        if (windowClients.length > 0) {
          const client = windowClients[0];
          // Intentar navegar; si la ventana está en otro origen, navigate() falla,
          // pero seguimos adelante enfocando la ventana.
          if (client.navigate && typeof client.navigate === 'function') {
            client.navigate(url);
          }
          return client.focus();
        }
        // No hay ventana abierta; abrir una nueva en la URL especificada.
        return clients.openWindow(url);
      })
    );
});
