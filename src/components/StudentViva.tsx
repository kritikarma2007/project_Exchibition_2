import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, Play, CheckCircle, AlertCircle, Loader2, User, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { ExamConfig, VivaResponse, StudentAnswer } from '../types';
import { getExams, saveResponse } from '../services/storage';
import { generateInitialQuestion, processAnswerAndGetNext, finalizeViva } from '../services/gemini';
import Markdown from 'react-markdown';

// Web Speech API types
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
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface StudentVivaProps {
  user: {
    name: string;
    email: string;
    id: string;
  };
}

export const StudentViva: React.FC<StudentVivaProps> = ({ user }) => {
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamConfig | null>(null);
  const [language, setLanguage] = useState('English');
  const [isStarted, setIsStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [evaluation, setEvaluation] = useState<{ grade: number; feedback: string; logicScore: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string } | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setExams(getExams());
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current!.continuous = true;
      recognitionRef.current!.interimResults = true;
      recognitionRef.current!.lang = 'en-US';

      recognitionRef.current!.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setCurrentInput(transcript);
      };

      recognitionRef.current!.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current!.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answers, currentQuestion, lastFeedback]);

  const startViva = async () => {
    if (!selectedExam) return;
    setIsStarted(true);
    setIsLoading(true);
    setStartTime(Date.now());
    setTimeLeft(selectedExam.timeLimit * 60);

    try {
      const firstQuestion = await generateInitialQuestion(selectedExam);
      setCurrentQuestion(firstQuestion || 'Hello! Let\'s start the viva.');
      setCurrentQuestionIndex(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSubmitViva();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleNextQuestion = async () => {
    if (!currentInput || !selectedExam || !currentQuestion) return;
    
    setIsLoading(true);
    if (isRecording) {
      recognitionRef.current?.stop();
    }

    try {
      // Use combined API call for speed
      const result = await processAnswerAndGetNext(
        selectedExam,
        currentQuestion,
        currentInput,
        currentQuestionIndex,
        answers
      );

      const newAnswer: StudentAnswer = {
        question: currentQuestion,
        answer: currentInput,
        isCorrect: result.evaluation.isCorrect,
        feedback: result.evaluation.feedback
      };

      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);
      setLastFeedback(result.evaluation);
      setCurrentInput('');
      
      const nextIndex = currentQuestionIndex + 1;
      const totalQuestions = selectedExam.customQuestions?.length || selectedExam.questionCount;

      if (result.nextQuestion === 'VIVA_COMPLETE' || nextIndex >= totalQuestions) {
        // All questions done
        setCurrentQuestion('All questions completed. Please submit your viva.');
        setCurrentQuestionIndex(nextIndex);
      } else {
        setCurrentQuestion(result.nextQuestion);
        setCurrentQuestionIndex(nextIndex);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitViva = async (finalAnswers = answers) => {
    if (!selectedExam) return;
    setIsLoading(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const finalEval = await finalizeViva(selectedExam, finalAnswers);
      setEvaluation(finalEval);
      setIsComplete(true);

      const response: VivaResponse = {
        id: Math.random().toString(36).substr(2, 9),
        examId: selectedExam.id,
        studentName: user.name,
        studentEmail: user.email,
        studentId: user.id,
        language,
        answers: finalAnswers,
        grade: finalEval.grade,
        feedback: finalEval.feedback,
        logicScore: finalEval.logicScore,
        timestamp: Date.now(),
        timeTaken: Math.round((Date.now() - startTime) / 1000)
      };
      saveResponse(response);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
        <div className="text-center px-4">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Multilingual Viva Agent</h2>
          <p className="text-[#141414]/60 mt-4 text-sm md:text-base">Choose your exam and start your interactive voice viva.</p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#141414]/10 shadow-xl space-y-6">
          <div className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl border border-[#141414]/5">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[#141414] rounded-xl flex items-center justify-center text-white shrink-0">
              <User size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">Student Profile</p>
              <h3 className="font-bold text-base md:text-lg truncate">{user.name}</h3>
              <p className="text-[10px] md:text-xs text-[#141414]/60 truncate">{user.email} • ID: {user.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2 md:space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Select Exam</label>
              <select 
                onChange={(e) => setSelectedExam(exams.find(ex => ex.id === e.target.value) || null)}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all text-sm md:text-base"
              >
                <option value="">Select an exam...</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.subject} ({ex.difficulty})</option>)}
              </select>
            </div>
            <div className="space-y-2 md:space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#141414]/60">Preferred Language</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all text-sm md:text-base"
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Marathi</option>
                <option>Hinglish</option>
              </select>
            </div>
          </div>

          <button 
            onClick={startViva}
            disabled={!selectedExam}
            className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-all disabled:opacity-50 shadow-lg"
          >
            <Play size={20} />
            Start Viva Now
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = selectedExam?.customQuestions?.length || selectedExam?.questionCount || 0;
  const isAllQuestionsAnswered = currentQuestionIndex >= totalQuestions;

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] md:h-[calc(100vh-160px)] flex flex-col">
      {/* Header */}
      <div className="bg-white p-3 md:p-4 rounded-t-3xl border-x border-t border-[#141414]/10 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white shrink-0">
            <User size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm md:text-base truncate">{selectedExam?.subject}</h3>
            <p className="text-[10px] text-[#141414]/60 uppercase tracking-widest font-bold">
              Q {Math.min(currentQuestionIndex + 1, totalQuestions)} / {totalQuestions}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-6 w-full sm:w-auto">
          <div className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl font-mono font-bold text-sm md:text-base ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-[#F5F5F0] text-[#141414]'}`}>
            <Clock size={16} className="md:w-[18px] md:h-[18px]" />
            {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-emerald-600">Live</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-white border-x border-[#141414]/10 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth"
      >
        <AnimatePresence>
          {/* Previous Answers */}
          {answers.map((ans, i) => (
            <div key={i} className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-[80%] p-4 rounded-2xl bg-[#F5F5F0] text-[#141414] rounded-tl-none">
                  <Markdown>{ans.question}</Markdown>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] p-4 rounded-2xl bg-[#141414] text-white rounded-tr-none">
                  <Markdown>{ans.answer}</Markdown>
                </div>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 text-sm font-bold ${ans.isCorrect ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {ans.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {ans.feedback}
              </motion.div>
            </div>
          ))}

          {/* Current Question */}
          {!isComplete && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[80%] p-4 rounded-2xl bg-[#F5F5F0] text-[#141414] rounded-tl-none border-l-4 border-[#141414]">
                <div className="prose prose-sm max-w-none">
                  <Markdown>{currentQuestion}</Markdown>
                </div>
              </div>
            </motion.div>
          )}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-[#F5F5F0] p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-[#141414]/40" />
                <span className="text-sm font-medium text-[#141414]/40 italic">AI is processing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isComplete && evaluation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-50 border-2 border-emerald-500/20 p-8 rounded-3xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                {evaluation.grade}/10
              </div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-900">Viva Completed!</h3>
                <p className="text-emerald-700 font-medium">Logical Reasoning Score: {evaluation.logicScore}/10</p>
              </div>
            </div>
            <div className="bg-white/50 p-4 rounded-2xl text-emerald-800 leading-relaxed">
              <Markdown>{evaluation.feedback}</Markdown>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
            >
              Return to Dashboard
            </button>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      {!isComplete && (
        <div className="bg-white p-4 md:p-6 rounded-b-3xl border-x border-b border-[#141414]/10">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-center">
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={toggleRecording}
                className={`flex-1 sm:w-14 sm:h-14 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'bg-[#F5F5F0] text-[#141414] hover:bg-[#141414]/5'
                }`}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              {isAllQuestionsAnswered && (
                <button 
                  onClick={() => handleSubmitViva()}
                  disabled={isLoading}
                  className="flex-1 sm:hidden bg-emerald-600 text-white px-4 h-12 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Submit
                </button>
              )}
            </div>
            <div className="flex-1 relative w-full">
              <input 
                type="text"
                placeholder={isRecording ? "Listening..." : isAllQuestionsAnswered ? "All questions answered." : "Type your answer here..."}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isAllQuestionsAnswered && handleNextQuestion()}
                disabled={isAllQuestionsAnswered || isLoading}
                className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 md:px-6 py-3 md:py-4 focus:ring-2 focus:ring-[#141414] transition-all pr-14 disabled:opacity-50 text-sm md:text-base"
              />
              {!isAllQuestionsAnswered && (
                <button 
                  onClick={handleNextQuestion}
                  disabled={!currentInput || isLoading}
                  className="absolute right-2 top-2 w-8 h-8 md:w-10 md:h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center hover:bg-[#141414]/90 transition-all disabled:opacity-50"
                >
                  <Send size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
              )}
            </div>
            {isAllQuestionsAnswered && (
              <button 
                onClick={() => handleSubmitViva()}
                disabled={isLoading}
                className="hidden sm:flex bg-emerald-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg items-center gap-2 whitespace-nowrap"
              >
                <CheckCircle size={20} />
                Submit Viva
              </button>
            )}
          </div>
          <p className="text-[9px] md:text-[10px] text-[#141414]/40 uppercase tracking-widest font-bold mt-3 md:mt-4 text-center">
            {isAllQuestionsAnswered ? "Please review your answers and click submit" : "AI is analyzing your logical reasoning in real-time"}
          </p>
        </div>
      )}
    </div>
  );
};

