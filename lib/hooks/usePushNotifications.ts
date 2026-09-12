import { useCallback, useEffect, useState } from 'react';

// Hook de avisos push (US7, FR-033). El permiso del navegador solo se pide como respuesta a un
// gesto del usuario: subscribe() se llama desde un onClick (ConfigDashboard, TodayDashboard),
// nunca desde un efecto. En iOS, Safari solo expone el Push API dentro de la app instalada en la
// pantalla de inicio (navigator.standalone); fuera de ahí, el estado queda en
// 'instalar_en_inicio' y no se intenta nada más (spec.md, edge case "¿El iPhone no tiene Pure
// instalado?").

export type PushState = 'no_soportado' | 'instalar_en_inicio' | 'denegado' | 'activable' | 'activo';

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isIOSDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  // navigator.standalone es la propiedad no estándar de Safari en iOS; display-mode: standalone
  // cubre el resto (Chrome/Android, escritorio).
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/** VAPID entrega la clave pública en base64url; PushManager.subscribe espera un Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64Safe);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('no_soportado');
  const [isBusy, setIsBusy] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const evaluate = useCallback(async (reg: ServiceWorkerRegistration | null) => {
    if (!isSupported()) {
      setState('no_soportado');
      return;
    }
    if (isIOSDevice() && !isStandaloneDisplay()) {
      setState('instalar_en_inicio');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denegado');
      return;
    }
    const subscription = reg ? await reg.pushManager.getSubscription() : null;
    setState(subscription && Notification.permission === 'granted' ? 'activo' : 'activable');
  }, []);

  useEffect(() => {
    if (!isSupported()) {
      setState('no_soportado');
      return;
    }
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        setRegistration(reg);
        return evaluate(reg);
      })
      .catch(() => setState('no_soportado'));
  }, [evaluate]);

  // FR-033: el permiso solo se pide como respuesta a un gesto — este método existe para llamarse
  // desde un onClick, nunca desde un efecto.
  const subscribe = useCallback(async () => {
    if (!registration) return;
    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await evaluate(registration);
        return;
      }

      const keyResponse = await fetch('/api/push/public-key');
      const { key } = await keyResponse.json();
      if (!key) {
        await evaluate(registration);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.x + lib.dom más reciente tipan Uint8Array como genérico sobre ArrayBufferLike, que
        // ya no coincide exactamente con el BufferSource que pide applicationServerKey; el valor
        // en tiempo de ejecución es válido (un Uint8Array normal), así que el cast es seguro.
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      await evaluate(registration);
    } finally {
      setIsBusy(false);
    }
  }, [registration, evaluate]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setIsBusy(true);
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      await evaluate(registration);
    } finally {
      setIsBusy(false);
    }
  }, [registration, evaluate]);

  const sendTest = useCallback(async () => {
    await fetch('/api/push/test', { method: 'POST' });
  }, []);

  return { state, isBusy, subscribe, unsubscribe, sendTest };
}
