/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { splitByWeights } from '../src/common/split';
import { CATEGORIES } from '../src/common/categories';
import { equalShares } from '../src/coefficients/coefficients.util';

const prisma = new PrismaClient();

const USERS = [
  { email: 'sophie@licorne.fr', name: 'Sophie', emoji: '🦄', color: '#F7A8C4' },
  { email: 'leo@licorne.fr', name: 'Léo', emoji: '🌈', color: '#A9CBF5' },
  { email: 'maya@licorne.fr', name: 'Maya', emoji: '✨', color: '#A7E8D8' },
  { email: 'timothee@licorne.fr', name: 'Timothée', emoji: '🪄', color: '#C9A7F5' },
];

async function main() {
  console.log('🦄 Semis de la prairie...');
  const password = await bcrypt.hash('licorne123', 10);

  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, password },
      }),
    );
  }
  const [sophie, leo, maya, timothee] = users;

  const existing = await prisma.group.findUnique({ where: { inviteCode: 'BROCEL22' } });
  if (existing) {
    await prisma.group.delete({ where: { id: existing.id } });
  }

  const group = await prisma.group.create({
    data: {
      name: 'Week-end à Brocéliande',
      description: 'Trois jours de paillettes dans la forêt bretonne',
      emoji: '🌲',
      gradient: 'meadow',
      inviteCode: 'BROCEL22',
      members: {
        create: [
          { userId: sophie.id, role: 'OWNER' },
          { userId: leo.id },
          { userId: maya.id },
          { userId: timothee.id },
        ],
      },
    },
  });

  // --- Matrice de coefficients (en points de base, 10 000 = 100 %) -----------
  // Par défaut tout le monde à parts égales, sauf :
  //  · logement  : Sophie a la grande chambre → 40 %, les autres 20 %
  //  · nourriture: Timothée mange à l'extérieur le midi → 10 %, les autres 30 %
  const defaultShares = equalShares(users.map((u) => u.id));
  const overrides: Record<string, Record<string, number>> = {
    logement: { [sophie.id]: 4000, [leo.id]: 2000, [maya.id]: 2000, [timothee.id]: 2000 },
    nourriture: { [sophie.id]: 3000, [leo.id]: 3000, [maya.id]: 3000, [timothee.id]: 1000 },
  };

  await prisma.categoryShare.createMany({
    data: CATEGORIES.flatMap((category) =>
      users.map((user) => ({
        groupId: group.id,
        userId: user.id,
        category,
        shareBp:
          overrides[category]?.[user.id] ??
          defaultShares.find((s) => s.userId === user.id).shareBp,
      })),
    ),
  });

  const coefficientsFor = (category: string) =>
    users
      .map((user) => ({
        userId: user.id,
        weight:
          overrides[category]?.[user.id] ??
          defaultShares.find((s) => s.userId === user.id).shareBp,
      }))
      .filter((p) => p.weight > 0);

  const expenses = [
    {
      title: 'Gîte enchanté (2 nuits)',
      amountCents: 42000,
      category: 'logement',
      paidById: sophie.id,
      splitMode: 'AUTO' as const,
      participants: coefficientsFor('logement'),
    },
    {
      title: 'Courses arc-en-ciel',
      amountCents: 8730,
      category: 'courses',
      paidById: leo.id,
      splitMode: 'AUTO' as const,
      participants: coefficientsFor('courses'),
    },
    {
      title: 'Crêpes au caramel beurre salé',
      amountCents: 3450,
      category: 'nourriture',
      paidById: maya.id,
      splitMode: 'AUTO' as const,
      participants: coefficientsFor('nourriture'),
    },
    {
      // Répartition personnalisée : Maya n'était pas du voyage en calèche.
      title: 'Essence pour la calèche',
      amountCents: 6200,
      category: 'transport',
      paidById: timothee.id,
      splitMode: 'EQUAL' as const,
      participants: [{ userId: sophie.id }, { userId: leo.id }, { userId: timothee.id }],
    },
    {
      title: 'Paillettes et confettis',
      amountCents: 1590,
      category: 'paillettes',
      paidById: sophie.id,
      splitMode: 'AUTO' as const,
      participants: coefficientsFor('paillettes'),
    },
  ];

  for (const e of expenses) {
    const shares = splitByWeights(e.amountCents, e.participants);
    await prisma.expense.create({
      data: {
        groupId: group.id,
        title: e.title,
        amountCents: e.amountCents,
        category: e.category,
        paidById: e.paidById,
        createdById: e.paidById,
        splitMode: e.splitMode,
        shares: {
          create: shares.map((s) => ({
            userId: s.userId,
            weight: s.weight,
            amountCents: s.amountCents,
          })),
        },
      },
    });
  }

  await prisma.settlement.create({
    data: {
      groupId: group.id,
      fromUserId: maya.id,
      toUserId: sophie.id,
      amountCents: 5000,
      note: 'Premier acompte 🦄',
    },
  });

  console.log('✨ Prairie prête !');
  console.log('   Comptes de test : sophie@licorne.fr / leo@licorne.fr / maya@licorne.fr / timothee@licorne.fr');
  console.log('   Mot de passe    : licorne123');
  console.log("   Code d'invitation du troupeau : BROCEL22");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
