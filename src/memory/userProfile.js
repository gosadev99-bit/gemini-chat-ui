// ── USER PROFILE — Permanent long-term memory ──────────────────────────────
// Unlike chat history (sliding window), profile facts are NEVER deleted
// They load into every conversation so the agent always knows who you are

const PROFILE_KEY = 'gossaye-user-profile';

// Default empty profile structure
const DEFAULT_PROFILE = {
  name: null,
  job: null,
  location: null,
  company: null,
  preferences: [],
  goals: [],
  projects: [],
  lastUpdated: null
};

// ── Load profile from localStorage ────────────────────────────────────────
export function loadProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

// ── Save profile to localStorage ──────────────────────────────────────────
export function saveProfile(profile) {
  try {
    const updated = { ...profile, lastUpdated: new Date().toISOString() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    console.error('Failed to save profile');
    return profile;
  }
}

// ── Clear profile ──────────────────────────────────────────────────────────
export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

// ── Format profile into a system prompt string ────────────────────────────
// This is the RAG part — we inject relevant profile facts into every request
export function formatProfileForPrompt(profile) {
  const facts = [];

  if (profile.name) facts.push(`User's name: ${profile.name}`);
  if (profile.job) facts.push(`User's job/role: ${profile.job}`);
  if (profile.location) facts.push(`User's location: ${profile.location}`);
  if (profile.company) facts.push(`User's company: ${profile.company}`);
  if (profile.preferences?.length) {
    facts.push(`User's preferences: ${profile.preferences.join(', ')}`);
  }
  if (profile.goals?.length) {
    facts.push(`User's goals: ${profile.goals.join(', ')}`);
  }
  if (profile.projects?.length) {
    facts.push(`User's projects: ${profile.projects.join(', ')}`);
  }

  if (facts.length === 0) return '';

  return `\n\nKNOWN USER FACTS (remember these always):\n${facts.map(f => `- ${f}`).join('\n')}`;
}