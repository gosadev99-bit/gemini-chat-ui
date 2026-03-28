import { GoogleGenerativeAI } from "@google/generative-ai";
import { runSalesAgent } from "./salesAgent";
import { runCodeReviewAgent } from "./codeReviewAgent";

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

export async function runOrchestrator(userMessage, onUpdate) {
  onUpdate("🤖 Orchestrator analyzing your request...");

  // Step 1 — Orchestrator decides which agent team to use
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const decision = await model.generateContent(`
    Analyze this user request and respond with ONLY one of these exact words:
    - SALES (if user wants to research a company/lead or draft outreach)
    - CODEREVIEW (if user wants to review code or a pull request)
    - GENERAL (if it's anything else)

    User request: "${userMessage}"
    
    Respond with ONE word only.
  `);

  const intent = decision.response.text().trim().toUpperCase();
  console.log("🎯 Orchestrator decision:", intent);

  // Step 2 — Route to the right agent team
  if (intent.includes("SALES")) {
    return await runSalesAgent(userMessage, onUpdate);
  }

  if (intent.includes("CODEREVIEW")) {
    return await runCodeReviewAgent(userMessage, onUpdate);
  }

  // Default — return null so regular agent handles it
  return null;
}