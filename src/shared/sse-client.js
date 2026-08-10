import { SSE_EVENTS } from './constants.js';

export function connectSSE(url, handlers) {
  const eventSource = new EventSource(url);

  eventSource.addEventListener(SSE_EVENTS.NEW, (e) => {
    handlers.onNew?.(JSON.parse(e.data));
  });

  eventSource.addEventListener(SSE_EVENTS.ACKNOWLEDGED, (e) => {
    handlers.onAcknowledged?.(JSON.parse(e.data));
  });

  eventSource.addEventListener(SSE_EVENTS.RESOLVED, (e) => {
    handlers.onResolved?.(JSON.parse(e.data));
  });

  eventSource.addEventListener(SSE_EVENTS.LOWERED, (e) => {
    handlers.onLowered?.(JSON.parse(e.data));
  });

  eventSource.onopen = () => {
    handlers.onOpen?.();
  };

  eventSource.onerror = () => {
    handlers.onError?.();
  };

  return eventSource;
}
