export interface Profile {
  id: string;
  preferred_name: string;
  age_range: string;
  sex: string;
  country: string;
  experience_level: string;
  practices: string[];
  goals: string[];
  vocabulary_framework: 'plain' | 'polyvagal' | 'ifs' | 'somatic';
  chakra_mapping: boolean;
  weekly_mirror_reminder: boolean;
  monthly_mirror_reminder: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface BodySensation {
  region: string;
  quality: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  practice_type: string | null;
  duration_minutes: number | null;
  journey_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  session_id: string;
  nervous_system_state: string | null;
  energetic_shift: string | null;
  release_qualities: string[];
  emotion_tags: string[];
  body_sensations: BodySensation[];
  connection_type: string | null;
  connection_note: string | null;
  elaboration_note: string | null;
  difference_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithCheckin {
  session: Session;
  checkin: Checkin | null;
}

export interface Journey {
  id: string;
  user_id: string;
  name: string;
  start_date: string | null;
  duration_days: number | null;
  intentions: string[] | null;
  status: 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
}

export interface Integration {
  id: string;
  user_id: string;
  journey_id: string | null;
  note_date: string;
  category: string;
  triggers_q1: string | null;
  triggers_q2: string | null;
  triggers_q3: string | null;
  memories_q1: string | null;
  memories_q2: string | null;
  memories_q3: string | null;
  emotions_q1: string | null;
  emotions_q2: string | null;
  emotions_q3: string | null;
  body_q1: string | null;
  body_q2: string | null;
  body_q3: string | null;
  patterns_q1: string | null;
  patterns_q2: string | null;
  patterns_q3: string | null;
  meaning_q1: string | null;
  meaning_q2: string | null;
  meaning_q3: string | null;
  realizations_q1: string | null;
  realizations_q2: string | null;
  realizations_q3: string | null;
  actions_q1: string | null;
  actions_q2: string | null;
  actions_q3: string | null;
  gratitude_q1: string | null;
  gratitude_q2: string | null;
  gratitude_q3: string | null;
  free_text: string | null;
  carry_forward: string | null;
  emotion_tags?: string[];
  created_at: string;
  updated_at: string;
}

export type MirrorPromptType = 'weekly' | 'monthly' | 'journey' | null;

export interface Mirror {
  id: string;
  type: 'weekly' | 'monthly' | 'journey';
  journey_id: string | null;      // null for weekly/monthly; journey id for journey mirrors
  journey_name: string | null;    // null for weekly/monthly; journey name for display
  period_start: string;
  period_end: string;
  generated_at: string;
  content: string;
  summary: string;
  session_count: number;
  integration_count: number;
  status: 'ready' | 'generating' | 'error';
  error_reason?: 'insufficient_data' | 'api_error';  // Only set when status is 'error'
}

// Persisted flag for a pending journey Mirror offer the user has not yet acted on
export interface JourneyMirrorOffer {
  journey_id: string;
  journey_name: string;
  offered_at: string; // ISO timestamp of when the journey was closed
}

export interface Entitlement {
  id: string;
  user_id: string;
  email: string;
  plan: string | null;
  status: 'active' | 'grace_period' | 'expired' | 'refunded' | 'none';
  current_period_end: string | null;
  subscription_id: string | null;
  updated_at: string;
}

// ---- Input types ----

export interface CreateSessionInput {
  practice_type?: string | null;
  duration_minutes?: number | null;
  journey_id?: string | null;
  created_at?: string;
  nervous_system_state: string;
  energetic_shift?: string | null;
  release_qualities?: string[];
  emotion_tags?: string[];
  body_sensations?: BodySensation[];
  connection_type?: string | null;
  connection_note?: string | null;
  elaboration_note?: string | null;
  difference_note?: string | null;
}

export type UpdateSessionInput = Partial<CreateSessionInput>;

export interface CreateJourneyInput {
  name: string;
  start_date?: string | null;
  duration_days?: number | null;
  intentions?: string[] | null;
}

export type UpdateJourneyInput = Partial<CreateJourneyInput>;

export interface CreateIntegrationInput {
  note_date: string;
  category: string;
  journey_id?: string | null;
  triggers_q1?: string | null;
  triggers_q2?: string | null;
  triggers_q3?: string | null;
  memories_q1?: string | null;
  memories_q2?: string | null;
  memories_q3?: string | null;
  emotions_q1?: string | null;
  emotions_q2?: string | null;
  emotions_q3?: string | null;
  body_q1?: string | null;
  body_q2?: string | null;
  body_q3?: string | null;
  patterns_q1?: string | null;
  patterns_q2?: string | null;
  patterns_q3?: string | null;
  meaning_q1?: string | null;
  meaning_q2?: string | null;
  meaning_q3?: string | null;
  realizations_q1?: string | null;
  realizations_q2?: string | null;
  realizations_q3?: string | null;
  actions_q1?: string | null;
  actions_q2?: string | null;
  actions_q3?: string | null;
  gratitude_q1?: string | null;
  gratitude_q2?: string | null;
  gratitude_q3?: string | null;
  free_text?: string | null;
  carry_forward?: string | null;
  emotion_tags?: string[];
}

export type UpdateIntegrationInput = Partial<CreateIntegrationInput>;

// ---- Integration emotion taxonomy ----

export const INTEGRATION_EMOTION_SELECTOR = [
  { primary: 'Anger', subs: ['Aggressive','Hostile','Provoked','Mad','Enraged','Furious','Frustrated','Annoyed','Irritated','Critical','Sarcastic','Skeptical'] },
  { primary: 'Anticipation', subs: ['Excited','Passionate','Energized','Eager','Motivated','Enthusiastic','Interested','Curious','Impatient','Stressed','Pressured','Overwhelmed'] },
  { primary: 'Happiness', subs: ['Optimistic','Positive','Inspired','Confident','Proud','Self-assured','Joyful','Ecstatic','Delighted','Loving','Embracing','Generous'] },
  { primary: 'Surprise', subs: ['Startled','Dismayed','Shocked','Confused','Disillusioned','Perplexed','Amazed','Astonished','Awe','Disappointed','Betrayed'] },
  { primary: 'Trust', subs: ['Grateful','Fulfilled','Admiration','Peaceful','Calm','Content','Accepted','Valued','Respected','Hopeful','Longing','Expectant'] },
  { primary: 'Sadness', subs: ['Ashamed','Guilty','Remorseful','Lonely','Isolated','Abandoned','Depressed','Unmotivated','Unenthusiastic','Hurt','Wronged','Devastated'] },
  { primary: 'Fear', subs: ['Insecure','Inadequate','Rejected','Anxious','Dread','Worried','Scared','Frightened','Terrified','Nervous','Threatened','Uneasy'] },
  { primary: 'Disgust', subs: ['Disapproving','Judgmental','Loathing','Awful','Detestable','Repelled','Avoidant','Aversion','Hesitant','Dislike','Appalled','Revulsion'] },
] as const;

export type IntegrationEmotionPrimary = typeof INTEGRATION_EMOTION_SELECTOR[number]['primary'];
