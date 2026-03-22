import { ExamConfig, VivaResponse } from "../types";

const EXAMS_KEY = 'viva_ai_exams';
const RESPONSES_KEY = 'viva_ai_responses';

export const saveExam = (exam: ExamConfig) => {
  const exams = getExams();
  exams.push(exam);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
};

export const getExams = (): ExamConfig[] => {
  const exams = localStorage.getItem(EXAMS_KEY);
  return exams ? JSON.parse(exams) : [];
};

export const saveResponse = (response: VivaResponse) => {
  const responses = getResponses();
  responses.push(response);
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
};

export const getResponses = (): VivaResponse[] => {
  const responses = localStorage.getItem(RESPONSES_KEY);
  return responses ? JSON.parse(responses) : [];
};

export const getAnalytics = (examId: string) => {
  const responses = getResponses().filter(r => r.examId === examId);
  if (responses.length === 0) return null;

  const averageGrade = responses.reduce((acc, r) => acc + r.grade, 0) / responses.length;
  const strugglingCount = responses.filter(r => r.grade < 5).length;

  return {
    averageGrade,
    strugglingCount,
    responses
  };
};
