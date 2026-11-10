/** Nom lisible de l'appareil, déduit du navigateur : « iPhone », « Mac (Safari) »… */
export function deviceNameFrom(userAgent = ''): string {
  const ua = userAgent.toLowerCase();
  const device = ua.includes('iphone')
    ? 'iPhone'
    : ua.includes('ipad')
      ? 'iPad'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('mac os')
          ? 'Mac'
          : ua.includes('windows')
            ? 'Windows'
            : ua.includes('linux')
              ? 'Linux'
              : 'Appareil';
  if (device === 'iPhone' || device === 'iPad' || device === 'Android') return device;
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('firefox')
      ? 'Firefox'
      : ua.includes('chrome')
        ? 'Chrome'
        : ua.includes('safari')
          ? 'Safari'
          : '';
  return browser ? `${device} (${browser})` : device;
}
