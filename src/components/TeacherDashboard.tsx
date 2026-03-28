import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import Markdown from 'react-markdown';
import {
  Plus, Trash2, FileText, BarChart2, BookOpen, Users, MessageSquare,
  Home, ChevronRight, Copy, Check, Send, UserX, UserPlus, X, Award,
  Clock, GraduationCap, Key, AlertCircle, Layers, ChevronDown, ChevronUp, User, Mail, Loader2
} from 'lucide-react';
import { ExamConfig, Difficulty, Classroom, Enrollment, ClassMessage, VivaResponse } from '../types';
import { saveExam, getExams, getTeacherResponses, deleteExam } from '../services/storage';
import {
  createClassroom, getTeacherClassrooms, deleteClassroom,
  addStudentToClassroom, getClassroomStudents, removeStudentFromClassroom,
  postMessage, getMessages,
} from '../services/classroom';

interface Props {
  user: { name: string; email: string; id: string };
}

type SidebarTab = 'overview' | 'classrooms' | 'exams' | 'analytics';

const difficultyColor = (d: string) =>
  d === 'Hard' ? 'bg-red-100 text-red-700' :
  d === 'Intermediate' ? 'bg-amber-100 text-amber-700' :
  'bg-emerald-100 text-emerald-700';

// ─── Classroom Detail ─────────────────────────────────────────────────────────
const ClassroomDetail: React.FC<{
  classroom: Classroom;
  teacherName: string;
  exams: ExamConfig[];
  onBack: () => void;
}> = ({ classroom, teacherName, exams, onBack }) => {
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgExamCode, setMsgExamCode] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'students' | 'messages'>('students');

  const classroomExams = exams.filter(e => e.classroomId === classroom.id);

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      getClassroomStudents(classroom.id),
      getMessages(classroom.id),
    ]);
    setStudents(s);
    setMessages(m);
  }, [classroom.id]);

  useEffect(() => { load(); }, [load]);

  const handleAddStudent = async () => {
    if (!addEmail.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      await addStudentToClassroom(classroom.id, addEmail.trim());
      setAddEmail('');
      await load();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Remove this student from the classroom?')) return;
    await removeStudentFromClassroom(classroom.id, studentId);
    await load();
  };

  const handlePostMessage = async () => {
    if (!msgText.trim()) return;
    setMsgLoading(true);
    try {
      await postMessage(classroom.id, msgText.trim(), msgExamCode.trim() || undefined);
      setMsgText('');
      setMsgExamCode('');
      await load();
    } finally {
      setMsgLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl flex items-center justify-center text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-all group"
        >
          <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold leading-tight text-white">{classroom.name}</h2>
          <p className="text-[13px] font-semibold text-[rgba(255,255,255,0.5)] mt-0.5">{classroom.subject} <span className="text-[rgba(255,255,255,0.2)] mx-1">•</span> {classroomExams.length} Exams</p>
        </div>
      </div>

      {/* Exam codes for this classroom */}
      {classroomExams.length > 0 && (
        <div className="bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] rounded-[14px] p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-3 flex items-center gap-2">
            <Key size={14} /> Exam Codes for this Classroom
          </p>
          <div className="flex flex-wrap gap-2">
            {classroomExams.map(ex => (
              <button
                key={ex.id}
                onClick={() => copyToClipboard(ex.examCode)}
                className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-2 rounded-[8px] text-[13px] font-mono font-bold text-white hover:bg-[rgba(124,58,237,0.4)] hover:border-[#a78bfa] transition-all"
              >
                {copied === ex.examCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-[rgba(255,255,255,0.5)]" />}
                <span className="tracking-[2px]">{ex.examCode}</span>
                <span className="font-sans font-semibold text-[11px] text-[rgba(255,255,255,0.4)] ml-1">– {ex.subject}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section toggle */}
      <div className="flex gap-2 bg-[rgba(255,255,255,0.04)] p-1 rounded-xl w-fit border border-[rgba(255,255,255,0.08)]">
        {(['students', 'messages'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold capitalize transition-all ${activeSection === tab ? 'bg-[rgba(255,255,255,0.1)] text-white shadow-sm' : 'text-[rgba(255,255,255,0.4)] hover:text-white'}`}
          >
            {tab === 'students' ? `Students (${students.length})` : `Messages (${messages.length})`}
          </button>
        ))}
      </div>

      {activeSection === 'students' && (
        <div className="space-y-4">
          {/* Add student */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Student email address…"
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddStudent()}
              className="flex-1 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[10px] px-4 py-3 text-[13px] focus:ring-2 focus:ring-[#7c3aed] text-white placeholder-[rgba(255,255,255,0.3)] outline-none transition-all"
            />
            <button
              onClick={handleAddStudent}
              disabled={addLoading}
              className="bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white px-5 py-3 rounded-[10px] flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 text-[13px] font-bold"
            >
              <UserPlus size={16} />
              {addLoading ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && (
            <div className="flex items-center gap-2 text-[#fca5a5] text-[13px] bg-[rgba(239,68,68,0.15)] rounded-[10px] px-4 py-3 border border-[rgba(239,68,68,0.3)]">
              <AlertCircle size={15} />
              {addError}
            </div>
          )}

          {/* Students list */}
          {students.length === 0 ? (
            <div className="text-center py-12 text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px]">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.5)]">No students yet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)]">
              {students.map((s, i) => (
                <div key={s.studentId} className={`flex items-center justify-between px-5 py-3 hover:bg-[rgba(255,255,255,0.04)] transition-colors group ${i !== students.length - 1 ? 'border-b border-[rgba(255,255,255,0.06)]' : ''}`}>
                  <div>
                    <p className="font-semibold text-[14px] text-white">{s.studentName}</p>
                    <p className="text-[12px] text-[rgba(255,255,255,0.5)]">{s.studentEmail}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(s.studentId)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-[#fca5a5] hover:bg-[rgba(239,68,68,0.1)] transition-all"
                    title="Remove student"
                  >
                    <UserX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'messages' && (
        <div className="space-y-4">
          {/* Compose */}
          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-4 space-y-3">
            <textarea
              placeholder="Post an announcement or exam details to this class…"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              className="w-full resize-none bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] rounded-[10px] px-4 py-3 text-[14px] text-white focus:ring-2 focus:ring-[#7c3aed] placeholder-[rgba(255,255,255,0.3)] outline-none transition-all h-24"
            />
            <div className="flex gap-2">
              <input
                placeholder="Attach exam code (optional)"
                value={msgExamCode}
                onChange={e => setMsgExamCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-48 bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] rounded-[10px] px-3 py-2 text-[13px] text-white font-mono placeholder-[rgba(255,255,255,0.3)] uppercase focus:ring-2 focus:ring-[#7c3aed] outline-none"
              />
              <button
                onClick={handlePostMessage}
                disabled={msgLoading || !msgText.trim()}
                className="ml-auto bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white px-5 py-2 rounded-[10px] flex items-center gap-2 text-[13px] font-bold hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Send size={15} />
                {msgLoading ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>

          {/* Messages */}
          {messages.length === 0 ? (
            <div className="text-center py-12 text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px]">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.5)]">No messages yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5">
                  <p className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.9)]">{m.text}</p>
                  {m.examCode && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-[#a78bfa] font-bold uppercase tracking-widest">Exam Code:</span>
                      <button
                        onClick={() => copyToClipboard(m.examCode!)}
                        className="flex items-center gap-1.5 font-mono font-bold text-[13px] bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] text-white px-3 py-1.5 rounded-[8px] hover:bg-[rgba(124,58,237,0.5)] transition-all tracking-[1.5px]"
                      >
                        {copied === m.examCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-[#a78bfa]" />}
                        {m.examCode}
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase font-bold tracking-wider mt-3">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ─── Create Exam Modal ────────────────────────────────────────────────────────
const CreateExamModal: React.FC<{
  classrooms: Classroom[];
  teacherId: string;
  onCreated: (exam: ExamConfig) => void;
  onClose: () => void;
}> = ({ classrooms, teacherId, onCreated, onClose }) => {
  const [form, setForm] = useState({
    subject: '',
    questionCount: 5,
    difficulty: 'Simple' as Difficulty,
    syllabusText: '',
    timeLimit: 10,
    customQuestionsText: '',
    classroomId: classrooms[0]?.id || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.classroomId) {
      setError('Subject and classroom are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const questions = form.customQuestionsText
        ? form.customQuestionsText.split('\n').filter(q => q.trim())
        : [];
      const classroom = classrooms.find(c => c.id === form.classroomId)!;
      const exam = await saveExam({
        subject: form.subject.trim(),
        questionCount: questions.length > 0 ? questions.length : form.questionCount,
        difficulty: form.difficulty,
        syllabusText: form.syllabusText,
        timeLimit: form.timeLimit,
        customQuestions: questions,
        teacherId,
        classroomId: form.classroomId,
        classroomName: classroom.name,
      });
      onCreated(exam);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[rgba(15,12,41,0.98)] border border-[rgba(255,255,255,0.1)] rounded-[16px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <h3 className="text-xl font-bold text-white">Create New Exam</h3>
            <p className="text-[13px] text-[rgba(255,255,255,0.5)] mt-0.5">An access code will be auto-generated</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-[#fca5a5] text-[13px] bg-[rgba(239,68,68,0.15)] rounded-[10px] px-4 py-3 border border-[rgba(239,68,68,0.3)]">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Classroom */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Classroom</label>
            {classrooms.length === 0 ? (
              <div className="bg-[rgba(245,158,11,0.15)] text-[#fcd34d] text-sm rounded-[10px] px-4 py-3 border border-[rgba(245,158,11,0.3)]">
                Create a classroom first before making an exam.
              </div>
            ) : (
              <select
                value={form.classroomId}
                onChange={e => setForm({ ...form, classroomId: e.target.value })}
                className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[10px] px-4 py-3 text-[14px] text-white focus:ring-2 focus:ring-[#7c3aed] outline-none"
              >
                {classrooms.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#1a1a24] text-white">{c.name} – {c.subject}</option>
                ))}
              </select>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Subject</label>
            <input
              type="text"
              placeholder="e.g. Data Structures and Algorithms"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[10px] px-4 py-3 text-[14px] text-white focus:ring-2 focus:ring-[#7c3aed] outline-none placeholder-[rgba(255,255,255,0.3)]"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Difficulty</label>
            <div className="flex gap-2">
              {(['Simple', 'Intermediate', 'Hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setForm({ ...form, difficulty: d })}
                  className={`flex-1 py-2.5 rounded-[10px] font-bold text-[13px] transition-all border ${form.difficulty === d ? d === 'Simple' ? 'bg-[rgba(16,185,129,0.2)] border-[#10b981] text-[#6ee7b7]' : d === 'Intermediate' ? 'bg-[rgba(245,158,11,0.2)] border-[#f59e0b] text-[#fcd34d]' : 'bg-[rgba(239,68,68,0.2)] border-[#ef4444] text-[#fca5a5]' : 'bg-[rgba(255,255,255,0.05)] border-transparent text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Questions</label>
              <input
                type="number" min={1} max={20}
                value={form.questionCount}
                onChange={e => setForm({ ...form, questionCount: +e.target.value })}
                className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[10px] px-4 py-3 text-[14px] text-white focus:ring-2 focus:ring-[#7c3aed] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Time Limit (min)</label>
              <input
                type="number" min={1} max={120}
                value={form.timeLimit}
                onChange={e => setForm({ ...form, timeLimit: +e.target.value })}
                className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[10px] px-4 py-3 text-[14px] text-white focus:ring-2 focus:ring-[#7c3aed] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Custom Questions (one per line – optional)</label>
            <textarea
              placeholder={'What is a linked list?\nExplain Big-O notation.'}
              value={form.customQuestionsText}
              onChange={e => setForm({ ...form, customQuestionsText: e.target.value })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[10px] px-4 py-3 text-[14px] text-white font-mono h-28 resize-none focus:ring-2 focus:ring-[#7c3aed] outline-none placeholder-[rgba(255,255,255,0.3)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] mb-2">Syllabus / Context</label>
            <textarea
              placeholder="Paste relevant chapter text or topics…"
              value={form.syllabusText}
              onChange={e => setForm({ ...form, syllabusText: e.target.value })}
              className="w-full bg-[rgba(124,58,237,0.08)] border-2 border-dashed border-[rgba(124,58,237,0.5)] rounded-[14px] px-4 py-4 text-[14px] text-white h-32 resize-none focus:bg-[rgba(124,58,237,0.15)] outline-none transition-colors placeholder-[rgba(255,255,255,0.3)]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-[16px] rounded-[10px] font-bold text-[14px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white transition-all">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={loading || classrooms.length === 0}
              className="flex-1 bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white h-[52px] rounded-[10px] font-bold text-[16px] hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Creating…' : <><Key size={18} /> Generate Session</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Exam Code Card ────────────────────────────────────────────────────────────
const ExamCodeCard: React.FC<{ exam: ExamConfig; onDelete: () => void }> = ({ exam, onDelete }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(exam.examCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div whileHover={{ y: -3 }} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 shadow-sm group overflow-hidden">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-bold text-[16px] text-white leading-tight">{exam.subject}</p>
          <p className="text-[12px] text-[rgba(255,255,255,0.5)] mt-1">{exam.classroomName}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${exam.difficulty === 'Simple' ? 'bg-[rgba(16,185,129,0.2)] text-[#6ee7b7]' : exam.difficulty === 'Intermediate' ? 'bg-[rgba(245,158,11,0.2)] text-[#fcd34d]' : 'bg-[rgba(239,68,68,0.2)] text-[#fca5a5]'}`}>
          {exam.difficulty}
        </span>
      </div>

      {/* The code display using Schedule Viva Page specs */}
      <div
        onClick={copy}
        className="bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.4)] rounded-[10px] p-4 text-center cursor-pointer hover:bg-[rgba(124,58,237,0.3)] transition-all group/code mb-5"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)] group-hover/code:text-white mb-2">Access Code</p>
        <p className="text-[36px] font-mono font-bold tracking-[10px] text-white">{exam.examCode}</p>
        <p className="text-[11px] font-bold uppercase tracking-widest mt-2 text-[#a78bfa] group-hover/code:text-white flex items-center justify-center gap-1.5">
          {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Click to copy</>}
        </p>
      </div>

      <div className="flex justify-between items-center text-[12px] font-semibold text-[rgba(255,255,255,0.4)] mb-4 bg-[rgba(255,255,255,0.03)] px-3 py-2 rounded-lg">
        <span>{exam.questionCount} Qs</span>
        <span>•</span>
        <span>{exam.timeLimit} min</span>
        <span>•</span>
        <span>{new Date(exam.createdAt).toLocaleDateString()}</span>
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[#fca5a5] text-[13px] font-bold opacity-0 group-hover:opacity-100 hover:bg-[rgba(239,68,68,0.1)] transition-all"
      >
        <Trash2 size={15} /> Delete Exam
      </button>
    </motion.div>
  );
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────
const AnalyticsPanel: React.FC<{ teacherId: string; exams: ExamConfig[]; classrooms: Classroom[] }> = ({ teacherId, exams, classrooms }) => {
  const [responses, setResponses] = useState<VivaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | 'all'>('all');

  useEffect(() => {
    getTeacherResponses(teacherId).then(r => { setResponses(r); setLoading(false); });
  }, [teacherId]);

  if (loading) return <div className="text-center py-20 text-[rgba(255,255,255,0.3)]"><Loader2 size={32} className="mx-auto mb-2 animate-spin" /></div>;

  if (responses.length === 0) {
    return (
      <div className="text-center py-20 text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px]">
        <BarChart2 size={40} className="mx-auto mb-3 opacity-50" />
        <p className="font-bold uppercase tracking-widest text-[11px] text-[rgba(255,255,255,0.5)]">No submissions yet</p>
      </div>
    );
  }

  // Calculate score distribution
  const distribution = [
    { name: 'Excellent (8-10)', value: responses.filter(r => r.grade >= 8).length, color: '#10b981' }, 
    { name: 'Good (5-7)', value: responses.filter(r => r.grade >= 5 && r.grade < 8).length, color: '#f59e0b' }, 
    { name: 'Needs Work (<5)', value: responses.filter(r => r.grade < 5).length, color: '#ef4444' } 
  ].filter(d => d.value > 0);

  // Calculate subject-wise submissions for PieChart
  const subjectMap: Record<string, number> = {};
  responses.forEach(r => {
    const exam = exams.find(e => e.id === r.examId);
    if (exam) {
      subjectMap[exam.subject] = (subjectMap[exam.subject] || 0) + 1;
    }
  });

  const subjectData = Object.entries(subjectMap).map(([name, value]) => ({ name, value }));
  const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const filteredResponses = selectedClassId === 'all' 
    ? responses 
    : responses.filter(r => exams.find(e => e.id === r.examId)?.classroomId === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Graph Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-6">
          <h3 className="text-[15px] font-bold mb-6 text-white uppercase tracking-widest text-center">Score Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: 'rgba(15,12,41,0.95)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-6 flex flex-col items-center">
          <h3 className="text-[15px] font-bold mb-2 text-white uppercase tracking-widest text-center">Submissions per Subject</h3>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subjectData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {subjectData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15,12,41,0.95)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: '12px', fontWeight: 'bold' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', fill: 'rgba(255,255,255,0.5)' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text for donut hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-4">
               <span className="text-[24px] font-black text-white leading-none">{responses.length}</span>
               <span className="text-[9px] font-bold text-[rgba(255,255,255,0.4)] uppercase mt-1 tracking-widest">Total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-bold text-white">Individual Submissions</h3>
          
          {/* Class Filter Dropdown */}
          <div className="relative w-full sm:w-auto">
            <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] pointer-events-none" />
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full sm:w-[220px] bg-[rgba(15,12,41,0.9)] border border-[rgba(255,255,255,0.1)] rounded-[10px] pl-9 pr-10 py-2.5 text-[13px] font-bold text-white outline-none focus:ring-2 focus:ring-[#7c3aed] appearance-none cursor-pointer"
            >
              <option value="all">All Classes</option>
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] pointer-events-none" />
          </div>
        </div>
        
        {filteredResponses.length === 0 ? (
           <div className="text-center py-16 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[14px]">
             <AlertCircle size={32} className="mx-auto mb-3 opacity-30 text-[#a78bfa]" />
             <p className="font-bold uppercase tracking-widest text-[11px] text-[rgba(255,255,255,0.5)]">No submissions found for this class</p>
           </div>
        ) : (
          filteredResponses.map(r => {
            const exam = exams.find(e => e.id === r.examId);
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 overflow-hidden transition-all group">
                <div 
                  className="flex justify-between items-start cursor-pointer hover:bg-[rgba(255,255,255,0.02)] -m-5 p-5 transition-colors" 
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <p className="font-bold text-[16px] text-white">{r.studentName}</p>
                       <span className="text-[9px] bg-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded flex items-center gap-1 font-bold text-[rgba(255,255,255,0.6)] uppercase tracking-wider">
                         <Mail size={10} /> {r.studentEmail}
                       </span>
                    </div>
                    <p className="text-[11px] text-[rgba(255,255,255,0.5)] font-bold mb-2">
                       Class: <span className="text-white">{exam?.classroomName || 'Unknown'}</span>
                    </p>
                    <p className="text-[10px] text-[#a78bfa] font-bold uppercase tracking-widest">
                       {exam?.subject || r.examId} • {new Date(r.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className={`text-[22px] flex items-center gap-3 font-black ${r.grade >= 7 ? 'text-[#6ee7b7]' : r.grade >= 5 ? 'text-[#fcd34d]' : 'text-[#fca5a5]'}`}>
                      <span>{r.grade}<span className="text-[12px] font-bold text-[rgba(255,255,255,0.3)] ml-1">/10</span></span>
                      <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[rgba(255,255,255,0.5)] group-hover:text-white group-hover:bg-[rgba(255,255,255,0.2)] transition-all">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                    {r.cheatingStrikes && r.cheatingStrikes > 0 ? (
                      <span className="text-[10px] bg-[rgba(239,68,68,0.2)] text-[#fca5a5] px-2 py-0.5 rounded-[6px] font-bold uppercase tracking-widest border border-[rgba(239,68,68,0.4)]">
                        ⚠ {r.cheatingStrikes} strike{r.cheatingStrikes > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                </div>

                {r.feedback && (
                  <div className="text-[13px] text-[rgba(255,255,255,0.8)] mt-6 border-t border-[rgba(255,255,255,0.08)] pt-4 leading-relaxed italic border-l-2 pl-3 border-l-[#a78bfa]">
                    "{r.feedback}"
                  </div>
                )}

                {/* Transcript */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)] space-y-4"
                    >
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a78bfa] mb-4 bg-[rgba(124,58,237,0.1)] px-3 py-1.5 rounded-[8px] inline-block border border-[rgba(124,58,237,0.2)]">Viva Transcript</h4>
                      {r.answers.map((ans, idx) => (
                        <div key={idx} className="space-y-4 bg-[rgba(15,12,41,0.4)] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-[rgba(124,58,237,0.2)] flex items-center justify-center shrink-0 border border-[rgba(124,58,237,0.4)]">
                              <span className="text-[#a78bfa] font-black text-[10px] uppercase">AI</span>
                            </div>
                            <div className="text-[14px] font-medium pt-1 prose prose-sm prose-invert max-w-none text-white"><Markdown>{ans.question}</Markdown></div>
                          </div>
                          <div className="flex gap-4 ml-6">
                            <div className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 border border-[rgba(255,255,255,0.2)]">
                              <User size={14} className="text-[rgba(255,255,255,0.8)]" />
                            </div>
                            <div className="text-[13px] text-[rgba(255,255,255,0.6)] pt-1 prose prose-sm prose-invert max-w-none"><Markdown>{ans.answer}</Markdown></div>
                          </div>
                          <div className={`ml-[calc(1.5rem+32px)] text-[13px] p-4 rounded-[12px] border ${ans.isCorrect ? 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.3)] text-[#6ee7b7]' : 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[#fca5a5]'}`}>
                            <strong className="block mb-1 text-[10px] uppercase tracking-widest opacity-80">AI Feedback</strong> 
                            <span className="leading-relaxed opacity-90">{ans.feedback}</span>
                            <span className={`block mt-3 font-bold px-3 py-1 w-fit rounded-[8px] text-[11px] uppercase tracking-widest ${ans.score >= 7 ? 'bg-[rgba(16,185,129,0.2)]' : 'bg-[rgba(239,68,68,0.2)]'}`}>Score: {ans.score}/10</span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Main Teacher Dashboard ───────────────────────────────────────────────────
export const TeacherDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [showNewClassroom, setShowNewClassroom] = useState(false);
  const [showNewExam, setShowNewExam] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomSubject, setNewClassroomSubject] = useState('');
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomError, setClassroomError] = useState('');
  const [recentResponses, setRecentResponses] = useState<VivaResponse[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadData = useCallback(async () => {
    const [cls, ex, res] = await Promise.all([
      getTeacherClassrooms(user.id),
      getExams(user.id),
      getTeacherResponses(user.id),
    ]);
    setClassrooms(cls);
    setExams(ex);
    setRecentResponses(res.slice(0, 5));
  }, [user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim() || !newClassroomSubject.trim()) {
      setClassroomError('Both name and subject are required.');
      return;
    }
    setClassroomLoading(true);
    setClassroomError('');
    try {
      await createClassroom(newClassroomName.trim(), newClassroomSubject.trim(), user.id, user.name);
      setNewClassroomName('');
      setNewClassroomSubject('');
      setShowNewClassroom(false);
      await loadData();
    } catch (e: any) {
      setClassroomError(e.message);
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleDeleteClassroom = async (id: string, name: string) => {
    if (!confirm(`Delete classroom "${name}"? This will remove all students and messages.`)) return;
    await deleteClassroom(id);
    if (selectedClassroom?.id === id) setSelectedClassroom(null);
    await loadData();
  };

  const handleDeleteExam = async (id: string, subject: string) => {
    if (!confirm(`Delete exam "${subject}"?`)) return;
    await deleteExam(id);
    await loadData();
  };

  const navItems: { id: SidebarTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'overview', icon: <Home size={18} />, label: 'Overview' },
    { id: 'classrooms', icon: <Layers size={18} />, label: 'Classrooms', badge: classrooms.length },
    { id: 'exams', icon: <FileText size={18} />, label: 'Exams', badge: exams.length },
    { id: 'analytics', icon: <BarChart2 size={18} />, label: 'Analytics' },
  ];

  return (
    <div className="flex gap-6 min-h-[80vh]">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-[240px]'} shrink-0 transition-all duration-300`}>
        <div className="bg-[rgba(255,255,255,0.06)] border-r border-t border-b border-[rgba(255,255,255,0.08)] rounded-[14px] p-3 space-y-1 sticky top-24 min-h-[500px]">
          {/* Teacher info */}
          {!sidebarCollapsed && (
            <div className="px-3 py-4 mb-3 border-b border-[rgba(255,255,255,0.08)]">
              <div className="w-[52px] h-[52px] bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-[14px] flex items-center justify-center text-white font-bold text-[22px] mb-3 shadow-lg shadow-indigo-500/20">
                {user.name[0].toUpperCase()}
              </div>
              <p className="font-bold text-[15px] text-white leading-tight truncate">{user.name}</p>
              <p className="text-[11px] font-semibold text-[rgba(255,255,255,0.5)] truncate mt-0.5">{user.email}</p>
            </div>
          )}

          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedClassroom(null); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-[13px] font-semibold transition-all ${activeTab === item.id ? 'bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white shadow-md shadow-indigo-500/10' : 'bg-transparent text-[rgba(255,255,255,0.55)] hover:bg-white/5 hover:text-white'}`}
            >
              <div className="relative flex items-center justify-center">
                {activeTab === item.id && <div className="absolute -left-[14px] w-1.5 h-1.5 bg-white rounded-full bg-opacity-90 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
                {item.icon}
              </div>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[10px] ${activeTab === item.id ? 'bg-[rgba(255,255,255,0.2)] text-white' : 'bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.6)]'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center py-2 mt-4 text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronRight size={14} className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Welcome back, {user.name.split(' ')[0]} 👋</h2>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Classrooms', value: classrooms.length, icon: <Layers size={20} />, accentColor: 'border-l-[theme(colors.purple.500)]', gradient: 'from-[#7c3aed] to-[#4f46e5]' },
                  { label: 'Active Exams', value: exams.length, icon: <FileText size={20} />, accentColor: 'border-l-[#0d9488]', gradient: 'from-[#0d9488] to-[#14b8a6]' },
                  { label: 'Submissions', value: recentResponses.length, icon: <GraduationCap size={20} />, accentColor: 'border-l-[#10b981]', gradient: 'from-[#059669] to-[#10b981]' },
                ].map(s => (
                  <div key={s.label} className={`bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[12px] p-5 border-l-[3px] ${s.accentColor} backdrop-blur-sm`}>
                    <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center mb-4 bg-gradient-to-br ${s.gradient} text-white shadow-lg`}>
                      {s.icon}
                    </div>
                    <div className="text-[28px] font-black text-white leading-none">{s.value}</div>
                    <div className="text-[11px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest mt-2 font-bold">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent submissions */}
              <div>
                <h3 className="font-bold text-lg mb-3 text-white">Recent Activity</h3>
                {recentResponses.length === 0 ? (
                  <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-10 text-center text-[rgba(255,255,255,0.3)]">
                    <Clock size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold uppercase tracking-widest text-[rgba(255,255,255,0.5)]">No submissions yet</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)]">
                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-[rgba(255,255,255,0.06)] border-b border-[rgba(255,255,255,0.06)]">
                      <div className="col-span-5 text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)]">Student</div>
                      <div className="col-span-5 text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)]">Exam Details</div>
                      <div className="col-span-2 text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)] text-right">Grade</div>
                    </div>
                    {recentResponses.map((r, i) => (
                      <div key={r.id} className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-[rgba(255,255,255,0.04)] transition-colors ${i !== recentResponses.length - 1 ? 'border-b border-[rgba(255,255,255,0.06)]' : ''}`}>
                        <div className="col-span-5">
                          <p className="font-semibold text-[14px] text-white">{r.studentName}</p>
                          <p className="text-[12px] text-[rgba(255,255,255,0.5)] hidden sm:block">{r.studentEmail}</p>
                        </div>
                        <div className="col-span-5">
                          <p className="text-[13px] text-[rgba(255,255,255,0.8)] truncate max-w-[200px]">{exams.find(e => e.id === r.examId)?.subject || 'Unknown exam'}</p>
                          <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase mt-0.5">{new Date(r.timestamp).toLocaleDateString()}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-[6px] text-[13px] font-black ${r.grade >= 7 ? 'bg-[rgba(16,185,129,0.2)] text-[#6ee7b7]' : r.grade >= 5 ? 'bg-[rgba(245,158,11,0.2)] text-[#fcd34d]' : 'bg-[rgba(239,68,68,0.2)] text-[#fca5a5]'}`}>
                            {r.grade}/10
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* CLASSROOMS */}
          {activeTab === 'classrooms' && !selectedClassroom && (
            <motion.div key="classrooms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Classrooms</h2>
                <button
                  onClick={() => setShowNewClassroom(true)}
                  className="bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white px-5 py-2.5 rounded-[10px] flex items-center gap-2 hover:opacity-90 transition-all text-[13px] font-bold shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={16} /> New Classroom
                </button>
              </div>

              {/* Create classroom form */}
              <AnimatePresence>
                {showNewClassroom && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 space-y-4 overflow-hidden"
                  >
                    <h3 className="font-bold text-white">New Classroom</h3>
                    {classroomError && (
                      <div className="text-[#fca5a5] text-[13px] bg-[rgba(239,68,68,0.15)] rounded-[10px] px-4 py-3 border border-[rgba(239,68,68,0.3)] flex items-center gap-2">
                        <AlertCircle size={15} /> {classroomError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] block mb-2">Class Name</label>
                        <input
                          placeholder="e.g. CS-2024-B"
                          value={newClassroomName}
                          onChange={e => setNewClassroomName(e.target.value)}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] rounded-[10px] px-4 py-3 text-[13px] text-white outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder-[rgba(255,255,255,0.3)]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#a78bfa] block mb-2">Subject</label>
                        <input
                          placeholder="e.g. Computer Networks"
                          value={newClassroomSubject}
                          onChange={e => setNewClassroomSubject(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateClassroom()}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] rounded-[10px] px-4 py-3 text-[13px] text-white outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder-[rgba(255,255,255,0.3)]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setShowNewClassroom(false); setClassroomError(''); }} className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold text-[rgba(255,255,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-all">Cancel</button>
                      <button
                        onClick={handleCreateClassroom}
                        disabled={classroomLoading}
                        className="bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white px-6 py-2.5 rounded-[10px] text-[13px] font-bold hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {classroomLoading ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {classrooms.length === 0 ? (
                <div className="text-center py-20 text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px]">
                  <Layers size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="font-bold uppercase tracking-widest text-[13px] text-[rgba(255,255,255,0.5)]">No classrooms yet</p>
                  <p className="text-[11px] mt-2 text-[rgba(255,255,255,0.4)]">Create your first classroom to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classrooms.map(c => {
                    const examCount = exams.filter(e => e.classroomId === c.id).length;
                    return (
                      <motion.div key={c.id} whileHover={{ y: -3 }}
                        className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 cursor-pointer hover:bg-[rgba(255,255,255,0.08)] hover:border-[#a78bfa] transition-all group"
                        onClick={() => setSelectedClassroom(c)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-[44px] h-[44px] bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] rounded-[12px] flex items-center justify-center">
                            <BookOpen size={20} className="text-[#a78bfa]" />
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteClassroom(c.id, c.name); }}
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-[#fca5a5] hover:bg-[rgba(239,68,68,0.15)] transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <h3 className="font-bold text-[16px] text-white">{c.name}</h3>
                        <p className="text-[12px] text-[rgba(255,255,255,0.5)] mb-5">{c.subject}</p>
                        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)]">
                          <span className="flex items-center gap-1 text-[#a78bfa]"><FileText size={12} /> {examCount} exam{examCount !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)] flex items-center gap-1 text-[#a78bfa] text-[12px] font-bold group-hover:gap-2 transition-all">
                          Manage Classroom <ChevronRight size={14} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* CLASSROOM DETAIL */}
          {activeTab === 'classrooms' && selectedClassroom && (
            <motion.div key={`classroom-${selectedClassroom.id}`}>
              <ClassroomDetail
                classroom={selectedClassroom}
                teacherName={user.name}
                exams={exams}
                onBack={() => setSelectedClassroom(null)}
              />
            </motion.div>
          )}

          {/* EXAMS */}
          {activeTab === 'exams' && (
            <motion.div key="exams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Exams</h2>
                <button
                  onClick={() => setShowNewExam(true)}
                  className="bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white px-5 py-2.5 rounded-[10px] flex items-center gap-2 hover:opacity-90 transition-all text-[13px] font-bold shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={16} /> New Exam
                </button>
              </div>

              {exams.length === 0 ? (
                <div className="text-center py-20 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] text-[rgba(255,255,255,0.3)]">
                  <Key size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="font-bold uppercase tracking-widest text-[13px] text-[rgba(255,255,255,0.5)]">No exams yet</p>
                  <p className="text-[11px] mt-2 text-[rgba(255,255,255,0.4)]">Create an exam and share the code with your class</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {exams.map(exam => (
                    <ExamCodeCard
                      key={exam.id}
                      exam={exam}
                      onDelete={() => handleDeleteExam(exam.id, exam.subject)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ANALYTICS */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Results & Analytics</h2>
              <AnalyticsPanel teacherId={user.id} exams={exams} classrooms={classrooms} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Exam Modal */}
      <AnimatePresence>
        {showNewExam && (
          <CreateExamModal
            classrooms={classrooms}
            teacherId={user.id}
            onCreated={async (exam) => {
              setShowNewExam(false);
              await loadData();
              // auto-navigate to exams tab to show code
              setActiveTab('exams');
            }}
            onClose={() => setShowNewExam(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
