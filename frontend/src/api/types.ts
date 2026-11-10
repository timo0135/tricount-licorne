export interface User {
  id: string;
  email?: string;
  name: string;
  emoji: string;
  color: string;
  /** Photo de profil ; quand elle existe, elle remplace l'emoji. */
  avatarUrl?: string | null;
  /** Double authentification activée (renvoyé seulement pour soi-même). */
  twoFactorEnabled?: boolean;
}

export type Role = 'OWNER' | 'MEMBER';
export type SplitMode = 'AUTO' | 'EQUAL' | 'SHARES' | 'EXACT';

export interface Member {
  id: string;
  role: Role;
  joinedAt: string;
  familyId: string | null;
  user: User;
}

/** Famille d'un troupeau : plusieurs membres qui comptent pour une seule entité. */
export interface Family {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  emoji: string;
  gradient: string;
  photoUrl: string | null;
  bannerUrl: string | null;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  members: Member[];
  families: Family[];
  expenseCount: number;
  totalCents: number;
  myBalanceCents: number;
}

export interface ExpenseShare {
  id: string;
  weight: number;
  amountCents: number;
  user: User;
}

export interface Expense {
  id: string;
  title: string;
  amountCents: number;
  date: string;
  category: string;
  note: string | null;
  splitMode: SplitMode;
  paidBy: User;
  createdBy: User;
  shares: ExpenseShare[];
}

/** Entité d'un troupeau : une famille, ou un membre seul. */
export type PartyKind = 'family' | 'member';

export interface PartyInfo {
  partyId: string;
  kind: PartyKind;
  familyId: string | null;
  name: string;
  members: User[];
}

export interface PartyBalance extends PartyInfo {
  paidCents: number;
  owedCents: number;
  balanceCents: number;
}

export interface Reimbursement {
  fromPartyId: string;
  toPartyId: string;
  amountCents: number;
  from: PartyInfo;
  to: PartyInfo;
  /** Personnes proposées par défaut pour enregistrer le virement. */
  fromUserId: string;
  toUserId: string;
}

export interface BalanceSummary {
  groupId: string;
  totalCents: number;
  averagePerPartyCents: number;
  balances: PartyBalance[];
  reimbursements: Reimbursement[];
}

export interface Settlement {
  id: string;
  amountCents: number;
  date: string;
  note: string | null;
  fromUser: User;
  toUser: User;
}

/** Coefficients : 10 000 points de base = 100 %, saisis par entité. */
export interface PartyShare {
  partyId: string;
  shareBp: number;
}

export interface CategoryCoefficients {
  category: string;
  shares: PartyShare[];
}

export interface MatrixParty {
  id: string;
  kind: PartyKind;
  familyId: string | null;
  name: string;
  userIds: string[];
}

export interface CoefficientMatrix {
  groupId: string;
  totalBp: number;
  members: (User & { familyId: string | null })[];
  parties: MatrixParty[];
  categories: (CategoryCoefficients & { memberShares: { userId: string; shareBp: number }[] })[];
}

export interface CategoryStat {
  category: string;
  totalCents: number;
  count: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

/** Réponse de connexion quand la double authentification est activée. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export interface TwoFactorSetup {
  otpauthUrl: string;
  /** QR code en data URL (PNG). */
  qrCode: string;
  /** Secret à saisir à la main, par groupes de 4. */
  secret: string;
}

/** Passkey enregistrée (Face ID, Touch ID…). */
export interface Passkey {
  id: string;
  name: string;
  deviceType: 'singleDevice' | 'multiDevice' | string;
  /** Synchronisée (ex. trousseau iCloud) : disponible sur tes autres appareils. */
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface TwoFactorStatus {
  enabled: boolean;
  remainingRecoveryCodes: number;
}

export interface ExpenseParticipantPayload {
  userId: string;
  weight?: number;
  amountCents?: number;
}

export interface ExpensePayload {
  title: string;
  amountCents: number;
  date?: string;
  category?: string;
  note?: string;
  paidById?: string;
  splitMode?: SplitMode;
  participants?: ExpenseParticipantPayload[];
}
