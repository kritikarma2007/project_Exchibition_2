import { GoogleGenAI, Type } from "@google/genai";
import { ExamConfig, StudentAnswer } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
// const ai = new GoogleGenAI({ 
//   apiKey: import.meta.env.VITE_GEMINI_API_KEY 
// });


export const generateInitialQuestion = async (config: ExamConfig): Promise<string> => {
  const model = "gemini-3-flash-preview";
  
  if (config.customQuestions && config.customQuestions.length > 0) {
    return config.customQuestions[0];
  }

  const systemInstruction = `
    You are a teacher starting a viva for ${config.subject}.
    Difficulty: ${config.difficulty} (Keep it VERY simple, direct, and easy).
    Syllabus: ${config.syllabusText || 'General knowledge'}.
    
    Task: Generate the first question for the viva.
    Rules:
    - Short, spoken-style question.
    - Easy to understand.
    - Related to the subject.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: "Start the viva with the first question." }] }],
    config: { systemInstruction }
  });

  return response.text;
};

export const processAnswerAndGetNext = async (
  config: ExamConfig,
  currentQuestion: string,
  answer: string,
  currentQuestionIndex: number,
  previousAnswers: StudentAnswer[]
): Promise<{ evaluation: { isCorrect: boolean; feedback: string }; nextQuestion: string }> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a teacher conducting a viva for ${config.subject}.
    Difficulty: ${config.difficulty} (Keep it VERY simple, direct, and easy).
    Syllabus: ${config.syllabusText || 'General knowledge'}.
    
    Task:
    1. Evaluate the student's answer to the current question.
    2. Generate the next question (Question #${currentQuestionIndex + 2}).
    3. If all ${config.questionCount} questions are done, set nextQuestion to "VIVA_COMPLETE".
    
    Rules for Questions:
    - Short, spoken-style questions.
    - Easy to understand.
    - Related to the subject.
    - Do not repeat: ${JSON.stringify(previousAnswers.map(a => a.question))}.
  `;

  const prompt = `
    Current Question: ${currentQuestion}
    Student's Spoken Answer: ${answer}
    
    Evaluate this answer and provide the next question.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluation: {
            type: Type.OBJECT,
            properties: {
              isCorrect: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING }
            },
            required: ["isCorrect", "feedback"]
          },
          nextQuestion: { type: Type.STRING }
        },
        required: ["evaluation", "nextQuestion"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const finalizeViva = async (
  config: ExamConfig,
  answers: StudentAnswer[]
): Promise<{ grade: number; feedback: string; logicScore: number }> => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Evaluate this full viva for ${config.subject}:\n${JSON.stringify(answers)}\n\nProvide a final grade (1-10), logic score (1-10), and overall feedback.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.NUMBER },
          logicScore: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["grade", "logicScore", "feedback"]
      }
    }
  });

  return JSON.parse(response.text);
};
