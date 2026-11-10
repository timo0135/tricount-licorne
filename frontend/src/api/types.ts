export interface User {
  id: string;
  email?: string;
  name: string;
  emoji: string;
  color: string;
}

export type Role = 'OWNER' | 'MEMBER';
export type SplitMode = 'AUTO' | 'EQUAL' | 'SHARES' | 'EXACT';

export interface Member {
  id: string;
  role: Role;
  joinedAt: string;
  user: User;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  emoji: string;
  gradient: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  members: Member[];
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

export interface Balance {
  userId: string;
  paidCents: number;
  owedCents: number;
  balanceCents: number;
  user?: User;
}

export interface Reimbursement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  fromUser?: User;
  toUser?: User;
}

export interface BalanceSummary {
  groupId: string;
  totalCents: number;
  averagePerMemberCents: number;
  balances: Balance[];
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

/** Coefficients : 10 000 points de base = 100 %. */
export interface CoefficientShare {
  userId: string;
  shareBp: number;
}

export interface CategoryCoefficients {
  category: string;
  shares: CoefficientShare[];
}

export interface CoefficientMatrix {
  groupId: string;
  totalBp: number;
  members: User[];
  categories: CategoryCoefficients[];
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
