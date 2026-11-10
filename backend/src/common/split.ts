/**
 * Répartition d'un montant (en centimes) entre plusieurs participants.
 *
 * On utilise la méthode du plus fort reste : chacun reçoit la partie entière de
 * sa quote-part, puis les centimes restants sont distribués aux plus gros restes.
 * La somme des parts est donc toujours exactement égale au montant total —
 * pas un centime de licorne ne se perd.
 */
export interface SplitParticipant {
  userId: string;
  weight?: number;
  amountCents?: number;
}

export interface ComputedShare {
  userId: string;
  weight: number;
  amountCents: number;
}

export function splitByWeights(
  totalCents: number,
  participants: SplitParticipant[],
): ComputedShare[] {
  if (participants.length === 0) {
    throw new Error('Il faut au moins un participant');
  }

  const weights = participants.map((p) => {
    const w = p.weight ?? 1;
    if (!Number.isInteger(w) || w <= 0) {
      throw new Error('Les parts doivent être des entiers strictement positifs');
    }
    return w;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const sign = totalCents < 0 ? -1 : 1;
  const absTotal = Math.abs(totalCents);

  const base = participants.map((p, i) => {
    const exact = (absTotal * weights[i]) / totalWeight;
    const floor = Math.floor(exact);
    return { userId: p.userId, weight: weights[i], floor, remainder: exact - floor, index: i };
  });

  let distributed = base.reduce((sum, b) => sum + b.floor, 0);
  let leftover = absTotal - distributed;

  // Les centimes orphelins vont aux plus gros restes (puis ordre stable).
  const order = [...base].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  const bonus = new Map<number, number>();
  let i = 0;
  while (leftover > 0) {
    const target = order[i % order.length];
    bonus.set(target.index, (bonus.get(target.index) ?? 0) + 1);
    leftover -= 1;
    i += 1;
  }

  return base.map((b) => ({
    userId: b.userId,
    weight: b.weight,
    amountCents: sign * (b.floor + (bonus.get(b.index) ?? 0)),
  }));
}

/** Vérifie qu'une répartition manuelle (mode EXACT) tombe juste. */
export function validateExactShares(
  totalCents: number,
  participants: SplitParticipant[],
): ComputedShare[] {
  const shares = participants.map((p) => {
    if (p.amountCents === undefined || !Number.isInteger(p.amountCents)) {
      throw new Error('Chaque participant doit avoir un montant exact en centimes');
    }
    return { userId: p.userId, weight: 1, amountCents: p.amountCents };
  });

  const sum = shares.reduce((acc, s) => acc + s.amountCents, 0);
  if (sum !== totalCents) {
    throw new Error(
      `La somme des parts (${(sum / 100).toFixed(2)}) doit être égale au montant total (${(totalCents / 100).toFixed(2)})`,
    );
  }
  return shares;
}
