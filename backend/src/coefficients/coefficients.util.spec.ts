import {
  TOTAL_BP,
  equalShares,
  normalizeShares,
  sumBp,
  withNewMember,
  withoutMember,
} from './coefficients.util';

const bp = (userId: string, shareBp: number) => ({ userId, shareBp });

describe('equalShares', () => {
  it('répartit 100 % équitablement', () => {
    expect(sumBp(equalShares(['a', 'b', 'c', 'd']))).toBe(TOTAL_BP);
    expect(equalShares(['a', 'b'])).toEqual([bp('a', 5000), bp('b', 5000)]);
  });

  it('tombe juste même quand 100 % n\'est pas divisible', () => {
    const shares = equalShares(['a', 'b', 'c']);
    expect(sumBp(shares)).toBe(TOTAL_BP);
    expect(shares.map((s) => s.shareBp).sort()).toEqual([3333, 3333, 3334]);
  });
});

describe('normalizeShares', () => {
  it('ramène toujours le total à 100 %', () => {
    const shares = normalizeShares([bp('a', 300), bp('b', 100), bp('c', 100)]);
    expect(sumBp(shares)).toBe(TOTAL_BP);
    expect(shares).toEqual([bp('a', 6000), bp('b', 2000), bp('c', 2000)]);
  });

  it('conserve les proportions', () => {
    const shares = normalizeShares([bp('a', 2), bp('b', 1)]);
    expect(shares[0].shareBp / shares[1].shareBp).toBeCloseTo(2, 2);
  });

  it('respecte les coefficients à 0 (licorne exclue de la catégorie)', () => {
    const shares = normalizeShares([bp('a', 5000), bp('b', 5000), bp('c', 0)]);
    expect(shares.find((s) => s.userId === 'c').shareBp).toBe(0);
    expect(sumBp(shares)).toBe(TOTAL_BP);
  });

  it('retombe sur un partage égal si tout le monde est à 0', () => {
    const shares = normalizeShares([bp('a', 0), bp('b', 0)]);
    expect(shares).toEqual([bp('a', 5000), bp('b', 5000)]);
  });

  it('ne fait rien sur une liste vide', () => {
    expect(normalizeShares([])).toEqual([]);
  });
});

describe('withNewMember', () => {
  it('ajoute une licorne avec un coefficient moyen et renormalise', () => {
    const shares = withNewMember([bp('a', 5000), bp('b', 5000)], 'c');
    expect(sumBp(shares)).toBe(TOTAL_BP);
    expect(shares).toHaveLength(3);
    expect(shares.map((s) => s.shareBp).sort()).toEqual([3333, 3333, 3334]);
  });

  it('conserve les proportions existantes', () => {
    const shares = withNewMember([bp('a', 6000), bp('b', 3000), bp('c', 1000)], 'd');
    const a = shares.find((s) => s.userId === 'a').shareBp;
    const b = shares.find((s) => s.userId === 'b').shareBp;
    expect(sumBp(shares)).toBe(TOTAL_BP);
    expect(a / b).toBeCloseTo(2, 1);
  });

  it('est sans effet si la licorne est déjà présente', () => {
    const shares = withNewMember([bp('a', 5000), bp('b', 5000)], 'a');
    expect(shares).toHaveLength(2);
    expect(sumBp(shares)).toBe(TOTAL_BP);
  });

  it('gère le premier membre d\'un troupeau', () => {
    expect(withNewMember([], 'a')).toEqual([bp('a', TOTAL_BP)]);
  });
});

describe('withoutMember', () => {
  it('redistribue le coefficient au prorata', () => {
    const shares = withoutMember([bp('a', 5000), bp('b', 3000), bp('c', 2000)], 'a');
    expect(sumBp(shares)).toBe(TOTAL_BP);
    expect(shares).toEqual([bp('b', 6000), bp('c', 4000)]);
  });

  it('laisse la matrice vide si tout le monde part', () => {
    expect(withoutMember([bp('a', TOTAL_BP)], 'a')).toEqual([]);
  });
});
