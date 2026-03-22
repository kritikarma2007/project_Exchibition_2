import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentViva } from './components/StudentViva';
import { Analytics } from './components/Analytics';
import { motion } from 'motion/react';
import { GraduationCap, UserCog, Mail, User, Fingerprint, ArrowRight } from 'lucide-react';

interface UserData {
  name: string;
  email: string;
  id: string;
  role: 'teacher' | 'student';
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'teacher' | 'student' | 'analytics'>('teacher');
  const [authForm, setAuthForm] = useState<UserData>({
    name: '',
    email: '',
    id: '',
    role: 'student'
  });
  const [isAuthMode, setIsAuthMode] = useState(false);

  useEffect(() => {
    const handleSwitchTab = (e: any) => {
      setActiveTab(e.detail);
    };
    window.addEventListener('switchTab', handleSwitchTab);
    return () => window.removeEventListener('switchTab', handleSwitchTab);
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authForm.name && authForm.email && authForm.id) {
      setUser(authForm);
      setActiveTab(authForm.role);
    }
  };

  if (!user) {
    if (!isAuthMode) {
      return (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={null} setRole={() => setUser(null)}>
          <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-4 md:p-6 space-y-8 md:space-y-12">
            <div className="text-center space-y-4">
              <p className="text-lg md:text-xl text-[#141414]/60 max-w-2xl mx-auto">
                The next generation of automated oral examinations powered by advanced AI and speech recognition.
              </p>
            </div>

            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setAuthForm({ ...authForm, role: 'teacher' }); setIsAuthMode(true); }}
                className="bg-white p-8 md:p-12 rounded-[32px] md:rounded-[40px] border border-[#141414]/10 shadow-xl cursor-pointer flex flex-col items-center text-center space-y-6 group"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-[#141414] rounded-3xl flex items-center justify-center text-white group-hover:rotate-6 transition-transform">
                  <UserCog size={40} className="md:w-12 md:h-12" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">I am a Teacher</h2>
                  <p className="text-[#141414]/60 mt-2 text-sm md:text-base">Configure exams, set custom questions, and analyze student performance.</p>
                </div>
                <div className="w-full py-4 bg-[#141414]/5 rounded-2xl font-bold group-hover:bg-[#141414] group-hover:text-white transition-all">
                  Enter Dashboard
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => { setAuthForm({ ...authForm, role: 'student' }); setIsAuthMode(true); }}
                className="bg-white p-8 md:p-12 rounded-[32px] md:rounded-[40px] border border-[#141414]/10 shadow-xl cursor-pointer flex flex-col items-center text-center space-y-6 group"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-600 rounded-3xl flex items-center justify-center text-white group-hover:-rotate-6 transition-transform">
                  <GraduationCap size={40} className="md:w-12 md:h-12" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">I am a Student</h2>
                  <p className="text-[#141414]/60 mt-2 text-sm md:text-base">Take your viva exams, get instant feedback, and track your progress.</p>
                </div>
                <div className="w-full py-4 bg-emerald-600/5 rounded-2xl font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all text-emerald-700">
                  Start Exam
                </div>
              </motion.div>
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={null} setRole={() => setUser(null)}>
        <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-4 md:p-6 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-[#141414]/10 shadow-2xl w-full max-w-md space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold">Welcome {authForm.role === 'teacher' ? 'Teacher' : 'Student'}</h2>
              <p className="text-[#141414]/60 text-sm md:text-base">Please provide your details to continue</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#141414]/40" size={20} />
                  <input 
                    type="text"
                    required
                    placeholder="Full Name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#141414]/40" size={20} />
                  <input 
                    type="email"
                    required
                    placeholder="Email Address"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                  />
                </div>
                <div className="relative">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-[#141414]/40" size={20} />
                  <input 
                    type="text"
                    required
                    placeholder={authForm.role === 'teacher' ? "Teacher ID" : "Student ID"}
                    value={authForm.id}
                    onChange={(e) => setAuthForm({ ...authForm, id: e.target.value })}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-all shadow-lg"
              >
                Continue to Dashboard
                <ArrowRight size={20} />
              </button>

              <button 
                type="button"
                onClick={() => setIsAuthMode(false)}
                className="w-full text-[#141414]/40 text-sm font-bold uppercase tracking-widest hover:text-[#141414] transition-all"
              >
                Back to Role Selection
              </button>
            </form>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} setRole={() => setUser(null)}>
      {activeTab === 'teacher' && <TeacherDashboard user={user} />}
      {activeTab === 'student' && <StudentViva user={user} />}
      {activeTab === 'analytics' && <Analytics />}
    </Layout>
  );
}
