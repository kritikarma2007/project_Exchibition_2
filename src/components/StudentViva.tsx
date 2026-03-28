import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, MicOff, Send, CheckCircle, Loader2, User,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  BookOpen, GraduationCap, MessageSquare, Key,
  ChevronRight, Maximize, Shield, ShieldAlert, X,
  Home, ChevronDown, ChevronUp, BarChart2
} from 'lucide-react';
import { ExamConfig, VivaResponse, StudentAnswer, Classroom, ClassMessage } from '../types';
import { verifyExamCode, saveResponse, generateId, getCompletedExamsForStudent, getAllExams } from '../services/storage';
import { getStudentClassrooms, getMessages } from '../services/classroom';
import { generateInitialQuestion, processAnswerAndGetNext, finalizeViva, SUPPORTED_LANGUAGES } from '../services/gemini';
import Markdown from 'react-markdown';

// ── Web Speech API types ───────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}
declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

interface Props {
  user: { name: string; email: string; id: string };
}

type SidebarTab = 'dashboard' | 'history' | 'profile' | 'classes' | 'exam';

const MAX_STRIKES = 3;

// ─── Anti-Cheat Warning Modal ─────────────────────────────────────────────────
const AntiCheatWarning: React.FC<{
  strikes: number;
  reason: string;
  onDismiss: () => void;
  onSubmit: () => void;
}> = ({ strikes, reason, onDismiss, onSubmit }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[14px] shadow-2xl max-w-md w-full p-8 text-center backdrop-blur-xl"
    >
      <div className="w-16 h-16 bg-red-500/20 rounded-[14px] flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={32} className="text-red-400" />
      </div>
      <h3 className="text-xl font-black text-red-400 mb-2">⚠ Suspicious Activity Detected</h3>
      <p className="text-[rgba(255,255,255,0.5)] text-sm mb-4">{reason}</p>
      <div className="flex justify-center gap-1.5 mb-6">
        {Array.from({ length: MAX_STRIKES }).map((_, i) => (
          <div key={i} className={`w-10 h-2 rounded-full ${i < strikes ? 'bg-red-500' : 'bg-white/10'}`} />
        ))}
      </div>
      <p className="text-sm font-semibold text-white mb-6">
        Strike {strikes}/{MAX_STRIKES}
        <span className="text-[rgba(255,255,255,0.5)] font-normal">{strikes >= MAX_STRIKES ? ' — Exam auto-submits!' : ' — Return to exam now.'}</span>
      </p>
      {strikes >= MAX_STRIKES ? (
        <button onClick={onSubmit} className="w-full bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white py-3 rounded-lg font-bold">
          Submit Exam Now
        </button>
      ) : (
        <button onClick={onDismiss} className="w-full bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white py-3 rounded-lg font-bold">
          Return to Exam
        </button>
      )}
    </motion.div>
  </div>
);

// ─── Exam Session Component ───────────────────────────────────────────────────
const ExamSession: React.FC<{
  exam: ExamConfig;
  language: string;
  user: { name: string; email: string; id: string };
  onComplete: () => void;
}> = ({ exam, language, user, onComplete }) => {
  const [isStarted, setIsStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [evaluation, setEvaluation] = useState<{ grade: number; feedback: string; logicScore: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(exam.timeLimit * 60);
  const [startTime] = useState(Date.now());
  const [aiError, setAiError] = useState<string | null>(null);
  const [retryFn, setRetryFn] = useState<{ fn: () => void } | null>(null);

  // Anti-cheat
  const [strikes, setStrikes] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [cheatingStrikes, setCheatingStrikes] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<StudentAnswer[]>([]);
  const currentInputRef = useRef('');
  const strikesRef = useRef(0);
  const examActiveRef = useRef(false);
  const isRecordingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setAnswersSynced = useCallback((next: StudentAnswer[]) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);
  const setCurrentInputSynced = useCallback((v: string) => {
    currentInputRef.current = v;
    setCurrentInput(v);
    if (inputRef.current) {
      if (v === '') inputRef.current.style.height = 'auto';
    }
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Speech recognition init
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR() as SpeechRecognition;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = SUPPORTED_LANGUAGES[language] || 'en-US';
    let finalTranscript = '';
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      setCurrentInputSynced((finalTranscript + interim).trimStart());
    };
    rec.onerror = () => { setIsRecording(false); isRecordingRef.current = false; };
    rec.onend = () => { 
      if (isRecordingRef.current && document.visibilityState === 'visible') {
        try { rec.start(); } catch {}
      } else {
        setIsRecording(false); 
        isRecordingRef.current = false;
        finalTranscript = ''; 
      }
    };
    recognitionRef.current = rec;
  }, [language, setCurrentInputSynced]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [answers, currentQuestion, aiError]);

  // ── Anti-cheat: fullscreen + tab switch ─────────────────────────────────────
  const issueStrike = useCallback((reason: string) => {
    if (!examActiveRef.current) return;
    strikesRef.current += 1;
    setCheatingStrikes(strikesRef.current);
    setStrikes(strikesRef.current);
    setWarningReason(reason);
    setWarningVisible(true);
  }, []);

  useEffect(() => {
    if (!isStarted || isComplete) return;

    examActiveRef.current = true;

    // Fullscreen change
    const onFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs && examActiveRef.current) {
        issueStrike('You exited fullscreen mode. Please stay in the exam window.');
      }
    };

    // Tab visibility
    const onVisibility = () => {
      if (document.hidden && examActiveRef.current) {
        issueStrike('You switched away from the exam tab.');
      }
    };

    // Keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      if (!examActiveRef.current) return;
      if (e.key === 'F12') { e.preventDefault(); issueStrike('Developer tools shortcut detected.'); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) {
        e.preventDefault();
        issueStrike('Developer tools shortcut detected.');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); }
    };

    // Right click
    const onContextMenu = (e: MouseEvent) => { if (examActiveRef.current) e.preventDefault(); };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', onContextMenu);
      examActiveRef.current = false;
    };
  }, [isStarted, isComplete, issueStrike]);

  // ── Enter fullscreen and start exam ─────────────────────────────────────────
  const enterFullscreenAndStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      // If fullscreen is denied, still allow exam but warn
    }
    startExam();
  };

  const startExam = async () => {
    setIsStarted(true);
    setIsLoading(true);
    setAiError(null);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitViva(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const firstQuestion = await generateInitialQuestion(exam, language);
      setCurrentQuestion(firstQuestion || "Let's begin. Can you introduce the subject?");
      setCurrentQuestionIndex(0);
    } catch {
      setAiError('Could not start the viva. Check your Gemini API key and try again.');
      setIsStarted(false);
      clearInterval(timerRef.current!);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition requires Chrome browser.');
      return;
    }
    if (isRecording) {
      isRecordingRef.current = false;
      recognitionRef.current.stop();
    } else {
      isRecordingRef.current = true;
      setCurrentInputSynced('');
      try { recognitionRef.current.start(); } catch {}
      setIsRecording(true);
    }
  };

  const handleNextQuestion = async () => {
    const input = currentInput.trim();
    if (!input || !currentQuestion) return;
    setIsLoading(true);
    setAiError(null);
    if (isRecording) recognitionRef.current?.stop();

    const attempt = async () => {
      try {
        const result = await processAnswerAndGetNext(
          exam, currentQuestion, input, currentQuestionIndex, answersRef.current, language
        );
        const newAnswer: StudentAnswer = {
          question: currentQuestion,
          answer: input,
          isCorrect: result.evaluation.isCorrect,
          score: result.evaluation.score,
          feedback: result.evaluation.feedback,
        };
        const updated = [...answersRef.current, newAnswer];
        setAnswersSynced(updated);
        setCurrentInputSynced('');
        const nextIndex = currentQuestionIndex + 1;
        const total = exam.customQuestions?.length || exam.questionCount;
        if (result.nextQuestion === 'VIVA_COMPLETE' || nextIndex >= total) {
          setCurrentQuestion('All questions answered. Please submit your viva.');
          setCurrentQuestionIndex(nextIndex);
        } else {
          setCurrentQuestion(result.nextQuestion);
          setCurrentQuestionIndex(nextIndex);
        }
      } catch {
        setAiError('AI failed to respond. Please try again.');
        setRetryFn({ fn: attempt });
      } finally {
        setIsLoading(false);
      }
    };
    await attempt();
  };

  const submitViva = async (finalAnswers: StudentAnswer[] = answersRef.current) => {
    examActiveRef.current = false;
    setIsLoading(true);
    setAiError(null);
    setWarningVisible(false);
    if (timerRef.current) clearInterval(timerRef.current);
    // Exit fullscreen
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }

    try {
      const finalEval = await finalizeViva(exam, finalAnswers, language);
      setEvaluation(finalEval);
      setIsComplete(true);

      const response: Omit<VivaResponse, 'id'> = {
        examId: exam.id,
        examCode: exam.examCode,
        studentName: user.name,
        studentEmail: user.email,
        studentId: user.id,
        language,
        answers: finalAnswers,
        grade: finalEval.grade,
        feedback: finalEval.feedback,
        logicScore: finalEval.logicScore,
        timestamp: Date.now(),
        timeTaken: Math.round((Date.now() - startTime) / 1000),
        cheatingStrikes: strikesRef.current,
      };
      await saveResponse(response);
    } catch {
      setAiError('Could not finalize grading. Try submitting again.');
      setRetryFn({ fn: () => submitViva(finalAnswers) });
    } finally {
      setIsLoading(false);
    }
  };

  const scoreBadgeClass = (score: number) =>
    score >= 8 ? 'text-emerald-600 bg-emerald-50' :
    score >= 5 ? 'text-amber-600 bg-amber-50' :
    'text-red-500 bg-red-50';

  const totalQuestions = exam.customQuestions?.length || exam.questionCount || 0;
  const isAllAnswered = currentQuestionIndex >= totalQuestions;

  // ── Pre-exam screen ──────────────────────────────────────────────────────────
  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4">
        <div className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[14px] shadow-xl p-8 sm:p-10 space-y-8 relative overflow-hidden backdrop-blur-sm text-center">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[rgba(124,58,237,0.1)] blur-3xl rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-[14px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 rotate-3 hover:rotate-0 transition-all">
              <GraduationCap size={24} className="text-white" />
            </div>
            <h3 className="text-3xl font-black text-white tracking-tight">{exam.subject}</h3>
            <p className="font-medium text-[rgba(255,255,255,0.5)] mt-2">{exam.classroomName}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-8 border-y border-[rgba(255,255,255,0.08)] relative z-10">
            {[
              { label: 'Questions', value: totalQuestions },
              { label: 'Time Limit', value: `${exam.timeLimit}m` },
              { label: 'Difficulty', value: exam.difficulty },
            ].map(s => (
              <div key={s.label} className="text-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-[14px] py-4 transition-shadow">
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-[9px] text-[rgba(255,255,255,0.5)] font-bold uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-[14px] p-6 relative z-10 text-left">
            <p className="text-sm font-black text-red-400 flex items-center gap-2 mb-3 tracking-wide">
              <Shield size={18} className="text-red-400" /> STRICT EXAM SECURITY RULES
            </p>
            <ul className="text-sm font-medium text-white/80 space-y-2.5 list-none">
              <li className="flex gap-2 items-start"><span className="text-red-500 mt-0.5">•</span>The exam window will be forced into <strong>fullscreen mode</strong>.</li>
              <li className="flex gap-2 items-start"><span className="text-red-500 mt-0.5">•</span>Exiting fullscreen or switching to another tab will record a <strong>cheating strike</strong>.</li>
              <li className="flex gap-2 items-start text-white/80"><span className="text-red-500 mt-0.5">•</span><strong>3 strikes</strong> will automatically terminate and submit your exam.</li>
              <li className="flex gap-2 items-start"><span className="text-red-500 mt-0.5">•</span>Right-click and developer tools are completely disabled.</li>
            </ul>
          </div>

          {aiError && (
            <div className="relative z-10 flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-4 text-sm font-semibold text-left">
              <AlertCircle size={18} className="shrink-0" /> {aiError}
            </div>
          )}

          <div className="relative z-10 pt-4">
            <button
              onClick={enterFullscreenAndStart}
              disabled={isLoading}
              className="w-full bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white py-[16px] rounded-lg font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Maximize size={24} />}
              {isLoading ? 'Connecting to AI Engine...' : 'I Understand — Start Fullscreen Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Completion screen ────────────────────────────────────────────────────────
  if (isComplete && evaluation) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[14px] shadow-xl p-8 space-y-6 text-center"
      >
        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-[14px] flex items-center justify-center mx-auto">
          <span className="text-emerald-400 text-2xl font-black">{evaluation.grade}/10</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-white">Viva Completed!</h3>
          <p className="text-[rgba(255,255,255,0.5)] text-sm mt-1">Logic Score: {evaluation.logicScore}/10 • Language: {language}</p>
          {cheatingStrikes > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-bold border border-red-500/30">
              <ShieldAlert size={14} /> {cheatingStrikes} integrity strike{cheatingStrikes > 1 ? 's' : ''} recorded
            </div>
          )}
        </div>
        <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-4 text-left text-sm text-[rgba(255,255,255,0.8)] leading-relaxed">
          <Markdown>{evaluation.feedback}</Markdown>
        </div>
        <button onClick={onComplete} className="w-full bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white py-3 rounded-lg font-bold hover:opacity-90 transition-all">
          Back to Dashboard
        </button>
      </motion.div>
    );
  }

  // ── Live exam UI ─────────────────────────────────────────────────────────────
  return (
    <>
      {warningVisible && (
        <AntiCheatWarning
          strikes={strikes}
          reason={warningReason}
          onDismiss={async () => {
            setWarningVisible(false);
            if (strikes < MAX_STRIKES) {
              try { await document.documentElement.requestFullscreen(); } catch {}
            }
          }}
          onSubmit={() => submitViva()}
        />
      )}

      <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col z-40">
        {/* Header bar */}
        <div className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.08)] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-md flex items-center justify-center">
              <GraduationCap size={14} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{exam.subject}</p>
              <p className="text-white/40 text-xs">Q {Math.min(currentQuestionIndex + 1, totalQuestions)}/{totalQuestions} • {language}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Question counter dots row */}
            <div className="flex items-center gap-1.5 hidden md:flex mr-4">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all ${
                  i < currentQuestionIndex ? 'w-2 bg-[#7c3aed]' :
                  i === currentQuestionIndex ? 'w-5 bg-[linear-gradient(90deg,#7c3aed,#4f46e5)]' :
                  'w-2 bg-[rgba(255,255,255,0.15)]'
                }`} />
              ))}
            </div>
            
            {/* Strike indicators */}
            <div className="flex items-center gap-1.5 hidden sm:flex">
              {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < strikes ? 'bg-red-500' : 'bg-white/10'}`} />
              ))}
            </div>
            
            {/* Timer */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-sm bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#fca5a5]">
              <Clock size={14} />
              {formatTime(timeLeft)}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[#4ade80] text-xs font-bold uppercase tracking-widest">Live</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-[2px] bg-[rgba(255,255,255,0.08)]">
          <div 
            className="h-full bg-[linear-gradient(90deg,#7c3aed,#4f46e5)] transition-all duration-500" 
            style={{ width: `${Math.max(5, (currentQuestionIndex / totalQuestions) * 100)}%` }}
          />
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-8 scroll-smooth">
          <AnimatePresence>
            {answers.map((ans, i) => (
              <div key={i} className="space-y-4">
                <div className="flex justify-start">
                  <div className="max-w-[85%] sm:max-w-[75%] px-[18px] py-[14px] rounded-[12px] bg-[linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.2))] border border-[rgba(124,58,237,0.3)] text-[15px] text-white leading-[1.6] shadow-sm">
                    <Markdown>{ans.question}</Markdown>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] px-[18px] py-[14px] rounded-[12px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] text-[15px] text-[rgba(255,255,255,0.9)] leading-[1.6] shadow-sm">
                    <Markdown>{ans.answer}</Markdown>
                  </div>
                </div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 text-base p-4 rounded-[12px] border ${ans.isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                >
                  {ans.isCorrect ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                  <span className="flex-1 text-sm leading-relaxed">{ans.feedback}</span>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border tracking-wider mt-2 sm:mt-0 shrink-0 ${ans.score >= 7 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : ans.score >= 5 ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-red-500/20 border-red-500/30 text-red-300'}`}>
                    SCORE: {ans.score}/10
                  </span>
                </motion.div>
              </div>
            ))}

            {!isComplete && currentQuestion && (
              <motion.div key="cq" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] px-[18px] py-[14px] rounded-[12px] bg-[linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.2))] border border-[rgba(124,58,237,0.3)] text-[15px] text-white leading-[1.6] shadow-sm">
                  <Markdown>{currentQuestion}</Markdown>
                </div>
              </motion.div>
            )}

            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-4 py-3 rounded-[12px] flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[rgba(255,255,255,0.5)]" />
                  <span className="text-[rgba(255,255,255,0.5)] text-sm italic">AI is evaluating...</span>
                </div>
              </motion.div>
            )}

            {aiError && !isLoading && (
              <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-[12px] space-y-3 max-w-[75%]">
                  <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                    <AlertCircle size={14} /> {aiError}
                  </div>
                  {retryFn && (
                    <button onClick={() => { setAiError(null); retryFn.fn(); }}
                      className="flex items-center gap-2 bg-red-600/80 border border-red-500/50 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600">
                      <RefreshCw size={13} /> Retry
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input area */}
        {!isComplete && (
          <div className="px-4 pb-6 pt-2">
            <div className="max-w-4xl mx-auto bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[12px] px-[14px] py-[10px] space-y-3">
              <div className="flex gap-3 items-end">
                <button
                  onClick={toggleRecording}
                  className={`w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 transition-all mt-auto mb-1 ${isRecording ? 'bg-red-500/80 animate-pulse border border-red-500' : 'bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white hover:opacity-90'}`}
                >
                  {isRecording ? <MicOff size={16} className="text-white" /> : <Mic size={16} className="text-white" />}
                </button>
                <div className="flex-1 relative flex items-center bg-transparent">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    placeholder={isRecording ? `Listening in ${language}...` : isAllAnswered ? 'All questions answered — submit now' : `Type your answer or speak in ${language}...`}
                    value={currentInput}
                    onChange={e => {
                      setCurrentInputSynced(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isAllAnswered && !isLoading && currentInput.trim()) {
                          handleNextQuestion();
                        }
                      }
                    }}
                    disabled={isAllAnswered || isLoading}
                    className="w-full bg-transparent text-white placeholder-white/30 outline-none disabled:opacity-50 text-[15px] resize-none overflow-y-auto leading-relaxed px-2 py-2 italic font-light scrollbar-hide"
                    style={{ minHeight: '40px', maxHeight: '140px' }}
                  />
                  {!isAllAnswered && (
                    <button
                      onClick={handleNextQuestion}
                      disabled={!currentInput.trim() || isLoading}
                      className="shrink-0 w-[32px] h-[32px] bg-[rgba(124,58,237,0.4)] text-white rounded-lg flex items-center justify-center hover:bg-[rgba(124,58,237,0.6)] transition-all disabled:opacity-40 self-end mb-1 mr-1"
                    >
                      <Send size={14} />
                    </button>
                  )}
                </div>
                {isAllAnswered && (
                  <button
                    onClick={() => submitViva()}
                    disabled={isLoading}
                    className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-6 py-2 h-[40px] rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-500/30 shrink-0 transition-all disabled:opacity-50 self-end mb-1"
                  >
                    <CheckCircle size={16} /> Submit
                  </button>
                )}
              </div>
              <p className="text-[#ffffff80] text-[9px] text-center uppercase tracking-widest font-semibold pb-1 border-t border-[rgba(255,255,255,0.05)] pt-2 mt-2">
                {isAllAnswered ? 'REVIEW AND SUBMIT YOUR VIVA' : 'AI EVALUATES YOUR KNOWLEDGE IN REAL-TIME'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Main Student Portal ──────────────────────────────────────────────────────
export const StudentViva: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [classMessages, setClassMessages] = useState<ClassMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [examCode, setExamCode] = useState('');
  const [examLanguage, setExamLanguage] = useState('English');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [loadedExam, setLoadedExam] = useState<ExamConfig | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  const [classroomsLoading, setClassroomsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Dashboard & History specific state
  const [completedExamCodes, setCompletedExamCodes] = useState<Set<string>>(new Set());
  const [completedVivas, setCompletedVivas] = useState<{response: VivaResponse; exam: ExamConfig | null}[]>([]);
  const [availableExams, setAvailableExams] = useState<ExamConfig[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const cls = await getStudentClassrooms(user.id);
        setClassrooms(cls);
        setClassroomsLoading(false);

        const [completed, allExams] = await Promise.all([
          getCompletedExamsForStudent(user.id),
          getAllExams()
        ]);
        
        setCompletedVivas(completed.sort((a,b) => b.response.timestamp - a.response.timestamp));

        const examCodes = new Set<string>();
        completed.forEach(c => {
          if (c.response?.examCode) examCodes.add(c.response.examCode);
          else if (c.exam?.examCode) examCodes.add(c.exam.examCode);
        });
        setCompletedExamCodes(examCodes);

        const enrolledClassIds = new Set(cls.map(c => c.id));
        const pending = allExams.filter(e => 
          enrolledClassIds.has(e.classroomId) && !examCodes.has(e.examCode)
        );
        setAvailableExams(pending);
      } catch (err) {
        console.error(err);
      } finally {
        setDashboardLoading(false);
      }
    }
    loadData();
  }, [user.id]);

  const loadMessages = async (classroom: Classroom) => {
    setSelectedClassroom(classroom);
    setMessagesLoading(true);
    try {
      const msgs = await getMessages(classroom.id);
      setClassMessages(msgs);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = examCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setVerifyError('Please enter a valid 6-character exam code.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    const { exam, error } = await verifyExamCode(code, user.id);
    setVerifying(false);
    if (error) {
      setVerifyError(error);
    } else if (exam) {
      setLoadedExam(exam);
    }
  };

  const navItems: { id: SidebarTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { id: 'classes', icon: <BookOpen size={18} />, label: 'My Classes', badge: classrooms.length },
    { id: 'history', icon: <Clock size={18} />, label: 'Past Vivas' },
    { id: 'profile', icon: <User size={18} />, label: 'Profile' },
    { id: 'exam', icon: <Key size={18} />, label: 'Start Exam' },
  ];

  // Show exam session if exam is active
  if (examStarted && loadedExam) {
    return (
      <ExamSession
        exam={loadedExam}
        language={examLanguage}
        user={user}
        onComplete={() => {
          setExamStarted(false);
          setLoadedExam(null);
          setExamCode('');
          setActiveTab('classes');
        }}
      />
    );
  }

  return (
    <div className="flex gap-6 min-h-[80vh]">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-52'} shrink-0 transition-all duration-300`}>
        <div className="bg-[rgba(255,255,255,0.06)] border-r border-[rgba(255,255,255,0.08)] rounded-[14px] p-2 space-y-1 sticky top-24 min-h-[500px]">
          {!sidebarCollapsed && (
            <div className="px-3 py-4 mb-3 border-b border-[rgba(255,255,255,0.08)]">
              <div className="w-[52px] h-[52px] bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-[14px] flex items-center justify-center text-white font-bold text-[22px] mb-3 shadow-lg shadow-indigo-500/20">
                {user.name[0].toUpperCase()}
              </div>
              <p className="font-bold text-[15px] text-white leading-tight truncate">{user.name}</p>
              <p className="text-[10px] font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-widest mt-0.5">Student</p>
            </div>
          )}

          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedClassroom(null); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-[13px] font-semibold transition-all ${activeTab === item.id ? 'bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white shadow-md shadow-indigo-500/10' : 'bg-transparent text-[rgba(255,255,255,0.55)] hover:bg-white/5 hover:text-white'}`}
            >
              <div className="relative flex items-center justify-center">
                {activeTab === item.id && <div className="absolute -left-[14px] w-1.5 h-1.5 bg-[#a78bfa] rounded-full shadow-[0_0_8px_theme(colors.purple.400)]" />}
                {item.icon}
              </div>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center py-2 mt-4 text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
          >
            <ChevronRight size={14} className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
              {dashboardLoading ? (
                <div className="text-center py-20 text-[rgba(255,255,255,0.3)]"><Loader2 size={32} className="mx-auto mb-2 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left Column: Pending Exams */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock size={18} className="text-[#a78bfa]" /> Pending Exams
                    </h3>
                    {availableExams.length === 0 ? (
                      <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-8 text-center backdrop-blur-sm">
                        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400/50" />
                        <p className="font-bold uppercase tracking-widest text-[11px] text-[rgba(255,255,255,0.5)]">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableExams.map(ex => {
                          const cls = classrooms.find(c => c.id === ex.classroomId);
                          return (
                            <div key={ex.id} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-4 flex items-center justify-between group hover:border-[#a78bfa]/50 transition-all">
                              <div>
                                <h4 className="font-bold text-white text-[15px]">{ex.subject}</h4>
                                <p className="text-[12px] text-[rgba(255,255,255,0.5)] mt-0.5">{cls?.name || 'Classroom'}</p>
                                <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)]">
                                  <span>{ex.questionCount || ex.customQuestions?.length} Questions</span>
                                  <span>•</span>
                                  <span>{ex.timeLimit}M Limit</span>
                                </div>
                              </div>
                              <button
                                onClick={() => { setExamCode(ex.examCode); setActiveTab('exam'); }}
                                className="bg-[rgba(124,58,237,0.2)] text-[#c4b5fd] hover:bg-[rgba(124,58,237,0.4)] hover:text-white px-4 py-2 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all"
                              >
                                Start <ChevronRight size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Recent Activity */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart2 size={18} className="text-[#a78bfa]" /> Recent Vivas
                    </h3>
                    {completedVivas.length === 0 ? (
                      <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-8 text-center backdrop-blur-sm">
                        <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold uppercase tracking-widest text-[11px] text-[rgba(255,255,255,0.5)]">No completed vivas yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedVivas.slice(0, 3).map((viva, idx) => (
                          <div key={idx} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-4 flex items-center justify-between hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer" onClick={() => setActiveTab('history')}>
                            <div>
                              <h4 className="font-bold text-white text-[15px]">{viva.exam?.subject || 'Exam'}</h4>
                              <p className="text-[11px] text-[rgba(255,255,255,0.4)] mt-1 font-bold uppercase tracking-widest">{new Date(viva.response.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-[13px] font-black border ${viva.response.grade >= 8 ? 'bg-[rgba(16,185,129,0.15)] border-[rgba(16,185,129,0.3)] text-[#6ee7b7]' : viva.response.grade >= 5 ? 'bg-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.3)] text-[#fcd34d]' : 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.3)] text-[#fca5a5]'}`}>
                              {viva.response.grade}/10
                            </div>
                          </div>
                        ))}
                        {completedVivas.length > 3 && (
                          <button onClick={() => setActiveTab('history')} className="w-full py-2 text-[12px] font-bold uppercase tracking-widest text-[#a78bfa] hover:text-white transition-colors">
                            View All History
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* HISTORY / PAST VIVAS */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Past Vivas & Transcripts</h2>
              {dashboardLoading ? (
                <div className="text-center py-20 text-[rgba(255,255,255,0.3)]"><Loader2 size={32} className="mx-auto mb-2 animate-spin" /></div>
              ) : completedVivas.length === 0 ? (
                <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-16 text-center backdrop-blur-sm">
                  <Clock size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold uppercase tracking-widest text-[13px] text-[rgba(255,255,255,0.5)]">No History Found</p>
                  <p className="text-[12px] mt-2 text-[rgba(255,255,255,0.4)]">Complete your first exam to see transcripts here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedVivas.map(({ response: r, exam }) => {
                    const isExpanded = expandedHistoryId === r.id;
                    return (
                      <div key={r.id} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 overflow-hidden transition-all group">
                        <div 
                          className="flex justify-between items-start cursor-pointer hover:bg-[rgba(255,255,255,0.02)] -m-5 p-5 transition-colors" 
                          onClick={() => setExpandedHistoryId(isExpanded ? null : r.id)}
                        >
                          <div>
                            <p className="font-bold text-[16px] text-white">{exam?.subject || r.examCode || 'Unknown Exam'}</p>
                            <p className="text-[11px] text-[rgba(255,255,255,0.4)] mt-2 font-bold uppercase tracking-widest">Date: {new Date(r.timestamp).toLocaleString()} • Language: {r.language || 'English'}</p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <div className={`text-[20px] flex items-center gap-3 font-black ${r.grade >= 8 ? 'text-[#6ee7b7]' : r.grade >= 5 ? 'text-[#fcd34d]' : 'text-[#fca5a5]'}`}>
                              <span>{r.grade}<span className="text-[12px] font-bold text-[rgba(255,255,255,0.3)] ml-1">/10</span></span>
                              <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[rgba(255,255,255,0.5)] group-hover:text-white group-hover:bg-[rgba(255,255,255,0.2)] transition-all">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                            {r.cheatingStrikes && r.cheatingStrikes > 0 ? (
                              <span className="text-[9px] bg-[rgba(239,68,68,0.2)] text-[#fca5a5] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-[rgba(239,68,68,0.4)]">
                                ⚠ {r.cheatingStrikes} strike{r.cheatingStrikes > 1 ? 's' : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Transcript body */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)] space-y-4"
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a78bfa] mb-0 bg-[rgba(124,58,237,0.1)] px-3 py-1.5 rounded-[8px] inline-block border border-[rgba(124,58,237,0.2)]">Viva Transcript & AI Feedback</h4>
                                <span className="text-[11px] font-bold text-[rgba(255,255,255,0.4)] uppercase">Overall Logic: {r.logicScore}/10</span>
                              </div>
                              {r.feedback && (
                                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-4 text-[13px] text-[rgba(255,255,255,0.8)] leading-relaxed italic border-l-2 border-l-[#a78bfa]">
                                  {r.feedback}
                                </div>
                              )}
                              {r.answers.map((ans, idx) => (
                                <div key={idx} className="space-y-4 bg-[rgba(15,12,41,0.4)] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-[rgba(124,58,237,0.05)] blur-2xl rounded-full" />
                                  
                                  <div className="flex gap-4 relative z-10">
                                    <div className="w-8 h-8 rounded-xl bg-[rgba(124,58,237,0.2)] flex items-center justify-center shrink-0 border border-[rgba(124,58,237,0.4)]">
                                      <span className="text-[#a78bfa] font-black text-[10px] uppercase">AI</span>
                                    </div>
                                    <div className="text-[14px] font-medium pt-1 prose prose-sm prose-invert max-w-none text-white"><Markdown>{ans.question}</Markdown></div>
                                  </div>
                                  <div className="flex gap-4 ml-6 relative z-10">
                                    <div className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 border border-[rgba(255,255,255,0.2)]">
                                      <User size={14} className="text-[rgba(255,255,255,0.8)]" />
                                    </div>
                                    <div className="text-[13px] text-[rgba(255,255,255,0.6)] pt-1 prose prose-sm prose-invert max-w-none"><Markdown>{ans.answer}</Markdown></div>
                                  </div>
                                  <div className={`relative z-10 ml-[calc(1.5rem+32px)] text-[13px] p-4 rounded-[12px] border ${ans.isCorrect ? 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)] text-[#6ee7b7]' : 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#fca5a5]'}`}>
                                    <strong className="block mb-1 text-[10px] uppercase tracking-widest opacity-80 flex items-center gap-1">
                                      {ans.isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />} Evaluation
                                    </strong> 
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
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">My Profile</h2>
              <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-[20px] p-8 space-y-8 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[rgba(124,58,237,0.1)] blur-[80px] rounded-full pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-[88px] h-[88px] bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-[20px] flex items-center justify-center text-white text-[36px] font-black shadow-lg shadow-indigo-500/20 rotate-3 hover:rotate-0 transition-transform">
                    {user.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[28px] font-black text-white tracking-tight">{user.name}</h3>
                    <p className="text-[14px] font-medium text-[rgba(255,255,255,0.5)] mt-0.5">{user.email}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] text-[#a78bfa] text-[11px] font-bold px-3 pt-[3px] pb-[4px] rounded-[8px] uppercase tracking-widest shadow-sm">
                      <GraduationCap size={14} /> Registered Student
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-[rgba(255,255,255,0.08)] pt-6 grid grid-cols-2 gap-4 relative z-10">
                  {[
                    { label: 'System User ID', value: user.id.slice(0, 8) + '…', icon: <User size={48} className="absolute right-2 bottom-2 text-white opacity-[0.03] group-hover:opacity-[0.05] transition-opacity" /> },
                    { label: 'Enrolled Classes', value: classrooms.length, icon: <BookOpen size={48} className="absolute right-2 bottom-2 text-white opacity-[0.03] group-hover:opacity-[0.05] transition-opacity" /> },
                  ].map(f => (
                    <div key={f.label} className="bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded-[16px] p-5 relative overflow-hidden group">
                      {f.icon}
                      <p className="text-[10px] text-[rgba(255,255,255,0.5)] font-bold uppercase tracking-widest mb-1">{f.label}</p>
                      <p className="font-black text-white text-[24px]">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* MY CLASSES */}
          {activeTab === 'classes' && !selectedClassroom && (
            <motion.div key="classes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">My Classes</h2>
              {classroomsLoading ? (
                <div className="text-center py-20 text-[rgba(255,255,255,0.3)]">
                  <Loader2 size={32} className="mx-auto mb-2 animate-spin" />
                </div>
              ) : classrooms.length === 0 ? (
                <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-12 text-center text-[rgba(255,255,255,0.4)] backdrop-blur-sm">
                  <BookOpen size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="font-bold uppercase tracking-widest text-sm text-[rgba(255,255,255,0.6)]">Not enrolled in any class</p>
                  <p className="text-xs mt-1">Ask your teacher to add you to a classroom</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classrooms.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      whileHover={{ y: -3 }}
                      onClick={() => { loadMessages(c); setActiveTab('classes'); }}
                      className={`bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5 cursor-pointer hover:border-[#a78bfa]/50 transition-all group relative overflow-hidden border-t-[3px] ${idx % 2 === 0 ? 'border-t-[theme(colors.purple.500)]' : 'border-t-[#0f766e]'}`}
                    >
                      <div className="w-10 h-10 bg-[rgba(124,58,237,0.2)] rounded-[8px] flex items-center justify-center mb-4">
                        <BookOpen size={18} className="text-[#a78bfa]" />
                      </div>
                      <h3 className="font-bold text-white text-lg">{c.name}</h3>
                      <p className="text-[14px] text-[rgba(255,255,255,0.5)]">{c.subject}</p>
                      <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-1 font-semibold uppercase tracking-wider">by {c.teacherName}</p>
                      <div className="mt-5 flex items-center gap-1 text-[#a78bfa] text-[13px] font-bold group-hover:gap-2 transition-all">
                        View Messages <ChevronRight size={14} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* CLASS MESSAGES */}
          {activeTab === 'classes' && selectedClassroom && (
            <motion.div key="messages" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedClassroom(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white">
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedClassroom.name}</h2>
                  <p className="text-sm text-[rgba(255,255,255,0.5)] font-semibold">{selectedClassroom.subject} <span className="text-[rgba(255,255,255,0.2)] mx-1">•</span> {selectedClassroom.teacherName}</p>
                </div>
              </div>

              {messagesLoading ? (
                <div className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-[rgba(255,255,255,0.3)]" /></div>
              ) : classMessages.length === 0 ? (
                <div className="text-center py-16 text-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-[14px]">
                  <MessageSquare size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold uppercase tracking-widest text-[rgba(255,255,255,0.6)]">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {classMessages.map(m => (
                    <div key={m.id} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-5">
                      <p className="text-[15px] leading-relaxed text-[rgba(255,255,255,0.9)]">{m.text}</p>
                      {m.examCode && (
                        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.4)] rounded-lg p-4">
                          <span className="text-[11px] text-[#a78bfa] font-semibold uppercase tracking-widest flex items-center gap-2"><Key size={14} /> Exam Code</span>
                          <div className="flex flex-wrap items-center gap-3 ml-auto w-full sm:w-auto">
                            <div className="font-mono font-black text-[20px] text-white tracking-[6px] px-2">{m.examCode}</div>
                            <button
                              onClick={() => { setExamCode(m.examCode!); setActiveTab('exam'); }}
                              disabled={completedExamCodes.has(m.examCode)}
                              className={`flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-md transition-all sm:ml-4 w-full sm:w-auto justify-center ${completedExamCodes.has(m.examCode) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : 'bg-[rgba(124,58,237,0.4)] text-[#c4b5fd] hover:bg-[rgba(124,58,237,0.6)] hover:text-white'}`}
                            >
                              {completedExamCodes.has(m.examCode) ? (
                                <><CheckCircle2 size={16} /> Completed</>
                              ) : (
                                <>Use Code <ChevronRight size={14} /></>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[rgba(255,255,255,0.3)] mt-4">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* START EXAM */}
          {activeTab === 'exam' && (
            <motion.div key="exam-entry" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-xl mx-auto mt-6">
              <h2 className="text-2xl font-bold text-white text-center">Start Exam</h2>

              {!loadedExam ? (
                <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] rounded-[14px] p-8 sm:p-10 space-y-8 relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[rgba(124,58,237,0.1)] blur-3xl rounded-full pointer-events-none" />
                  <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-[rgba(79,70,229,0.1)] blur-3xl rounded-full pointer-events-none" />
                  
                  <div className="text-center relative z-10">
                    <div className="w-[48px] h-[48px] bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-[14px] flex items-center justify-center mx-auto mb-5 rotate-3 hover:rotate-0 transition-transform shadow-lg shadow-indigo-500/20">
                      <Key size={22} className="text-white" />
                    </div>
                    <h3 className="font-black text-2xl text-white tracking-tight">Unlock Exam</h3>
                    <p className="text-[13px] font-medium text-[rgba(255,255,255,0.5)] mt-1.5">Enter the 6-character code provided by your teacher</p>
                  </div>

                  <div className="relative z-10">
                    <input
                      type="text"
                      placeholder="e.g. A1B2C3"
                      value={examCode}
                      onChange={e => { setExamCode(e.target.value.toUpperCase()); setVerifyError(''); }}
                      maxLength={6}
                      className="w-full text-center text-[20px] font-mono font-black tracking-[10px] bg-[rgba(255,255,255,0.08)] border border-[rgba(124,58,237,0.4)] rounded-xl px-4 py-6 outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-[#7c3aed] uppercase transition-all text-[#a78bfa] placeholder-white/20"
                    />
                  </div>

                  <div className="relative z-10 border-t border-[rgba(255,255,255,0.08)] pt-6">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.4)] mb-3 text-center sm:text-left">Preferred Output Language</label>
                    <div className="relative">
                      <select
                        value={examLanguage}
                        onChange={e => setExamLanguage(e.target.value)}
                        className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(124,58,237,0.4)] rounded-xl pl-4 pr-10 py-3.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-[#7c3aed] appearance-none transition-all cursor-pointer"
                      >
                        {Object.keys(SUPPORTED_LANGUAGES).map(l => (
                          <option key={l} value={l} className="bg-[#1a1a24] text-white">{l}</option>
                        ))}
                      </select>
                      <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a78bfa] rotate-90 pointer-events-none" />
                    </div>
                  </div>

                  {verifyError && (
                    <div className="relative z-10 flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm">
                      <AlertCircle size={16} className="shrink-0" /> {verifyError}
                    </div>
                  )}

                  <div className="relative z-10 pt-2">
                    <button
                      onClick={handleVerifyCode}
                      disabled={verifying || examCode.length !== 6}
                      className="w-full bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] text-white py-[16px] rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {verifying ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                      {verifying ? 'Verifying...' : 'Continue to Exam'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 flex items-center gap-3 backdrop-blur-sm">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-400 text-[15px]">Code Verified!</p>
                      <p className="text-xs text-emerald-400/70 mt-0.5">Exam found for {loadedExam.classroomName}</p>
                    </div>
                    <button onClick={() => { setLoadedExam(null); setExamCode(''); }} className="ml-auto text-emerald-400/50 hover:text-emerald-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <ExamSession
                    exam={loadedExam}
                    language={examLanguage}
                    user={user}
                    onComplete={() => {
                      setLoadedExam(null);
                      setExamCode('');
                      setActiveTab('classes');
                    }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
