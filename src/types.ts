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
  match_result?: "win" | "draw" | "tie";
}

export interface MatchWithNames {
  id: string;
  winners: string[]; // Array of winner names to support draws
  loser: string;
  payer: string;
  cost: number;
  date: Date;
  participants?: string[];
  match_result?: "win" | "draw" | "tie";
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

// ─── 1v1 Duel Types ───────────────────────────────────────────────────────────

export interface DuelPlayer {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DuelPlayerStats {
  id: number;
  name: string;
  total_wins: number;
  total_losses: number;
  total_spent: number;
  rounds_played: number;
  sessions_played?: number;
  win_rate: number;
  created_at: Date;
}

export interface DuelSession {
  id: string;
  player1_id: number;
  player2_id: number;
  total_cost: number;
  payer_type: "player1" | "player2" | "split";
  payer_id: number | null;
  status: "active" | "completed";
  created_at: Date;
  ended_at: Date | null;
}

export interface DuelSessionSummary {
  id: string;
  status: "active" | "completed";
  total_cost: number;
  payer_type: "player1" | "player2" | "split";
  created_at: Date;
  ended_at: Date | null;
  player1_id: number;
  player1_name: string;
  player2_id: number;
  player2_name: string;
  player1_session_wins: number;
  player2_session_wins: number;
  total_rounds: number;
}

export interface DuelRound {
  id: string;
  session_id: string;
  winner_id: number | null; // null = draw
  player1_wins: number;
  player1_losses: number;
  player2_wins: number;
  player2_losses: number;
  cost: number;
  payer_type: "player1" | "player2" | "split";
  payer_id: number | null;
  result: "win" | "draw";
  played_at: Date;
}

export interface CreateDuelSessionDTO {
  player1Name: string;
  player2Name: string;
}

export interface CreateDuelRoundDTO {
  sessionId: string;
  player1Wins: number;
  player1Losses: number;
  player2Wins: number;
  player2Losses: number;
  cost: number;
  payerType: "player1" | "player2" | "split";
}

export interface CompleteDuelSessionDTO {
  sessionId: string;
  totalCost: number;
  payerType: "player1" | "player2" | "split";
}
