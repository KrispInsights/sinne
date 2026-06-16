import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Profile,
  Session,
  Checkin,
  SessionWithCheckin,
  Journey,
  Integration,
  Mirror,
  JourneyMirrorOffer,
  Entitlement,
  CreateSessionInput,
  UpdateSessionInput,
  CreateJourneyInput,
  UpdateJourneyInput,
  CreateIntegrationInput,
  UpdateIntegrationInput,
} from './types';
import {
  MOCK_USER_ID,
  mockProfile,
  mockSessions,
  mockCheckins,
  mockJourneys,
  mockIntegrations,
  mockMirrors,
  mockEntitlement,
} from './mockData';

// ---- Internal helpers ----

const KEYS = {
  initialized: 'sinne_initialized',
  profile: 'sinne_profile',
  sessions: 'sinne_sessions',
  checkins: 'sinne_checkins',
  journeys: 'sinne_journeys',
  integrations: 'sinne_integrations',
  mirrors: 'sinne_mirrors',
  journeyMirrorOffers: 'sinne_journey_mirror_offers',
  entitlement: 'sinne_entitlement',
  signedIn: 'sinne_signed_in',
} as const;

let _seeded = false;

async function seedIfNeeded(): Promise<void> {
  if (_seeded) return;
    await AsyncStorage.removeItem(KEYS.initialized); // TEMP — remove after reseedning to reset data during development
  const flag = await AsyncStorage.getItem(KEYS.initialized);
  if (!flag) {
    await AsyncStorage.multiSet([
      [KEYS.profile, JSON.stringify(mockProfile)],
      [KEYS.sessions, JSON.stringify(mockSessions)],
      [KEYS.checkins, JSON.stringify(mockCheckins)],
      [KEYS.journeys, JSON.stringify(mockJourneys)],
      [KEYS.integrations, JSON.stringify(mockIntegrations)],
      [KEYS.mirrors, JSON.stringify(mockMirrors)],
      [KEYS.entitlement, JSON.stringify(mockEntitlement)],
      [KEYS.initialized, '1'],
    ]);
  }
  _seeded = true;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

async function load<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

async function save<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ---- Auth state ----

export async function isSignedIn(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.signedIn);
  return val === '1';
}

export async function signIn(): Promise<void> {
  await AsyncStorage.setItem(KEYS.signedIn, '1');
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.signedIn);
}

// ---- Profile ----

export async function getProfile(): Promise<Profile> {
  await seedIfNeeded();
  const raw = await AsyncStorage.getItem(KEYS.profile);
  return JSON.parse(raw!) as Profile;
}

export async function updateProfile(
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<Profile> {
  const profile = await getProfile();
  const updated: Profile = { ...profile, ...updates, updated_at: now() };
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(updated));
  return updated;
}

// Fully replace the stored profile (used by sign-up to write a fresh profile).
export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
  await AsyncStorage.setItem(KEYS.initialized, '1');
  _seeded = true;
}

// Build a blank profile for a new sign-up (onboarding_complete = false).
export function createNewProfile(): Profile {
  const timestamp = now();
  return {
    id: uid(),
    preferred_name: '',
    age_range: '',
    sex: '',
    country: '',
    experience_level: '',
    practices: [],
    goals: [],
    vocabulary_framework: 'plain',
    chakra_mapping: false,
    weekly_mirror_reminder: true,
    monthly_mirror_reminder: true,
    onboarding_complete: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

// ---- Sessions ----

function attachCheckin(session: Session, checkins: Checkin[]): SessionWithCheckin {
  return {
    session,
    checkin: checkins.find((c) => c.session_id === session.id) ?? null,
  };
}

export async function getSessions(): Promise<SessionWithCheckin[]> {
  await seedIfNeeded();
  const [sessions, checkins] = await Promise.all([
    load<Session>(KEYS.sessions),
    load<Checkin>(KEYS.checkins),
  ]);
  return sessions
    .map((s) => attachCheckin(s, checkins))
    .sort(
      (a, b) =>
        new Date(b.session.created_at).getTime() -
        new Date(a.session.created_at).getTime()
    );
}

export async function getSession(id: string): Promise<SessionWithCheckin | null> {
  await seedIfNeeded();
  const [sessions, checkins] = await Promise.all([
    load<Session>(KEYS.sessions),
    load<Checkin>(KEYS.checkins),
  ]);
  const session = sessions.find((s) => s.id === id);
  return session ? attachCheckin(session, checkins) : null;
}

export async function createSession(
  input: CreateSessionInput
): Promise<SessionWithCheckin> {
  await seedIfNeeded();
  const profile = await getProfile();
  const timestamp = now();
  const sessionId = uid();

  const session: Session = {
    id: sessionId,
    user_id: profile.id,
    practice_type: input.practice_type ?? null,
    duration_minutes: input.duration_minutes ?? null,
    journey_id: input.journey_id ?? null,
    created_at: input.created_at ?? timestamp,
    updated_at: timestamp,
  };

  const checkin: Checkin = {
    id: uid(),
    user_id: profile.id,
    session_id: sessionId,
    nervous_system_state: input.nervous_system_state,
    energetic_shift: input.energetic_shift ?? null,
    release_qualities: input.release_qualities ?? [],
    emotion_tags: input.emotion_tags ?? [],
    body_sensations: input.body_sensations ?? [],
    connection_type: input.connection_type ?? null,
    connection_note: input.connection_note ?? null,
    elaboration_note: input.elaboration_note ?? null,
    difference_note: input.difference_note ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const [sessions, checkins] = await Promise.all([
    load<Session>(KEYS.sessions),
    load<Checkin>(KEYS.checkins),
  ]);
  await Promise.all([
    save(KEYS.sessions, [...sessions, session]),
    save(KEYS.checkins, [...checkins, checkin]),
  ]);

  return { session, checkin };
}

export async function updateSession(
  id: string,
  input: UpdateSessionInput
): Promise<SessionWithCheckin> {
  await seedIfNeeded();
  const timestamp = now();
  const [sessions, checkins] = await Promise.all([
    load<Session>(KEYS.sessions),
    load<Checkin>(KEYS.checkins),
  ]);

  const si = sessions.findIndex((s) => s.id === id);
  if (si === -1) throw new Error(`Session not found: ${id}`);

  sessions[si] = {
    ...sessions[si],
    practice_type: input.practice_type !== undefined ? input.practice_type : sessions[si].practice_type,
    duration_minutes: input.duration_minutes !== undefined ? input.duration_minutes : sessions[si].duration_minutes,
    journey_id: input.journey_id !== undefined ? input.journey_id : sessions[si].journey_id,
    created_at: input.created_at !== undefined ? input.created_at : sessions[si].created_at,
    updated_at: timestamp,
  };

  const ci = checkins.findIndex((c) => c.session_id === id);
  if (ci !== -1) {
    checkins[ci] = {
      ...checkins[ci],
      nervous_system_state: input.nervous_system_state !== undefined ? input.nervous_system_state : checkins[ci].nervous_system_state,
      energetic_shift: input.energetic_shift !== undefined ? input.energetic_shift : checkins[ci].energetic_shift,
      release_qualities: input.release_qualities !== undefined ? input.release_qualities : checkins[ci].release_qualities,
      emotion_tags: input.emotion_tags !== undefined ? input.emotion_tags : checkins[ci].emotion_tags,
      body_sensations: input.body_sensations !== undefined ? input.body_sensations : checkins[ci].body_sensations,
      connection_type: input.connection_type !== undefined ? input.connection_type : checkins[ci].connection_type,
      connection_note: input.connection_note !== undefined ? input.connection_note : checkins[ci].connection_note,
      elaboration_note: input.elaboration_note !== undefined ? input.elaboration_note : checkins[ci].elaboration_note,
      difference_note: input.difference_note !== undefined ? input.difference_note : checkins[ci].difference_note,
      updated_at: timestamp,
    };
  }

  await Promise.all([save(KEYS.sessions, sessions), save(KEYS.checkins, checkins)]);
  return attachCheckin(sessions[si], checkins);
}

export async function deleteSession(id: string): Promise<void> {
  await seedIfNeeded();
  const [sessions, checkins] = await Promise.all([
    load<Session>(KEYS.sessions),
    load<Checkin>(KEYS.checkins),
  ]);
  await Promise.all([
    save(KEYS.sessions, sessions.filter((s) => s.id !== id)),
    save(KEYS.checkins, checkins.filter((c) => c.session_id !== id)),
  ]);
}

// ---- Journeys ----

export async function getJourneys(): Promise<Journey[]> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  return journeys.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getActiveJourney(): Promise<Journey | null> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  return journeys.find((j) => j.status === 'active') ?? null;
}

export async function getActiveJourneys(): Promise<Journey[]> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  return journeys.filter((j) => j.status === 'active');
}

export async function createJourney(input: CreateJourneyInput): Promise<Journey> {
  await seedIfNeeded();
  const profile = await getProfile();
  const timestamp = now();
  const journey: Journey = {
    id: uid(),
    user_id: profile.id,
    name: input.name,
    start_date: input.start_date ?? null,
    duration_days: input.duration_days ?? null,
    intentions: input.intentions ?? null,
    status: 'active',
    created_at: timestamp,
    closed_at: null,
  };
  const journeys = await load<Journey>(KEYS.journeys);
  await save(KEYS.journeys, [...journeys, journey]);
  return journey;
}

export async function updateJourney(
  id: string,
  input: UpdateJourneyInput
): Promise<Journey> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  const i = journeys.findIndex((j) => j.id === id);
  if (i === -1) throw new Error(`Journey not found: ${id}`);
  journeys[i] = {
    ...journeys[i],
    ...(input.name !== undefined && { name: input.name }),
    ...(input.start_date !== undefined && { start_date: input.start_date }),
    ...(input.duration_days !== undefined && { duration_days: input.duration_days }),
  };
  await save(KEYS.journeys, journeys);
  return journeys[i];
}

export async function closeJourney(id: string): Promise<Journey> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  const i = journeys.findIndex((j) => j.id === id);
  if (i === -1) throw new Error(`Journey not found: ${id}`);

  // Check session count — only offer Mirror if >= 1 session logged for this journey
  const sessions = await load<Session>(KEYS.sessions);
  const journeySessions = sessions.filter((s) => s.journey_id === id);

  journeys[i] = { ...journeys[i], status: 'closed', closed_at: now() };
  await save(KEYS.journeys, journeys);

  // Save a Journey Mirror offer if there is at least 1 session
  if (journeySessions.length >= 1) {
    await saveJourneyMirrorOffer({
      journey_id: id,
      journey_name: journeys[i].name,
      offered_at: now(),
    });
  }

  return journeys[i];
}

export async function reopenJourney(id: string): Promise<Journey> {
  await seedIfNeeded();
  const journeys = await load<Journey>(KEYS.journeys);
  const i = journeys.findIndex((j) => j.id === id);
  if (i === -1) throw new Error(`Journey not found: ${id}`);
  journeys[i] = { ...journeys[i], status: 'active', closed_at: null };
  await save(KEYS.journeys, journeys);
  return journeys[i];
}

export async function deleteJourney(id: string): Promise<void> {
  await seedIfNeeded();

  // Remove the journey
  const journeys = await load<Journey>(KEYS.journeys);
  const filtered = journeys.filter((j) => j.id !== id);
  await save(KEYS.journeys, filtered);

  // Set journey_id to null for all sessions linked to this journey (ON DELETE SET NULL behavior)
  const sessions = await load<Session>(KEYS.sessions);
  const updatedSessions = sessions.map((s) =>
    s.journey_id === id ? { ...s, journey_id: null } : s
  );
  await save(KEYS.sessions, updatedSessions);

  // Set journey_id to null for all integrations linked to this journey (ON DELETE SET NULL behavior)
  const integrations = await load<Integration>(KEYS.integrations);
  const updatedIntegrations = integrations.map((i) =>
    i.journey_id === id ? { ...i, journey_id: null } : i
  );
  await save(KEYS.integrations, updatedIntegrations);
}

// ---- Integrations ----

export async function getIntegrations(): Promise<Integration[]> {
  await seedIfNeeded();
  const integrations = await load<Integration>(KEYS.integrations);
  return integrations.sort((a, b) => b.note_date.localeCompare(a.note_date));
}

export async function createIntegration(
  input: CreateIntegrationInput
): Promise<Integration> {
  await seedIfNeeded();
  const profile = await getProfile();
  const activeJourneys = await getActiveJourneys();
  const timestamp = now();
  const integration: Integration = {
    id: uid(),
    user_id: profile.id,
    journey_id: activeJourneys.length === 1 ? activeJourneys[0].id : null,
    note_date: input.note_date,
    category: input.category,
    triggers_q1: input.triggers_q1 ?? null,
    triggers_q2: input.triggers_q2 ?? null,
    triggers_q3: input.triggers_q3 ?? null,
    memories_q1: input.memories_q1 ?? null,
    memories_q2: input.memories_q2 ?? null,
    memories_q3: input.memories_q3 ?? null,
    emotions_q1: input.emotions_q1 ?? null,
    emotions_q2: input.emotions_q2 ?? null,
    emotions_q3: input.emotions_q3 ?? null,
    body_q1: input.body_q1 ?? null,
    body_q2: input.body_q2 ?? null,
    body_q3: input.body_q3 ?? null,
    patterns_q1: input.patterns_q1 ?? null,
    patterns_q2: input.patterns_q2 ?? null,
    patterns_q3: input.patterns_q3 ?? null,
    meaning_q1: input.meaning_q1 ?? null,
    meaning_q2: input.meaning_q2 ?? null,
    meaning_q3: input.meaning_q3 ?? null,
    realizations_q1: input.realizations_q1 ?? null,
    realizations_q2: input.realizations_q2 ?? null,
    realizations_q3: input.realizations_q3 ?? null,
    actions_q1: input.actions_q1 ?? null,
    actions_q2: input.actions_q2 ?? null,
    actions_q3: input.actions_q3 ?? null,
    gratitude_q1: input.gratitude_q1 ?? null,
    gratitude_q2: input.gratitude_q2 ?? null,
    gratitude_q3: input.gratitude_q3 ?? null,
    free_text: input.free_text ?? null,
    carry_forward: input.carry_forward ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const integrations = await load<Integration>(KEYS.integrations);
  await save(KEYS.integrations, [...integrations, integration]);
  return integration;
}

export async function updateIntegration(
  id: string,
  input: UpdateIntegrationInput
): Promise<Integration> {
  await seedIfNeeded();
  const integrations = await load<Integration>(KEYS.integrations);
  const i = integrations.findIndex((n) => n.id === id);
  if (i === -1) throw new Error(`Integration not found: ${id}`);
  integrations[i] = { ...integrations[i], ...input, updated_at: now() };
  await save(KEYS.integrations, integrations);
  return integrations[i];
}

export async function deleteIntegration(id: string): Promise<void> {
  await seedIfNeeded();
  const integrations = await load<Integration>(KEYS.integrations);
  await save(KEYS.integrations, integrations.filter((n) => n.id !== id));
}

// ---- Mirrors ----
// Phase B: mirror-reflect Edge Function context block includes:
//   { sessions, integrations, profile: { goals, vocabulary_framework, experience_level } }
// Goals are passed so the AI can relate patterns back to what the user is working toward.
// Example context shape:
//   { goals: ['Nervous system regulation', 'Emotional release'], sessions: [...], integrations: [...] }

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
}

export async function getMirrors(): Promise<Mirror[]> {
  await seedIfNeeded();
  const mirrors = await load<Mirror>(KEYS.mirrors);
  return mirrors.sort(
    (a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
  );
}

export async function getLatestMirror(): Promise<Mirror | null> {
  const mirrors = await getMirrors();
  return mirrors[0] ?? null;
}

export async function saveMirror(data: Mirror): Promise<Mirror> {
  await seedIfNeeded();
  const mirrors = await load<Mirror>(KEYS.mirrors);
  const i = mirrors.findIndex((m) => m.id === data.id);
  if (i !== -1) mirrors[i] = data;
  else mirrors.push(data);
  await save(KEYS.mirrors, mirrors);
  return data;
}

export async function getMirrorUnlockStatus(): Promise<{
  unlocked: boolean;
  daysSinceSignup: number;
  totalSessions: number;
  sessionsNeeded: number;
}> {
  await seedIfNeeded();
  const profile = await load<Profile>(KEYS.profile);
  const sessions = await load<Session>(KEYS.sessions);

  const MIN_DAYS = 7;
  const MIN_SESSIONS = 7;

  const signupDate = new Date(profile.created_at);
  const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (24 * 60 * 60 * 1000));
  const totalSessions = sessions.length;

  const daysConditionMet = daysSinceSignup >= MIN_DAYS;
  const sessionsConditionMet = totalSessions >= MIN_SESSIONS;

  return {
    unlocked: daysConditionMet && sessionsConditionMet,
    daysSinceSignup,
    totalSessions,
    sessionsNeeded: Math.max(0, MIN_SESSIONS - totalSessions),
  };
}

export async function shouldShowWeeklyMirror(): Promise<boolean> {
  await seedIfNeeded();
  const mirrors = await load<Mirror>(KEYS.mirrors);
  const weeklies = mirrors
    .filter((m) => m.type === 'weekly')
    .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  const last = weeklies[0];
  const sevenDaysPassed =
    !last || Date.now() - new Date(last.generated_at).getTime() >= 7 * 24 * 60 * 60 * 1000;
  if (!sevenDaysPassed) return false;

  const sessions = await load<Session>(KEYS.sessions);
  const weekAgo = daysAgo(7).getTime();
  const recentCount = sessions.filter((s) => new Date(s.created_at).getTime() >= weekAgo).length;
  return recentCount >= 2;
}

export async function shouldShowMonthlyMirror(): Promise<boolean> {
  await seedIfNeeded();
  if (!isLastDayOfMonth(new Date())) return false;

  const sessions = await load<Session>(KEYS.sessions);
  const monthAgo = daysAgo(30).getTime();
  const recentCount = sessions.filter((s) => new Date(s.created_at).getTime() >= monthAgo).length;
  return recentCount >= 3;
}

export async function getMirrorPromptType(): Promise<'weekly' | 'monthly' | null> {
  if (await shouldShowMonthlyMirror()) return 'monthly';
  if (await shouldShowWeeklyMirror()) return 'weekly';
  return null;
}

// ---- Journey Mirror offers ----

// Save a pending Journey Mirror offer (called when a journey is closed)
export async function saveJourneyMirrorOffer(offer: JourneyMirrorOffer): Promise<void> {
  const offers = await load<JourneyMirrorOffer>(KEYS.journeyMirrorOffers);
  // Only add if not already present for this journey
  if (!offers.find((o) => o.journey_id === offer.journey_id)) {
    await save(KEYS.journeyMirrorOffers, [...offers, offer]);
  }
}

// Get all pending Journey Mirror offers (journeys closed but no Mirror generated yet)
export async function getPendingJourneyMirrorOffers(): Promise<JourneyMirrorOffer[]> {
  const [offers, mirrors] = await Promise.all([
    load<JourneyMirrorOffer>(KEYS.journeyMirrorOffers),
    load<Mirror>(KEYS.mirrors),
  ]);
  // Filter out any offers where a journey Mirror already exists for that journey_id
  const generatedJourneyIds = new Set(
    mirrors.filter((m) => m.type === 'journey' && m.journey_id).map((m) => m.journey_id!)
  );
  return offers.filter((o) => !generatedJourneyIds.has(o.journey_id));
}

// Get the Journey Mirror for a specific journey_id (null if not yet generated)
export async function getJourneyMirror(journeyId: string): Promise<Mirror | null> {
  const mirrors = await getMirrors();
  return mirrors.find((m) => m.type === 'journey' && m.journey_id === journeyId) ?? null;
}

// ---- Entitlement ----

export async function getEntitlement(): Promise<Entitlement> {
  if (process.env.EXPO_PUBLIC_DEV_MODE === 'true') return mockEntitlement;
  await seedIfNeeded();
  const raw = await AsyncStorage.getItem(KEYS.entitlement);
  return raw ? (JSON.parse(raw) as Entitlement) : { ...mockEntitlement, status: 'none', plan: null };
}

export async function isMirrorUnlocked(): Promise<boolean> {
  if (process.env.EXPO_PUBLIC_DEV_MODE === 'true') return true;
  const e = await getEntitlement();
  if (e.status !== 'active' && e.status !== 'grace_period') return false;
  if (!e.current_period_end) return false;
  return new Date(e.current_period_end) > new Date();
}

// ---- Dev utility ----

export async function resetToMockData(): Promise<void> {
  _seeded = false;
  await AsyncStorage.removeItem(KEYS.initialized);
  await seedIfNeeded();
}
