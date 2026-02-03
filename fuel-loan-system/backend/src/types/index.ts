export type UserRole = 'ADMIN' | 'AGENT';
export type RiderStatus = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'PAID';

export interface User {
  user_id: number;
  full_name: string | null;
  phone_number: string | null;
  role: UserRole;
  password_hash: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface Rider {
  rider_id: number;
  full_name: string | null;
  phone_number: string | null;
  national_id: string | null;
  motorcycle_number: string | null;
  stage_location: string | null;
  status: RiderStatus;
  created_at: Date;
}

export interface Loan {
  loan_id: number;
  rider_id: number;
  agent_id: number;
  principal_amount: string;
  service_charge: string;
  outstanding_balance: string;
  total_penalty: string;
  penalty_cap: string | null;
  issued_at: Date | null;
  due_at: Date | null;
  last_penalty_applied_at: Date | null;
  status: LoanStatus;
  created_at: Date;
}

export interface Payment {
  payment_id: number;
  loan_id: number;
  amount_paid: string;
  payment_method: string;
  received_by: number;
  payment_time: Date;
}

export interface JwtPayload {
  userId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}
