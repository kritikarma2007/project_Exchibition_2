import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, LogOut, GraduationCap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'teacher' | 'student' | 'analytics';
  setActiveTab: (tab: 'teacher' | 'student' | 'analytics') => void;
  role: 'teacher' | 'student' | null;
  setRole: (role: 'teacher' | 'student' | null) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, setRole }) => {
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  
  return (
    <div className="min-h-screen relative font-sans overflow-hidden text-white bg-[linear-gradient(135deg,#0f0c29,#302b63,#24243e)]">
      {/* Background glow orbs - using exact dark theme styles */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-[rgba(124,58,237,0.1)] blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-[rgba(79,70,229,0.1)] blur-[100px] rounded-full pointer-events-none" />

      {/* Main Content Wrapper */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="h-[64px] bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.08)] px-4 md:px-8 flex justify-between items-center sticky top-0 z-50 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRole(null)}>
            <div className="w-10 h-10 bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              {isStudent ? (
                <GraduationCap size={22} />
              ) : (
                <BookOpen size={22} />
              )}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-tight text-white mt-0.5">
                SmartViva
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.5)] mt-0.5">
                {role === 'teacher' ? 'TEACHER PORTAL' : role === 'student' ? 'STUDENT PORTAL' : ''}
              </p>
            </div>
          </div>

          {role && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(255,255,255,0.08)] rounded-[20px]">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">{role} User</span>
              </div>
              <button
                onClick={() => setRole(null)}
                className="flex items-center gap-1.5 w-9 h-9 justify-center text-[rgba(255,255,255,0.5)] hover:text-[#fca5a5] hover:bg-[rgba(239,68,68,0.1)] transition-colors rounded-xl font-bold text-[11px]"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </nav>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
