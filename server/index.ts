import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(express.json());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'teacher' | 'student';
  roleId: string;
  createdAt: number;
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  createdAt: number;
}

interface Enrollment {
  classroomId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  joinedAt: number;
}

interface ClassMessage {
  id: string;
  classroomId: string;
  text: string;
  examCode?: string;
  createdAt: number;
}

interface ExamConfig {
  id: string;
  examCode: string;      // 6-char access code
  subject: string;
  questionCount: number;
  difficulty: string;
  syllabusText?: string;
  timeLimit: number;
  customQuestions?: string[];
  teacherId: string;
  classroomId: string;
  classroomName: string;
  createdAt: number;
}

interface VivaResponse {
  id: string;
  examId: string;
  examCode: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  language: string;
  answers: any[];
  grade: number;
  feedback: string;
  logicScore: number;
  timestamp: number;
  timeTaken: number;
  cheatingStrikes?: number;
}

interface DB {
  users: User[];
  classrooms: Classroom[];
  enrollments: Enrollment[];
  messages: ClassMessage[];
  exams: ExamConfig[];
  vivaResponses: VivaResponse[];
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const empty: DB = { users: [], classrooms: [], enrollments: [], messages: [], exams: [], vivaResponses: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  // Migrate: fill missing collections
  if (!raw.classrooms) raw.classrooms = [];
  if (!raw.enrollments) raw.enrollments = [];
  if (!raw.messages) raw.messages = [];
  if (!raw.exams) raw.exams = [];
  if (!raw.vivaResponses) raw.vivaResponses = [];
  return raw as DB;
}

function writeDB(db: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateExamCode(): string {
  // 6-char alphanumeric code (uppercase)
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// ─── AUTH Routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role, roleId } = req.body;
  if (!name || !email || !password || !role || !roleId)
    return res.status(400).json({ error: 'All fields are required.' });

  const db = readDB();
  const exists = db.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role
  );
  if (exists)
    return res.status(409).json({ error: 'An account with this email already exists for this role.' });

  const newUser: User = {
    id: generateId(),
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    roleId,
    createdAt: Date.now(),
  };
  db.users.push(newUser);
  writeDB(db);
  const { passwordHash, ...safeUser } = newUser;
  return res.status(201).json({ user: safeUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role)
    return res.status(400).json({ error: 'Email, password, and role are required.' });

  const db = readDB();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role
  );
  if (!user) return res.status(404).json({ error: 'No account found with this email for the selected role.' });
  if (user.passwordHash !== hashPassword(password))
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });

  const { passwordHash, ...safeUser } = user;
  return res.status(200).json({ user: safeUser });
});

app.get('/api/auth/users', (_req, res) => {
  const db = readDB();
  const safeUsers = db.users.map(({ passwordHash, ...u }) => u);
  res.json({ users: safeUsers });
});

// ─── CLASSROOM Routes ─────────────────────────────────────────────────────────

// Create classroom
app.post('/api/classrooms', (req, res) => {
  const { name, subject, teacherId, teacherName } = req.body;
  if (!name || !subject || !teacherId || !teacherName)
    return res.status(400).json({ error: 'name, subject, teacherId, teacherName are required.' });

  const db = readDB();
  const classroom: Classroom = {
    id: generateId(),
    name,
    subject,
    teacherId,
    teacherName,
    createdAt: Date.now(),
  };
  db.classrooms.push(classroom);
  writeDB(db);
  return res.status(201).json({ classroom });
});

// Get teacher's classrooms
app.get('/api/classrooms', (req, res) => {
  const { teacherId } = req.query;
  const db = readDB();
  const classrooms = teacherId
    ? db.classrooms.filter((c) => c.teacherId === teacherId)
    : db.classrooms;
  return res.json({ classrooms });
});

// Delete classroom
app.delete('/api/classrooms/:id', (req, res) => {
  const db = readDB();
  const idx = db.classrooms.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Classroom not found.' });
  db.classrooms.splice(idx, 1);
  // Also remove enrollments and messages
  db.enrollments = db.enrollments.filter((e) => e.classroomId !== req.params.id);
  db.messages = db.messages.filter((m) => m.classroomId !== req.params.id);
  writeDB(db);
  return res.json({ ok: true });
});

// Add student to classroom by email
app.post('/api/classrooms/:id/students', (req, res) => {
  const { studentEmail } = req.body;
  const classroomId = req.params.id;
  if (!studentEmail) return res.status(400).json({ error: 'studentEmail is required.' });

  const db = readDB();
  const classroom = db.classrooms.find((c) => c.id === classroomId);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found.' });

  const student = db.users.find(
    (u) => u.email.toLowerCase() === studentEmail.toLowerCase() && u.role === 'student'
  );
  if (!student) return res.status(404).json({ error: 'No student account found with this email.' });

  const alreadyEnrolled = db.enrollments.find(
    (e) => e.classroomId === classroomId && e.studentId === student.id
  );
  if (alreadyEnrolled) return res.status(409).json({ error: 'Student is already enrolled.' });

  const enrollment: Enrollment = {
    classroomId,
    studentId: student.id,
    studentName: student.name,
    studentEmail: student.email,
    joinedAt: Date.now(),
  };
  db.enrollments.push(enrollment);
  writeDB(db);
  return res.status(201).json({ enrollment });
});

// Get students in a classroom
app.get('/api/classrooms/:id/students', (req, res) => {
  const db = readDB();
  const enrollments = db.enrollments.filter((e) => e.classroomId === req.params.id);
  return res.json({ students: enrollments });
});

// Remove student from classroom
app.delete('/api/classrooms/:id/students/:studentId', (req, res) => {
  const db = readDB();
  const idx = db.enrollments.findIndex(
    (e) => e.classroomId === req.params.id && e.studentId === req.params.studentId
  );
  if (idx === -1) return res.status(404).json({ error: 'Enrollment not found.' });
  db.enrollments.splice(idx, 1);
  writeDB(db);
  return res.json({ ok: true });
});

// Post message to classroom
app.post('/api/classrooms/:id/messages', (req, res) => {
  const { text, examCode } = req.body;
  const classroomId = req.params.id;
  if (!text) return res.status(400).json({ error: 'text is required.' });

  const db = readDB();
  const classroom = db.classrooms.find((c) => c.id === classroomId);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found.' });

  const message: ClassMessage = {
    id: generateId(),
    classroomId,
    text,
    examCode,
    createdAt: Date.now(),
  };
  db.messages.push(message);
  writeDB(db);
  return res.status(201).json({ message });
});

// Get messages for classroom
app.get('/api/classrooms/:id/messages', (req, res) => {
  const db = readDB();
  const messages = db.messages
    .filter((m) => m.classroomId === req.params.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  return res.json({ messages });
});

// ─── STUDENT: get enrolled classrooms ─────────────────────────────────────────
app.get('/api/student/classrooms', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId is required.' });
  const db = readDB();
  const enrollments = db.enrollments.filter((e) => e.studentId === studentId);
  const classroomIds = enrollments.map((e) => e.classroomId);
  const classrooms = db.classrooms.filter((c) => classroomIds.includes(c.id));
  return res.json({ classrooms });
});

// ─── EXAM Routes ──────────────────────────────────────────────────────────────

// Create exam (generates unique 6-char code)
app.post('/api/exams', (req, res) => {
  const { subject, questionCount, difficulty, syllabusText, timeLimit, customQuestions, teacherId, classroomId, classroomName } = req.body;
  if (!subject || !teacherId || !classroomId)
    return res.status(400).json({ error: 'subject, teacherId, classroomId are required.' });

  const db = readDB();

  // Generate unique code
  let examCode = generateExamCode();
  let retries = 0;
  while (db.exams.find((e) => e.examCode === examCode) && retries < 10) {
    examCode = generateExamCode();
    retries++;
  }

  const exam: ExamConfig = {
    id: generateId(),
    examCode,
    subject,
    questionCount: questionCount || 5,
    difficulty: difficulty || 'Simple',
    syllabusText,
    timeLimit: timeLimit || 10,
    customQuestions: customQuestions || [],
    teacherId,
    classroomId,
    classroomName: classroomName || '',
    createdAt: Date.now(),
  };
  db.exams.push(exam);
  writeDB(db);
  return res.status(201).json({ exam });
});

// Get teacher's exams
app.get('/api/exams', (req, res) => {
  const { teacherId } = req.query;
  const db = readDB();
  const exams = teacherId
    ? db.exams.filter((e) => e.teacherId === teacherId)
    : db.exams;
  return res.json({ exams });
});

// Delete exam
app.delete('/api/exams/:id', (req, res) => {
  const db = readDB();
  const idx = db.exams.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Exam not found.' });
  db.exams.splice(idx, 1);
  writeDB(db);
  return res.json({ ok: true });
});

// Verify exam code (student submits code → get exam config)
app.post('/api/exams/verify-code', (req, res) => {
  const { examCode, studentId } = req.body;
  if (!examCode || !studentId) return res.status(400).json({ error: 'examCode and studentId are required.' });

  const db = readDB();
  const exam = db.exams.find((e) => e.examCode === examCode.toUpperCase());
  if (!exam) return res.status(404).json({ error: 'Invalid exam code. Please check and try again.' });

  // Check student is enrolled in the classroom
  const enrolled = db.enrollments.find(
    (e) => e.classroomId === exam.classroomId && e.studentId === studentId
  );
  if (!enrolled)
    return res.status(403).json({ error: 'You are not enrolled in the classroom this exam belongs to.' });

  // Check if student already submitted this exam
  const alreadySubmitted = db.vivaResponses.find(
    (r) => r.examId === exam.id && r.studentId === studentId
  );
  if (alreadySubmitted)
    return res.status(409).json({ error: 'You have already completed this exam.' });

  return res.json({ exam });
});

// ─── VIVA RESPONSE Routes ─────────────────────────────────────────────────────

// Save viva response
app.post('/api/viva-responses', (req, res) => {
  const body = req.body;
  if (!body.examId || !body.studentId)
    return res.status(400).json({ error: 'examId and studentId are required.' });

  const db = readDB();
  const response: VivaResponse = {
    id: generateId(),
    ...body,
    timestamp: Date.now(),
  };
  db.vivaResponses.push(response);
  writeDB(db);
  return res.status(201).json({ response });
});

// Get responses for an exam
app.get('/api/viva-responses', (req, res) => {
  const { examId, teacherId } = req.query;
  const db = readDB();
  let responses = db.vivaResponses;
  if (examId) responses = responses.filter((r) => r.examId === examId);
  if (teacherId) {
    const teacherExamIds = db.exams.filter((e) => e.teacherId === teacherId).map((e) => e.id);
    responses = responses.filter((r) => teacherExamIds.includes(r.examId));
  }
  return res.json({ responses: responses.sort((a, b) => b.timestamp - a.timestamp) });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Auth backend running at http://localhost:${PORT}`);
});
