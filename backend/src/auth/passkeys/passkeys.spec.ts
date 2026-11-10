import { ChallengeStore } from './challenge.store';
import { deviceNameFrom } from './device-name';

describe('ChallengeStore', () => {
  it('accepte un défi une seule fois', () => {
    const store = new ChallengeStore();
    store.add('abc');
    expect(store.consume('abc')).toBe(true);
    expect(store.consume('abc')).toBe(false);
  });

  it('lie un défi d’enregistrement à son utilisateur', () => {
    const store = new ChallengeStore();
    store.add('reg', 'u1');
    expect(store.consume('reg', 'u2')).toBe(false);
    store.add('reg2', 'u1');
    expect(store.consume('reg2', 'u1')).toBe(true);
  });

  it('refuse un défi expiré ou inconnu', () => {
    jest.useFakeTimers();
    const store = new ChallengeStore();
    store.add('old');
    jest.advanceTimersByTime(5 * 60_000 + 1);
    expect(store.consume('old')).toBe(false);
    expect(store.consume('jamais-vu')).toBe(false);
    jest.useRealTimers();
  });
});

describe('deviceNameFrom', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', 'iPhone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'Mac (Safari)'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', 'Mac (Chrome)'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', 'Android'],
    ['', 'Appareil'],
  ])('%s → %s', (ua, name) => expect(deviceNameFrom(ua)).toBe(name));
});
