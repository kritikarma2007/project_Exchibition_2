import { GoogleGenAI } from "@google/genai";
import { ExamConfig, StudentAnswer } from "../types";

const API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is missing! Check .env and restart the dev server.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL = "gemini-2.5-flash";

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  English: 'en-US',
  Hindi: 'hi-IN',
  Marathi: 'mr-IN',
  Hinglish: 'hi-IN',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips ```json fences and extracts the first { } block */
function safeParseJSON(raw: string | undefined | null): any {
  if (!raw || !raw.trim()) throw new Error('Empty response from AI.');
  let text = raw.trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error(`Cannot parse JSON from AI. Raw: ${text.slice(0, 300)}`);
  }
}

/** Auto-retry up to 3 times with 1s back-off between attempts */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[Gemini] Attempt ${attempt}/${maxAttempts} failed:`, err);
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
}

/** Send one plain-text message and return the raw response string */
async function chat(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const text = response.text?.trim();
  if (!text) throw new Error('Empty response from Gemini API.');
  return text;
}

// ─── 1. Generate the first question ──────────────────────────────────────────

export const generateInitialQuestion = async (
  config: ExamConfig,
  language = 'English'
): Promise<string> => {

  // If teacher set custom questions, return the first one directly — no AI needed
  if (config.customQuestions && config.customQuestions.length > 0) {
    return config.customQuestions[0];
  }

  const syllabus = config.syllabusText?.trim()
    ? `The specific syllabus is:\n${config.syllabusText}`
    : `Cover general topics in ${config.subject}.`;

  const prompt =
    `You are conducting a viva exam. Start with ONE opening question.

EXAM DETAILS:
- Subject: ${config.subject}
- Difficulty: ${config.difficulty}
- ${syllabus}
- Language: Ask in ${language} ONLY${language === 'Hinglish' ? ' (mix Hindi + English naturally)' : ''}.

RULES:
- The question MUST be about ${config.subject} specifically.
- Keep it SHORT (one sentence).
- Do NOT write any preamble. Output only the question itself.
- The question must match the difficulty level: ${config.difficulty}.`;

  return withRetry(() => chat(prompt));
};

// ─── 2. Evaluate answer + generate next question ──────────────────────────────

export const processAnswerAndGetNext = async (
  config: ExamConfig,
  currentQuestion: string,
  answer: string,
  currentQuestionIndex: number,
  previousAnswers: StudentAnswer[],
  language = 'English'
): Promise<{
  evaluation: { score: number; isCorrect: boolean; feedback: string };
  nextQuestion: string;
}> => {

  const totalQuestions = config.customQuestions?.length || config.questionCount;
  const isLastQuestion = currentQuestionIndex + 1 >= totalQuestions;

  // Next predefined question (if teacher set custom questions)
  const nextCustomQ = !isLastQuestion && config.customQuestions?.[currentQuestionIndex + 1]
    ? config.customQuestions[currentQuestionIndex + 1]
    : null;

  const prevQList = previousAnswers.map(a => a.question);
  const syllabus = config.syllabusText?.trim()
    ? config.syllabusText
    : `General topics in ${config.subject}`;

  const nextQInstruction = isLastQuestion
    ? 'This is the LAST question. Set nextQuestion to exactly the string: VIVA_COMPLETE'
    : nextCustomQ
      ? `The next question is pre-set. Set nextQuestion to exactly: "${nextCustomQ}"`
      : `Generate the NEXT viva question on ${config.subject}. It MUST come from this syllabus: "${syllabus}". Difficulty: ${config.difficulty}. Do NOT repeat: ${JSON.stringify(prevQList)}. Keep it short, one sentence, in ${language}.`;

  const prompt =
    `You are evaluating a student's viva answer. Reply with valid JSON ONLY.

EXAM: ${config.subject} | Difficulty: ${config.difficulty}
QUESTION (${currentQuestionIndex + 1}/${totalQuestions}): "${currentQuestion}"
STUDENT ANSWER: "${answer}"
LANGUAGE: All text in your response must be in ${language}${language === 'Hinglish' ? ' (mix Hindi + English)' : ''}.

INSTRUCTIONS:
1. Score the answer 0–10 (0=completely wrong, 10=perfect). isCorrect = true if score >= 6.
2. Write 1–2 sentences of feedback: what was good, what was missing.
3. ${nextQInstruction}

Return ONLY this JSON — no markdown, no explanation, no extra keys:
{
  "evaluation": {
    "score": <integer 0-10>,
    "isCorrect": <true|false>,
    "feedback": "<1-2 sentences>"
  },
  "nextQuestion": "<question text or VIVA_COMPLETE>"
}`;

  return withRetry(async () => {
    const raw = await chat(prompt);
    const parsed = safeParseJSON(raw);

    const score = Math.max(0, Math.min(10, Number(parsed?.evaluation?.score ?? 0)));
    return {
      evaluation: {
        score,
        isCorrect: score >= 6,
        feedback: String(parsed?.evaluation?.feedback || 'No feedback.'),
      },
      nextQuestion: String(parsed?.nextQuestion || 'VIVA_COMPLETE'),
    };
  });
};

// ─── 3. Final holistic grade ──────────────────────────────────────────────────

export const finalizeViva = async (
  config: ExamConfig,
  answers: StudentAnswer[],
  language = 'English'
): Promise<{ grade: number; feedback: string; logicScore: number }> => {

  const transcript = answers.map((a, i) =>
    `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}\nScore given: ${a.score}/10\nFeedback: ${a.feedback}`
  ).join('\n\n');

  const prompt =
    `You are finalising a ${config.subject} viva exam. Reply with valid JSON ONLY.

Difficulty: ${config.difficulty}
Language: Write feedback in ${language}.

Full transcript:
${transcript}

Give:
- grade: overall knowledge 1–10
- logicScore: logical reasoning 1–10  
- feedback: 3–5 sentences covering strongest point, weakest point, one improvement tip.

Return ONLY this JSON:
{
  "grade": <integer 1-10>,
  "logicScore": <integer 1-10>,
  "feedback": "<3-5 sentences>"
}`;

  return withRetry(async () => {
    const raw = await chat(prompt);
    const result = safeParseJSON(raw);
    return {
      grade: Math.max(1, Math.min(10, Number(result?.grade) || 5)),
      logicScore: Math.max(1, Math.min(10, Number(result?.logicScore) || 5)),
      feedback: String(result?.feedback || 'Exam completed.'),
    };
  });
};
