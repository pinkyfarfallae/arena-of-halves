export function isTrustedDomEvent(
  event: { nativeEvent?: Event | undefined; isTrusted?: boolean } | Event | null | undefined,
): boolean {
  if (!event) return false;
  if ('isTrusted' in event && typeof event.isTrusted === 'boolean') {
    return event.isTrusted;
  }
  const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : null;
  return !!nativeEvent && nativeEvent.isTrusted === true;
}
