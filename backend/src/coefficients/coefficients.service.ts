import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORIES } from '../common/categories';
import { splitByWeights } from '../common/split';
import { UpdateCoefficientsDto } from './dto/update-coefficients.dto';
import {
  ShareBp,
  TOTAL_BP,
  equalShares,
  normalizeShares,
  sumBp,
  withNewMember,
} from './coefficients.util';

@Injectable()
export class CoefficientsService {
  constructor(private prisma: PrismaService) {}

  private async assertMember(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) throw new ForbiddenException('Tu ne fais pas partie de ce troupeau');
    return membership;
  }

  /** Crée la matrice par défaut (tout le monde à parts égales) à la création du troupeau. */
  async initForGroup(groupId: string, userIds: string[]) {
    const base = equalShares(userIds);
    await this.prisma.categoryShare.createMany({
      data: CATEGORIES.flatMap((category) =>
        base.map((s) => ({ groupId, userId: s.userId, category, shareBp: s.shareBp })),
      ),
      skipDuplicates: true,
    });
  }

  /**
   * Aligne la matrice sur les membres actuels : ajoute les nouvelles licornes,
   * retire celles qui sont parties, et renormalise chaque catégorie à 100 %.
   * Idempotent — n'écrit que si quelque chose a bougé.
   */
  async sync(groupId: string) {
    const [members, rows] = await Promise.all([
      this.prisma.membership.findMany({
        where: { groupId },
        select: { userId: true },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.categoryShare.findMany({ where: { groupId } }),
    ]);

    const memberIds = members.map((m) => m.userId);
    const memberSet = new Set(memberIds);
    const operations: any[] = [];

    for (const category of CATEGORIES) {
      const existing = rows.filter((r) => r.category === category);
      const kept = existing.filter((r) => memberSet.has(r.userId));
      const stale = existing.filter((r) => !memberSet.has(r.userId));
      const missing = memberIds.filter((id) => !kept.some((r) => r.userId === id));

      if (!stale.length && !missing.length && sumBp(kept) === TOTAL_BP) continue;

      let entries: ShareBp[] = kept.map((r) => ({ userId: r.userId, shareBp: r.shareBp }));
      for (const userId of missing) entries = withNewMember(entries, userId);
      entries = entries.length ? normalizeShares(entries) : equalShares(memberIds);

      for (const row of stale) {
        operations.push(this.prisma.categoryShare.delete({ where: { id: row.id } }));
      }
      for (const entry of entries) {
        operations.push(
          this.prisma.categoryShare.upsert({
            where: {
              groupId_userId_category: { groupId, userId: entry.userId, category },
            },
            create: { groupId, userId: entry.userId, category, shareBp: entry.shareBp },
            update: { shareBp: entry.shareBp },
          }),
        );
      }
    }

    if (operations.length) await this.prisma.$transaction(operations);
  }

  /** Matrice complète, prête à afficher : catégories × licornes. */
  async matrix(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    await this.sync(groupId);

    const [rows, members] = await Promise.all([
      this.prisma.categoryShare.findMany({ where: { groupId } }),
      this.prisma.membership.findMany({
        where: { groupId },
        select: { user: { select: { id: true, name: true, emoji: true, color: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    return {
      groupId,
      totalBp: TOTAL_BP,
      members: members.map((m) => m.user),
      categories: CATEGORIES.map((category) => ({
        category,
        shares: rows
          .filter((r) => r.category === category)
          .map((r) => ({ userId: r.userId, shareBp: r.shareBp })),
      })),
    };
  }

  /** Poids à utiliser pour répartir une dépense d'une catégorie donnée. */
  async weightsFor(groupId: string, category: string): Promise<Map<string, number>> {
    await this.sync(groupId);
    const rows = await this.prisma.categoryShare.findMany({
      where: { groupId, category },
    });
    return new Map(rows.map((r) => [r.userId, r.shareBp]));
  }

  async replace(userId: string, groupId: string, dto: UpdateCoefficientsDto) {
    await this.assertMember(userId, groupId);

    const members = await this.prisma.membership.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));

    const operations: any[] = [];

    for (const entry of dto.categories) {
      if (!CATEGORIES.includes(entry.category as never)) {
        throw new BadRequestException(`Catégorie inconnue : ${entry.category}`);
      }

      const unknown = entry.shares.find((s) => !memberIds.has(s.userId));
      if (unknown) {
        throw new BadRequestException('Une licorne de la répartition ne fait pas partie du troupeau');
      }

      const seen = new Set(entry.shares.map((s) => s.userId));
      if (seen.size !== entry.shares.length) {
        throw new BadRequestException('Une licorne apparaît deux fois dans la même catégorie');
      }
      if (seen.size !== memberIds.size) {
        throw new BadRequestException(
          'Chaque licorne du troupeau doit avoir un coefficient (0 % est autorisé)',
        );
      }

      const total = sumBp(entry.shares);
      if (total !== TOTAL_BP) {
        throw new BadRequestException(
          `Le total de la catégorie « ${entry.category} » doit faire 100 % (actuellement ${(total / 100).toFixed(2)} %)`,
        );
      }

      for (const share of entry.shares) {
        operations.push(
          this.prisma.categoryShare.upsert({
            where: {
              groupId_userId_category: {
                groupId,
                userId: share.userId,
                category: entry.category,
              },
            },
            create: {
              groupId,
              userId: share.userId,
              category: entry.category,
              shareBp: share.shareBp,
            },
            update: { shareBp: share.shareBp },
          }),
        );
      }
    }

    if (operations.length) await this.prisma.$transaction(operations);
    return this.matrix(userId, groupId);
  }

  /**
   * Recalcule les dépenses déjà saisies en mode automatique avec les coefficients
   * actuels. Les licornes exclues d'une dépense précise le restent.
   */
  async applyToExistingExpenses(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    await this.sync(groupId);

    const expenses = await this.prisma.expense.findMany({
      where: { groupId, splitMode: 'AUTO' },
      include: { shares: true },
    });

    const weightsByCategory = new Map<string, Map<string, number>>();
    let updated = 0;

    for (const expense of expenses) {
      if (!weightsByCategory.has(expense.category)) {
        weightsByCategory.set(expense.category, await this.weightsFor(groupId, expense.category));
      }
      const weights = weightsByCategory.get(expense.category);

      const participants = expense.shares
        .map((s) => ({ userId: s.userId, weight: weights.get(s.userId) ?? 0 }))
        .filter((p) => p.weight > 0);

      const computed = participants.length
        ? splitByWeights(expense.amountCents, participants)
        : splitByWeights(
            expense.amountCents,
            expense.shares.map((s) => ({ userId: s.userId, weight: 1 })),
          );

      await this.prisma.$transaction([
        this.prisma.expenseShare.deleteMany({ where: { expenseId: expense.id } }),
        this.prisma.expense.update({
          where: { id: expense.id },
          data: {
            shares: {
              create: computed.map((c) => ({
                userId: c.userId,
                weight: c.weight,
                amountCents: c.amountCents,
              })),
            },
          },
        }),
      ]);
      updated += 1;
    }

    return { updated };
  }
}
