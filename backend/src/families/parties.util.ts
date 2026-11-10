/**
 * « Entités » d'un troupeau : une famille compte pour une seule entité,
 * une personne sans famille est une entité à elle seule.
 *
 * Les coefficients et les parts restent stockés par personne ; ces fonctions
 * font le passage entre les personnes et les entités :
 *   - coefficient d'une famille = somme des coefficients de ses membres,
 *     toujours répartie à parts égales entre eux ;
 *   - une dépense automatique est d'abord répartie entre entités, puis à
 *     parts égales à l'intérieur de chaque famille ;
 *   - soldes et remboursements suggérés se calculent par entité.
 */
import { ComputedShare, splitByWeights } from '../common/split';
import type { Balance } from '../balances/balance.util';
import type { ShareBp } from '../coefficients/coefficients.util';

export const memberPartyId = (userId: string) => `u:${userId}`;
export const familyPartyId = (familyId: string) => `f:${familyId}`;
export const isFamilyParty = (partyId: string) => partyId.startsWith('f:');
export const partyRawId = (partyId: string) => partyId.slice(2);

export interface MemberLink {
  userId: string;
  familyId: string | null;
}

/** Index personne → entité. */
export type PartyIndex = Map<string, string>;

export function buildPartyIndex(links: MemberLink[]): PartyIndex {
  return new Map(
    links.map((l) => [l.userId, l.familyId ? familyPartyId(l.familyId) : memberPartyId(l.userId)]),
  );
}

/** Entité d'une personne ; un ancien membre forme sa propre entité. */
export const partyOf = (index: PartyIndex, userId: string): string =>
  index.get(userId) ?? memberPartyId(userId);

/** Membres de chaque entité, dans l'ordre fourni. */
export function membersByParty(links: MemberLink[]): Map<string, string[]> {
  const index = buildPartyIndex(links);
  const result = new Map<string, string[]>();
  for (const l of links) {
    const key = partyOf(index, l.userId);
    result.set(key, [...(result.get(key) ?? []), l.userId]);
  }
  return result;
}

export interface PartyBalance {
  partyId: string;
  userIds: string[];
  paidCents: number;
  owedCents: number;
  balanceCents: number;
}

/** Additionne les soldes des personnes par entité. */
export function aggregateBalances(balances: Balance[], index: PartyIndex): PartyBalance[] {
  const result = new Map<string, PartyBalance>();
  for (const b of balances) {
    const key = partyOf(index, b.userId);
    const entry = result.get(key) ?? {
      partyId: key,
      userIds: [],
      paidCents: 0,
      owedCents: 0,
      balanceCents: 0,
    };
    entry.userIds.push(b.userId);
    entry.paidCents += b.paidCents;
    entry.owedCents += b.owedCents;
    entry.balanceCents += b.balanceCents;
    result.set(key, entry);
  }
  return [...result.values()];
}

/** Coefficient de chaque entité : somme des coefficients de ses membres. */
export function partyShares(entries: ShareBp[], index: PartyIndex): Map<string, number> {
  const result = new Map<string, number>();
  for (const e of entries) {
    const key = partyOf(index, e.userId);
    result.set(key, (result.get(key) ?? 0) + e.shareBp);
  }
  return result;
}

/** Répartit le coefficient de chaque entité à parts égales entre ses membres. */
export function expandPartyShares(
  shares: { partyId: string; shareBp: number }[],
  members: Map<string, string[]>,
): ShareBp[] {
  return shares.flatMap((s) => {
    const userIds = members.get(s.partyId) ?? [];
    if (userIds.length === 0) return [];
    if (userIds.length === 1) return [{ userId: userIds[0], shareBp: s.shareBp }];
    if (s.shareBp === 0) return userIds.map((userId) => ({ userId, shareBp: 0 }));
    return splitByWeights(
      s.shareBp,
      userIds.map((userId) => ({ userId, weight: 1 })),
    ).map((c) => ({ userId: c.userId, shareBp: c.amountCents }));
  });
}

/** Rééquilibre chaque famille : même coefficient pour tous ses membres, total inchangé. */
export function equalizeFamilies(entries: ShareBp[], links: MemberLink[]): ShareBp[] {
  const index = buildPartyIndex(links);
  const members = membersByParty(links.filter((l) => entries.some((e) => e.userId === l.userId)));
  const totals = partyShares(entries, index);
  const expanded = new Map(
    expandPartyShares(
      [...totals.entries()].map(([partyId, shareBp]) => ({ partyId, shareBp })),
      members,
    ).map((e) => [e.userId, e.shareBp]),
  );
  return entries.map((e) => ({ userId: e.userId, shareBp: expanded.get(e.userId) ?? e.shareBp }));
}

/**
 * Répartition automatique d'une dépense : entre entités au prorata de leurs
 * coefficients (plus fort reste), puis à parts égales dans chaque famille.
 * La somme des parts reste exactement égale au montant.
 */
export function splitByParties(
  amountCents: number,
  participants: { userId: string; weight: number }[],
  index: PartyIndex,
): ComputedShare[] {
  const groups = new Map<string, { weight: number; users: { userId: string; weight: number }[] }>();
  for (const p of participants) {
    const key = partyOf(index, p.userId);
    const entry = groups.get(key) ?? { weight: 0, users: [] };
    entry.weight += p.weight;
    entry.users.push(p);
    groups.set(key, entry);
  }

  const byParty = splitByWeights(
    amountCents,
    [...groups.entries()].map(([key, g]) => ({ userId: key, weight: g.weight })),
  );

  return byParty.flatMap((partyShare) => {
    const { users } = groups.get(partyShare.userId)!;
    if (users.length === 1) {
      return [{ userId: users[0].userId, weight: users[0].weight, amountCents: partyShare.amountCents }];
    }
    const inner = splitByWeights(
      partyShare.amountCents,
      users.map((u) => ({ userId: u.userId, weight: 1 })),
    );
    return inner.map((c, i) => ({ userId: c.userId, weight: users[i].weight, amountCents: c.amountCents }));
  });
}
