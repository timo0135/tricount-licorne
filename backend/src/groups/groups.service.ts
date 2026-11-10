import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService } from '../balances/balances.service';
import { CoefficientsService } from '../coefficients/coefficients.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { generateInviteCode, randomGradient } from '../common/unicorn';

const MEMBER_SELECT = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, emoji: true, color: true } },
} as const;

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private balances: BalancesService,
    private coefficients: CoefficientsService,
  ) {}

  /** Vérifie que l'utilisateur appartient bien au troupeau. */
  async assertMember(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      // 404 plutôt que 403 : on ne révèle pas l'existence d'un troupeau.
      throw new NotFoundException('Troupeau introuvable.');
    }
    return membership;
  }

  private async assertOwner(userId: string, groupId: string) {
    const membership = await this.assertMember(userId, groupId);
    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Action réservée au créateur du troupeau.');
    }
    return membership;
  }

  async create(userId: string, dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name.trim(),
        description: dto.description,
        currency: dto.currency?.toUpperCase() ?? 'EUR',
        emoji: dto.emoji ?? '🦄',
        gradient: dto.gradient ?? randomGradient(),
        inviteCode: await this.uniqueInviteCode(),
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { members: { select: MEMBER_SELECT } },
    });

    // Matrice de coefficients par défaut : tout le monde à parts égales.
    await this.coefficients.initForGroup(group.id, [userId]);

    return { ...group, totalCents: 0, expenseCount: 0, myBalanceCents: 0 };
  }

  async findAllForUser(userId: string) {
    const groups = await this.prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { select: MEMBER_SELECT },
        _count: { select: { expenses: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      groups.map(async (group) => {
        const summary = await this.balances.summary(group.id);
        const mine = summary.balances.find((b) => b.userId === userId);
        return {
          ...group,
          expenseCount: group._count.expenses,
          totalCents: summary.totalCents,
          myBalanceCents: mine?.balanceCents ?? 0,
        };
      }),
    );
  }

  async findOne(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { select: MEMBER_SELECT, orderBy: { joinedAt: 'asc' } },
        _count: { select: { expenses: true } },
      },
    });
    if (!group) throw new NotFoundException('Troupeau introuvable.');

    const summary = await this.balances.summary(groupId);
    const mine = summary.balances.find((b) => b.userId === userId);
    return {
      ...group,
      expenseCount: group._count.expenses,
      totalCents: summary.totalCents,
      myBalanceCents: mine?.balanceCents ?? 0,
    };
  }

  async update(userId: string, groupId: string, dto: UpdateGroupDto) {
    await this.assertMember(userId, groupId);
    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...dto,
        currency: dto.currency ? dto.currency.toUpperCase() : undefined,
      },
      include: { members: { select: MEMBER_SELECT } },
    });
  }

  async remove(userId: string, groupId: string) {
    await this.assertOwner(userId, groupId);
    await this.prisma.group.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  async join(userId: string, dto: JoinGroupDto) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode: dto.inviteCode.trim().toUpperCase() },
    });
    if (!group) throw new NotFoundException("Aucun troupeau ne correspond à ce code d'invitation.");

    const existing = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId: group.id } },
    });
    if (existing) return this.findOne(userId, group.id);

    await this.prisma.membership.create({ data: { userId, groupId: group.id } });
    // La nouvelle licorne prend un coefficient égal à la moyenne des autres.
    await this.coefficients.sync(group.id);
    return this.findOne(userId, group.id);
  }

  async regenerateInviteCode(userId: string, groupId: string) {
    await this.assertOwner(userId, groupId);
    return this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: await this.uniqueInviteCode() },
      select: { id: true, inviteCode: true },
    });
  }

  async removeMember(actorId: string, groupId: string, memberUserId: string) {
    const actor = await this.assertMember(actorId, groupId);
    if (actorId !== memberUserId && actor.role !== 'OWNER') {
      throw new ForbiddenException('Seul le créateur du troupeau peut retirer un membre.');
    }

    const involved = await this.prisma.expense.count({
      where: {
        groupId,
        OR: [{ paidById: memberUserId }, { shares: { some: { userId: memberUserId } } }],
      },
    });
    if (involved > 0) {
      throw new BadRequestException(
        'Impossible de retirer une licorne liée à des dépenses. Supprime ou réattribue ses dépenses d\'abord.',
      );
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId: memberUserId, groupId } },
    });
    if (!membership) throw new NotFoundException('Cette personne ne fait pas partie du troupeau.');

    if (membership.role === 'OWNER') {
      const owners = await this.prisma.membership.count({ where: { groupId, role: 'OWNER' } });
      if (owners <= 1) {
        throw new BadRequestException(
          'Le dernier propriétaire ne peut pas quitter le troupeau. Supprime-le ou transmets-le.',
        );
      }
    }

    await this.prisma.membership.delete({ where: { id: membership.id } });
    // Son coefficient est redistribué au prorata des licornes restantes.
    await this.coefficients.sync(groupId);
    return { removed: true };
  }

  private async uniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateInviteCode();
      const clash = await this.prisma.group.findUnique({ where: { inviteCode: code } });
      if (!clash) return code;
    }
    return generateInviteCode(12);
  }
}
