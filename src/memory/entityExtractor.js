import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadProfile, saveProfile } from "./userProfile";

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

// ── Extract entities from conversation ────────────────────────────────────
export async function extractAndUpdateProfile(userMessage, botResponse) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(`
      Analyze this conversation exchange and extract any personal facts about the user.
      Only extract facts that are EXPLICITLY stated, never assume.
      
      User said: "${userMessage}"
      Bot responded: "${botResponse}"
      
      Respond with ONLY a valid JSON object with these exact keys.
      Use null for any field not mentioned. Use empty arrays [] for list fields not mentioned.
      
      {
        "name": "first name if mentioned or null",
        "job": "job title or role if mentioned or null",
        "location": "city or country if mentioned or null",
        "company": "company name if mentioned or null",
        "preferences": ["any preferences or likes mentioned"],
        "goals": ["any goals or objectives mentioned"],
        "projects": ["any projects or work mentioned"]
      }
      
      Respond with ONLY the JSON, no explanation, no markdown, no backticks.
    `);

    const text = result.response.text().trim();

    // Parse the JSON response
    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch {
      return; // Gemini didn't return valid JSON, skip
    }

    // Load current profile
    const currentProfile = loadProfile();
    let updated = false;

    // Merge extracted facts into profile — only update if we got new info
    if (extracted.name && !currentProfile.name) {
      currentProfile.name = extracted.name;
      updated = true;
    }
    if (extracted.job && !currentProfile.job) {
      currentProfile.job = extracted.job;
      updated = true;
    }
    if (extracted.location && !currentProfile.location) {
      currentProfile.location = extracted.location;
      updated = true;
    }
    if (extracted.company && !currentProfile.company) {
      currentProfile.company = extracted.company;
      updated = true;
    }

    // For arrays, merge new items
    if (extracted.preferences?.length) {
      const newPrefs = extracted.preferences.filter(
        p => p && !currentProfile.preferences.includes(p)
      );
      if (newPrefs.length) {
        currentProfile.preferences = [...currentProfile.preferences, ...newPrefs];
        updated = true;
      }
    }
    if (extracted.goals?.length) {
      const newGoals = extracted.goals.filter(
        g => g && !currentProfile.goals.includes(g)
      );
      if (newGoals.length) {
        currentProfile.goals = [...currentProfile.goals, ...newGoals];
        updated = true;
      }
    }
    if (extracted.projects?.length) {
      const newProjects = extracted.projects.filter(
        p => p && !currentProfile.projects.includes(p)
      );
      if (newProjects.length) {
        currentProfile.projects = [...currentProfile.projects, ...newProjects];
        updated = true;
      }
    }

    // Save if anything changed
    if (updated) {
      saveProfile(currentProfile);
      console.log('✅ Profile updated:', currentProfile);
      return currentProfile;
    }

  } catch (err) {
    console.error('Entity extraction failed:', err.message);
  }
}