// Hand-written row types matching supabase/migrations/20260702000000_init.sql.
// Kept deliberately simple. Update alongside any migration change.

type Role = "participant" | "admin";
type TaskType = "standard" | "pair";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "superseded";
type PairingStatus = "pending" | "accepted" | "declined";

export type BonusConfig =
  | { kind: "first_n"; n: number; bonus: number }
  | { kind: "before"; cutoff: string; bonus: number }
  | { kind: "multiplier_before"; cutoff: string; multiplier: number };

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  room_no: string | null;
  role: Role;
  team_id: string | null;
  created_at: string;
}

export interface RosterEntry {
  id: string;
  email: string;
  full_name: string;
  team_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  type: TaskType;
  pair_team_count: number;
  release_at: string;
  deadline_at: string;
  bonus_config: BonusConfig | null;
  max_submissions: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Pairing {
  id: string;
  task_id: string;
  team_a: string;
  team_b: string;
  team_ids: string[];
  accepted_team_ids: string[];
  status: PairingStatus;
  created_by_team: string;
  created_at: string;
}

export interface Submission {
  id: string;
  task_id: string;
  team_id: string;
  pairing_id: string | null;
  text_content: string;
  photo_paths: string[];
  status: SubmissionStatus;
  points_awarded: number | null;
  reviewer_id: string | null;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  resubmission_of: string | null;
}

export interface BonusAward {
  id: string;
  team_id: string;
  points: number;
  reason: string;
  awarded_by: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
}

export interface EventSettings {
  id: number;
  event_name: string;
  start_at: string;
  end_at: string;
  leaderboard_hide_at: string;
}

export interface LeaderboardRow {
  team_id: string;
  team_name: string;
  points: number;
  rank: number;
  is_mine: boolean;
}
