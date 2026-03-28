import { ExamConfig, VivaResponse } from '../types';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ── Helper ────────────────────────────────────────────────────────────────────
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ── Auto-generate short 6-char code ───────────────────────────────────────────
function generateExamCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Exams ─────────────────────────────────────────────────────────────────────

export async function saveExam(
  examData: Omit<ExamConfig, 'id' | 'examCode' | 'createdAt'>
): Promise<ExamConfig> {
  const code = generateExamCode();
  const newExamRef = doc(collection(db, 'exams'));
  
  const finalExam: ExamConfig = {
    ...examData,
    id: newExamRef.id,
    examCode: code,
    createdAt: Date.now(),
  };

  await setDoc(newExamRef, finalExam);
  return finalExam;
}

export async function getExams(teacherId: string): Promise<ExamConfig[]> {
  const q = query(collection(db, 'exams'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ExamConfig).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllExams(): Promise<ExamConfig[]> {
  const snapshot = await getDocs(collection(db, 'exams'));
  return snapshot.docs.map(doc => doc.data() as ExamConfig).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'exams', examId));
  
  // Also delete associated responses
  const q = query(collection(db, 'vivaResponses'), where('examId', '==', examId));
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(responseDoc => deleteDoc(responseDoc.ref));
  await Promise.all(deletePromises);
}

export async function verifyExamCode(
  examCode: string,
  studentId: string
): Promise<{ exam?: ExamConfig; error?: string }> {
  try {
    const q = query(collection(db, 'exams'), where('examCode', '==', examCode.toUpperCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { error: 'Invalid exam code.' };
    }
    
    const exam = snapshot.docs[0].data() as ExamConfig;

    // Verify enrollment
    const enrollQuery = query(
      collection(db, 'enrollments'),
      where('classroomId', '==', exam.classroomId),
      where('studentId', '==', studentId)
    );
    const enrollSnapshot = await getDocs(enrollQuery);
    
    if (enrollSnapshot.empty) {
      return { error: 'You are not enrolled in the classroom for this exam.' };
    }

    // Check if already taken
    const attemptQuery = query(
      collection(db, 'vivaResponses'),
      where('examId', '==', exam.id),
      where('studentId', '==', studentId)
    );
    const attemptSnapshot = await getDocs(attemptQuery);
    
    if (!attemptSnapshot.empty) {
      return { error: 'You have already completed this exam.' };
    }

    return { exam };
  } catch (err: any) {
    console.error(err);
    return { error: 'Failed to verify code. Check connection.' };
  }
}

// ── Responses ─────────────────────────────────────────────────────────────────

export async function saveResponse(response: Omit<VivaResponse, 'id'>): Promise<VivaResponse> {
  const newRef = doc(collection(db, 'vivaResponses'));
  const finalResponse: VivaResponse = {
    ...response,
    id: newRef.id,
  };
  
  await setDoc(newRef, finalResponse);
  return finalResponse;
}

export async function getStudentResponses(studentId: string): Promise<VivaResponse[]> {
  const q = query(collection(db, 'vivaResponses'), where('studentId', '==', studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as VivaResponse).sort((a, b) => b.timestamp - a.timestamp);
}

export async function getCompletedExamsForStudent(studentId: string): Promise<{ response: VivaResponse; exam: ExamConfig | null }[]> {
  const responses = await getStudentResponses(studentId);
  const results = [];
  for (const r of responses) {
    const examDoc = await getDoc(doc(db, 'exams', r.examId));
    results.push({
      response: r,
      exam: examDoc.exists() ? (examDoc.data() as ExamConfig) : null
    });
  }
  return results;
}

export async function getTeacherResponses(teacherId: string): Promise<VivaResponse[]> {
  // First get all exams by this teacher
  const examsQuery = query(collection(db, 'exams'), where('teacherId', '==', teacherId));
  const examsSnapshot = await getDocs(examsQuery);
  const examIds = examsSnapshot.docs.map(doc => doc.id);
  
  if (examIds.length === 0) return [];
  
  // Now get all responses for those exams
  // Firestore limit: 'in' queries support max 10 items.
  // For a real app, you might query responses directly by adding a teacherId to VivaResponse, 
  // but we'll fetch them in batches or do client-side filtering.
  // We'll fetch all responses and filter client-side since this is a demo/prototype.
  
  const allResponsesSnapshot = await getDocs(collection(db, 'vivaResponses'));
  const teacherResponses = allResponsesSnapshot.docs
    .map(doc => doc.data() as VivaResponse)
    .filter(res => examIds.includes(res.examId))
    .sort((a, b) => b.timestamp - a.timestamp);
    
  return teacherResponses;
}
