const fs = require("fs");
const path = require("path");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const AI_SUGGESTIONS_JSONL = path.join(path.resolve("data"), "ai-suggestions.jsonl");

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function questionForAI(question) {
  return {
    type: question.type || "",
    stem: question.stem || "",
    options: (question.options || []).map((option) => ({
      label: String(option.label || "").toUpperCase(),
      text: option.text || ""
    }))
  };
}

function buildSchema(question) {
  const labels = (question.options || []).map((option) => String(option.label || "").toUpperCase()).filter(Boolean);
  return {
    type: "object",
    additionalProperties: false,
    required: ["labels", "confidence", "needsReview", "reason"],
    properties: {
      labels: {
        type: "array",
        description: "Answer labels chosen from the provided option labels. Use one label for single choice or judgement questions.",
        items: labels.length ? { type: "string", enum: labels } : { type: "string" }
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Your confidence from 0 to 1."
      },
      needsReview: {
        type: "boolean",
        description: "True when the answer is uncertain or needs human review."
      },
      reason: {
        type: "string",
        description: "A concise explanation. Do not include hidden chain-of-thought."
      }
    }
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const texts = [];
  for (const item of payload?.output || []) {
    for (const part of item.content || []) {
      if (typeof part.text === "string") texts.push(part.text);
    }
  }
  return texts.join("\n").trim();
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("AI response had no text output.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`AI response was not JSON: ${trimmed.slice(0, 200)}`);
    return JSON.parse(match[0]);
  }
}

function normalizeSuggestion(raw, question, model, response) {
  const validLabels = new Set((question.options || []).map((option) => String(option.label || "").toUpperCase()));
  const labels = [...new Set((raw.labels || []).map((label) => String(label).trim().toUpperCase()))].filter((label) =>
    validLabels.has(label)
  );
  const confidence = clamp(raw.confidence, 0, 1);
  return {
    model,
    responseId: response?.id || "",
    labels,
    confidence,
    needsReview: Boolean(raw.needsReview) || !labels.length,
    reason: String(raw.reason || "").trim(),
    usage: response?.usage || null
  };
}

async function inferAnswerWithAI(question, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for AI suggestions.");
  }
  if (typeof fetch !== "function") {
    throw new Error("This Node.js runtime does not provide fetch; use Node 18+.");
  }

  const model = options.model || DEFAULT_MODEL;
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const reasoningEffort = options.reasoningEffort || process.env.OPENAI_REASONING_EFFORT || "";
  const promptQuestion = questionForAI(question);
  const payload = {
    model,
    input: [
      {
        role: "system",
        content:
          "You are a cautious study assistant for authorized, non-graded practice quizzes. " +
          "Choose answer labels from the provided options only. " +
          "If the item is uncertain, mark needsReview=true and lower confidence. " +
          "Return concise JSON only; do not include hidden chain-of-thought."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task:
              "Infer the most likely correct answer labels for this practice question. Use labels such as A, B, C only.",
            question: promptQuestion
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "quiz_answer_suggestion",
        strict: true,
        schema: buildSchema(question)
      }
    },
    max_output_tokens: 500
  };
  if (reasoningEffort && reasoningEffort !== "none") {
    payload.reasoning = { effort: reasoningEffort };
  }

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${bodyText.slice(0, 500)}`);
  }

  const body = JSON.parse(bodyText);
  const parsed = parseJsonObject(extractOutputText(body));
  return normalizeSuggestion(parsed, promptQuestion, model, body);
}

function appendAISuggestion(event, filePath = AI_SUGGESTIONS_JSONL) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

module.exports = {
  AI_SUGGESTIONS_JSONL,
  DEFAULT_MODEL,
  appendAISuggestion,
  inferAnswerWithAI,
  questionForAI
};
