import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Settings, FileText, ChevronRight, BarChart, User, Clock, Award, UserCog } from 'lucide-react';
import { ExamConfig, Difficulty, VivaResponse } from '../types';
import { saveExam, getExams, getResponses } from '../services/storage';

interface TeacherDashboardProps {
  user: {
    name: string;
    email: string;
    id: string;
  };
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user }) => {
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [responses, setResponses] = useState<VivaResponse[]>([]);
  const [showNewExam, setShowNewExam] = useState(false);
  const [newExam, setNewExam] = useState<Partial<ExamConfig>>({
    subject: 'Data Structures and Algorithms',
    questionCount: 5,
    difficulty: 'Simple',
    syllabusText: '',
    timeLimit: 10,
    customQuestions: []
  });
  const [customQuestionsText, setCustomQuestionsText] = useState('');

  useEffect(() => {
    setExams(getExams());
    setResponses(getResponses().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5));
  }, []);

  const handleCreateExam = () => {
    if (!newExam.subject) return;
    const questions = customQuestionsText
      ? customQuestionsText.split('\n').filter(q => q.trim() !== '')
      : [];
    
    const exam: ExamConfig = {
      id: Math.random().toString(36).substr(2, 9),
      subject: newExam.subject,
      questionCount: questions.length > 0 ? questions.length : (newExam.questionCount || 5),
      difficulty: newExam.difficulty as Difficulty || 'Simple',
      syllabusText: newExam.syllabusText,
      timeLimit: newExam.timeLimit || 10,
      customQuestions: questions,
      createdAt: Date.now()
    };
    saveExam(exam);
    setExams([...exams, exam]);
    setShowNewExam(false);
    setCustomQuestionsText('');
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-[#141414] rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0">
            <UserCog size={24} className="md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome, {user.name}</h2>
            <p className="text-[#141414]/60 mt-1 text-sm md:text-base truncate max-w-[200px] md:max-w-none">{user.email} • ID: {user.id}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowNewExam(true)}
          className="w-full md:w-auto bg-[#141414] text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-all shadow-lg"
        >
          <Plus size={20} />
          <span className="font-semibold">New Exam</span>
        </button>
      </div>

      {showNewExam && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 md:p-8 rounded-3xl border border-[#141414]/10 shadow-xl space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Subject</label>
              <input 
                type="text"
                value={newExam.subject}
                onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all"
                placeholder="e.g. Computer Networks"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Difficulty</label>
              <div className="flex gap-2">
                {['Simple', 'Intermediate', 'Hard'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setNewExam({ ...newExam, difficulty: d as Difficulty })}
                    className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${newExam.difficulty === d ? 'bg-[#141414] text-white' : 'bg-[#F5F5F0] hover:bg-[#141414]/5'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Question Count</label>
              <input 
                type="number"
                value={newExam.questionCount}
                onChange={(e) => setNewExam({ ...newExam, questionCount: parseInt(e.target.value) })}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Time Limit (Mins)</label>
              <input 
                type="number"
                value={newExam.timeLimit}
                onChange={(e) => setNewExam({ ...newExam, timeLimit: parseInt(e.target.value) })}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#141414]/60">Custom Questions (One per line - Optional)</label>
            <textarea 
              placeholder="1. What is a Router?&#10;2. Explain OSI Model.&#10;3. What is TCP/IP?"
              value={customQuestionsText}
              onChange={(e) => setCustomQuestionsText(e.target.value)}
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 h-32 focus:ring-2 focus:ring-[#141414] transition-all font-mono text-sm"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#141414]/60">Syllabus Context (RAG)</label>
            <textarea 
              placeholder="Paste specific NCERT chapters or syllabus text here..."
              value={newExam.syllabusText}
              onChange={(e) => setNewExam({ ...newExam, syllabusText: e.target.value })}
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 h-32 focus:ring-2 focus:ring-[#141414] transition-all"
            />
          </div>

          <div className="flex justify-end gap-4">
            <button 
              onClick={() => setShowNewExam(false)}
              className="px-6 py-3 rounded-2xl font-semibold hover:bg-[#141414]/5 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateExam}
              className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-emerald-700 transition-all shadow-lg"
            >
              Create Exam
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileText size={20} />
            Active Exams
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exams.map((exam) => (
              <motion.div 
                key={exam.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#141414] group-hover:bg-[#141414] group-hover:text-white transition-all">
                    <FileText size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    exam.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 
                    exam.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {exam.difficulty}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{exam.subject}</h3>
                <div className="flex items-center gap-4 text-sm text-[#141414]/60 mb-6">
                  <span>{exam.questionCount} Questions</span>
                  <span>•</span>
                  <span>{new Date(exam.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('switchTab', { detail: 'analytics' }));
                    }}
                    className="flex-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <BarChart size={18} />
                    Results
                  </button>
                  <button className="w-12 h-12 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl flex items-center justify-center transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BarChart size={20} />
            Recent Activity
          </h3>
          <div className="bg-white rounded-3xl border border-[#141414]/10 shadow-sm overflow-hidden">
            {responses.length > 0 ? (
              <div className="divide-y divide-[#141414]/5">
                {responses.map((res) => (
                  <div key={res.id} className="p-4 hover:bg-[#F5F5F0]/50 transition-all cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'analytics' }))}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center text-white">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{res.studentName}</p>
                        <p className="text-[10px] text-[#141414]/40 uppercase font-bold tracking-widest">
                          ID: {res.studentId} • {new Date(res.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#141414]/60 font-medium truncate max-w-[120px]">
                        {exams.find(e => e.id === res.examId)?.subject || 'Unknown Exam'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600">{res.grade}/10</span>
                        <ChevronRight size={14} className="text-[#141414]/20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Clock size={32} className="mx-auto text-[#141414]/10 mb-2" />
                <p className="text-sm text-[#141414]/40 font-bold uppercase tracking-widest">No activity yet</p>
              </div>
            )}
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'analytics' }))}
              className="w-full p-4 text-xs font-bold uppercase tracking-widest text-[#141414]/60 hover:text-[#141414] transition-all border-t border-[#141414]/5"
            >
              View All Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
