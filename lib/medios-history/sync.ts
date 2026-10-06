// Aviso de "el historial cambió" para refrescar la lista en esta pestaña y en
// las demás abiertas (BroadcastChannel). Sin soporte, solo la pestaña actual.
const CHANNEL = 'gainco:medios-history';
const LOCAL_EVENT = 'gainco:medios-history-changed';

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}

export function notifyHistoryChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCAL_EVENT));
  getChannel()?.postMessage('changed');
}

export function onHistoryChanged(cb: () => void): () => void {
  window.addEventListener(LOCAL_EVENT, cb);
  const ch = getChannel();
  ch?.addEventListener('message', cb);
  return () => {
    window.removeEventListener(LOCAL_EVENT, cb);
    ch?.removeEventListener('message', cb);
  };
}
