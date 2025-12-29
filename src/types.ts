// Type definitions for the Billiard Management System

export interface Player {
    id: number;
    name: string;
    created_at: Date;
    updated_at: Date;
}

export interface Match {
    id: string;
    winner_id: number;
    loser_id: number;
    payer_id: number;
    cost: number;
    date: Date;
    created_at: Date;
    participants?: string[];
}

export interface MatchWithNames {
    id: string;
    winner: string;
    loser: string;
    payer: string;
    cost: number;
    date: Date;
    participants?: string[];
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
    winner: string;
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
