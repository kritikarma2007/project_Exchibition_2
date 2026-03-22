import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, BarChart2, Settings, LogOut, User, GraduationCap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'teacher' | 'student' | 'analytics';
  setActiveTab: (tab: 'teacher' | 'student' | 'analytics') => void;
  role: 'teacher' | 'student' | null;
  setRole: (role: 'teacher' | 'student' | null) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, role, setRole }) => {
  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Top Black Bar */}
      <div className="bg-[#141414] h-10 w-full flex items-center justify-end px-6">
        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Viva/</span>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-[#141414]/10 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRole(null)}>
          <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
            <BookOpen size={22} />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">
            AI Speech Based Viva System
          </h1>
        </div>
        
        <div className="flex gap-2 md:gap-4">
          {role === 'teacher' && (
            <>
              <button 
                onClick={() => setActiveTab('teacher')}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all ${activeTab === 'teacher' ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/5'}`}
              >
                <Settings size={18} />
                <span className="text-sm font-medium hidden sm:inline">Configure</span>
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/5'}`}
              >
                <BarChart2 size={18} />
                <span className="text-sm font-medium hidden sm:inline">Analytics</span>
              </button>
            </>
          )}
          {role === 'student' && (
            <button 
              onClick={() => setActiveTab('student')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all ${activeTab === 'student' ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/5'}`}
            >
              <GraduationCap size={18} />
              <span className="text-sm font-medium hidden sm:inline">My Exams</span>
            </button>
          )}
        </div>

        {role && (
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden xs:flex items-center gap-2 px-3 py-1 bg-[#141414]/5 rounded-full">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">{role}</span>
            </div>
            <button 
              onClick={() => setRole(null)}
              className="w-10 h-10 flex items-center justify-center text-[#141414]/60 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};
