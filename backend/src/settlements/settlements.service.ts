import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

const SETTLEMENT_INCLUDE = {
  fromUser: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
  toUser: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
} as const;

@Injectable()
export class SettlementsService {
  constructor(
    private prisma: PrismaService,
    private groups: GroupsService,
  ) {}

  async findAll(userId: string, groupId: string) {
    await this.groups.assertMember(userId, groupId);
    return this.prisma.settlement.findMany({
      where: { groupId },
      include: SETTLEMENT_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, groupId: string, dto: CreateSettlementDto) {
    await this.groups.assertMember(userId, groupId);

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Une personne ne peut pas se rembourser elle-même.');
    }
    await Promise.all([
      this.groups.assertMember(dto.fromUserId, groupId),
      this.groups.assertMember(dto.toUserId, groupId),
    ]);

    const settlement = await this.prisma.settlement.create({
      data: {
        groupId,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        amountCents: dto.amountCents,
        date: dto.date ? new Date(dto.date) : new Date(),
        note: dto.note,
      },
      include: SETTLEMENT_INCLUDE,
    });

    await this.prisma.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
    return settlement;
  }

  async remove(userId: string, groupId: string, settlementId: string) {
    await this.groups.assertMember(userId, groupId);
    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, groupId },
    });
    if (!settlement) throw new NotFoundException('Remboursement introuvable.');

    await this.prisma.settlement.delete({ where: { id: settlementId } });
    return { deleted: true };
  }
}
