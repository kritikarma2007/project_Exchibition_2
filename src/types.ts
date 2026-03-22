export type Difficulty = 'Simple' | 'Intermediate' | 'Hard';

export interface ExamConfig {
  id: string;
  subject: string;
  questionCount: number;
  difficulty: Difficulty;
  syllabusText?: string;
  timeLimit: number; // in minutes
  customQuestions?: string[];
  createdAt: number;
}

export interface StudentAnswer {
  question: string;
  answer: string;
  isCorrect: boolean;
  feedback: string;
}

export interface VivaResponse {
  id: string;
  examId: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  language: string;
  answers: StudentAnswer[];
  grade: number; // 1-10
  feedback: string;
  logicScore: number; // 1-10
  timestamp: number;
  timeTaken: number; // in seconds
}

export interface AnalyticsData {
  subject: string;
  averageGrade: number;
  strugglingCount: number;
  topicHeatmap: { topic: string; score: number }[];
}
