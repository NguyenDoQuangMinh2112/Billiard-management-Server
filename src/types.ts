// Type definitions for the Billiard Management System

export interface Player {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Match {
  id: string;
  winners: number[]; // Array of winner player IDs to support draws
  loser_id: number;
  payer_id: number;
  cost: number;
  date: Date;
  created_at: Date;
  participants?: string[];
  match_result?: 'win' | 'draw' | 'tie';
}

export interface MatchWithNames {
  id: string;
  winners: string[]; // Array of winner names to support draws
  loser: string;
  payer: string;
  cost: number;
  date: Date;
  participants?: string[];
  match_result?: 'win' | 'draw' | 'tie';
}

export interface PlayerStats {
  id: number;
  name: string;
  wins: number;
  losses: number;
  totalSpent: number;
  matchesPlayed: number;
  winRate: number;
}

export interface ExpenseData {
  total: number;
  byPlayer: Record<string, number>;
}

export interface CreateMatchDTO {
  winners: string[]; // Array of winner names (can be single or multiple for draws)
  loser: string;
  cost: number;
  participants?: string[];
  details?: { name: string; wins: number; losses: number }[];
}

export interface CreatePlayerDTO {
  name: string;
}

export interface PayerRotation {
  id: number;
  current_payer_id: number;
  updated_at: Date;
}

export interface Badge {
  id: string;
  name: string;
  criterion: string;
  short_description: string;
  icon: string;
  created_at: Date;
}

export interface PlayerBadge {
  id: number;
  player_id: number;
  badge_id: string;
  match_id: string | null;
  awarded_at: Date;
}

export interface AwardBadgeDTO {
  player_id: number;
  badge_id: string;
  match_id?: string;
}
