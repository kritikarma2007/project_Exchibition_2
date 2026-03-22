import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, AlertTriangle, CheckCircle, ChevronRight, FileText, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getExams, getResponses } from '../services/storage';
import { ExamConfig, VivaResponse } from '../types';
import Markdown from 'react-markdown';

export const Analytics: React.FC = () => {
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [responses, setResponses] = useState<VivaResponse[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedResponse, setSelectedResponse] = useState<VivaResponse | null>(null);

  useEffect(() => {
    const allExams = getExams();
    setExams(allExams);
    const allResponses = getResponses();
    setResponses(allResponses);
    if (allExams.length > 0) {
      setSelectedExamId(allExams[0].id);
    }
  }, []);

  const filteredResponses = selectedExamId 
    ? responses.filter(r => r.examId === selectedExamId)
    : responses;

  const averageGrade = filteredResponses.length > 0
    ? (filteredResponses.reduce((acc, r) => acc + r.grade, 0) / filteredResponses.length).toFixed(1)
    : 0;

  const strugglingCount = filteredResponses.filter(r => r.grade < 5).length;
  const topPerformers = filteredResponses.filter(r => r.grade >= 8).length;

  const chartData = filteredResponses.map(r => ({
    name: r.studentName,
    grade: r.grade,
    logic: r.logicScore
  }));

  const gradeDistribution = [
    { name: 'Struggling (0-4)', value: strugglingCount, color: '#EF4444' },
    { name: 'Average (5-7)', value: filteredResponses.length - strugglingCount - topPerformers, color: '#F59E0B' },
    { name: 'Top (8-10)', value: topPerformers, color: '#10B981' }
  ].filter(d => d.value > 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-[#141414]/60 mt-2">Class performance heatmap and student logic analysis.</p>
        </div>
        <select 
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="bg-white border border-[#141414]/10 rounded-2xl px-4 py-3 font-semibold focus:ring-2 focus:ring-[#141414] transition-all"
        >
          <option value="">All Exams</option>
          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.subject} ({ex.difficulty})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <TrendingUp size={20} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#141414]/40">Average Grade</p>
          <h4 className="text-3xl font-bold mt-1">{averageGrade}/10</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Users size={20} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#141414]/40">Total Students</p>
          <h4 className="text-3xl font-bold mt-1">{filteredResponses.length}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#141414]/40">Struggling</p>
          <h4 className="text-3xl font-bold mt-1">{strugglingCount}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <CheckCircle size={20} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#141414]/40">Top Performers</p>
          <h4 className="text-3xl font-bold mt-1">{topPerformers}</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-[#141414]/10 shadow-sm">
          <h3 className="text-xl font-bold mb-8">Student Performance (Heatmap)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 10]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="grade" radius={[8, 8, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.grade >= 8 ? '#10B981' : entry.grade >= 5 ? '#F59E0B' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-[#141414]/10 shadow-sm">
          <h3 className="text-xl font-bold mb-8">Grade Distribution</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-4 ml-8">
              {gradeDistribution.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm font-semibold">{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#141414]/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#141414]/10 flex justify-between items-center">
          <h3 className="text-xl font-bold">Recent Submissions</h3>
        </div>
        <div className="divide-y divide-[#141414]/5">
          {filteredResponses.map((res) => (
            <div key={res.id} className="p-6 flex items-center justify-between hover:bg-[#F5F5F0]/50 transition-all cursor-pointer" onClick={() => setSelectedResponse(res)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#141414]">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold">{res.studentName}</h4>
                  <p className="text-xs text-[#141414]/60 uppercase tracking-widest font-bold">{res.language} • {new Date(res.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/40">Logic Score</p>
                  <p className="text-lg font-bold text-emerald-600">{res.logicScore}/10</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/40">Final Grade</p>
                  <p className="text-lg font-bold">{res.grade}/10</p>
                </div>
                <button className="w-10 h-10 bg-[#141414]/5 hover:bg-[#141414] hover:text-white rounded-xl flex items-center justify-center transition-all">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredResponses.length === 0 && (
            <div className="p-12 text-center text-[#141414]/40 italic">
              No submissions yet for this exam.
            </div>
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      <AnimatePresence>
        {selectedResponse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResponse(null)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#141414]/10 flex justify-between items-center bg-[#F5F5F0]/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#141414] rounded-2xl flex items-center justify-center text-white">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedResponse.studentName}</h3>
                    <p className="text-sm text-[#141414]/60 font-bold uppercase tracking-widest">
                      ID: {selectedResponse.studentId} • {selectedResponse.studentEmail}
                    </p>
                    <p className="text-xs text-[#141414]/40 font-bold uppercase tracking-widest mt-1">
                      {selectedResponse.language} • {new Date(selectedResponse.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedResponse(null)}
                  className="w-10 h-10 bg-[#141414]/5 hover:bg-[#141414] hover:text-white rounded-xl flex items-center justify-center transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-500/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-700/60">Final Grade</p>
                    <h4 className="text-3xl font-bold text-emerald-700">{selectedResponse.grade}/10</h4>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-500/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-700/60">Logic Score</p>
                    <h4 className="text-3xl font-bold text-blue-700">{selectedResponse.logicScore}/10</h4>
                  </div>
                  <div className="bg-amber-50 p-6 rounded-2xl border border-amber-500/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-700/60">Time Taken</p>
                    <div className="flex items-center gap-2 text-amber-700">
                      <Clock size={20} />
                      <h4 className="text-3xl font-bold">{formatTime(selectedResponse.timeTaken)}</h4>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-600" />
                    Overall Feedback
                  </h4>
                  <div className="bg-[#F5F5F0] p-6 rounded-2xl prose prose-sm max-w-none">
                    <Markdown>{selectedResponse.feedback}</Markdown>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-lg font-bold">Question-by-Question Analysis</h4>
                  <div className="space-y-6">
                    {selectedResponse.answers.map((ans, i) => (
                      <div key={i} className="border border-[#141414]/10 rounded-2xl overflow-hidden">
                        <div className="bg-[#F5F5F0] p-4 font-bold border-b border-[#141414]/10 flex justify-between items-center">
                          <span>Question {i + 1}</span>
                          {ans.isCorrect ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs uppercase tracking-widest">
                              <CheckCircle2 size={14} /> Correct
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 text-xs uppercase tracking-widest">
                              <XCircle size={14} /> Incorrect
                            </span>
                          )}
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/40 mb-1">Question</p>
                            <p className="font-medium">{ans.question}</p>
                          </div>
                          <div className="bg-[#141414] text-white p-4 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Student Answer</p>
                            <p>{ans.answer}</p>
                          </div>
                          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-500/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60 mb-1">AI Feedback</p>
                            <p className="text-sm text-emerald-800 italic">{ans.feedback}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

