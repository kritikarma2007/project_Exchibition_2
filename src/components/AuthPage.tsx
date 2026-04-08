import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, UserCog, Mail, Lock, User, Fingerprint,
  ArrowRight, ArrowLeft, Eye, EyeOff, AlertCircle, Sparkles
} from 'lucide-react';
import { signUp, login, UserData } from '../services/auth';

interface AuthPageProps {
  onAuth: (user: UserData) => void;
}

type Role = 'teacher' | 'student';
type Mode = 'select' | 'login' | 'signup';

export function AuthPage({ onAuth }: AuthPageProps) {
  const [role, setRole] = useState<Role>('student');
  const [mode, setMode] = useState<Mode>('select');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: '',
  });

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setMode('login');
    setError('');
    setForm({ name: '', email: '', password: '', confirmPassword: '', roleId: '' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true);
    setError('');
    const result = await login(form.email, form.password, role);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (result.user) onAuth(result.user);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.roleId) return;
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await signUp(form.name, form.email, form.password, role, form.roleId);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (result.user) onAuth(result.user);
  };

  const isTeacher = role === 'teacher';
  const accent = isTeacher ? '#6366f1' : '#10b981';
  const accentLight = isTeacher ? '#eef2ff' : '#d1fae5';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)' }}>

      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: isTeacher ? '#6366f1' : '#10b981' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: isTeacher ? '#8b5cf6' : '#059669' }} />

      <AnimatePresence mode="wait">

        {/* ── Role Selection ── */}
        {mode === 'select' && (
          <motion.div key="select"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-3xl"
          >
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-sm font-medium px-4 py-2 rounded-full mb-6 backdrop-blur-sm border border-white/10">
                <Sparkles size={14} />
                Smart AI Viva
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                Welcome Back
              </h1>
              <p className="text-white/50 text-lg">Choose your role to get started</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Teacher Card */}
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelect('teacher')}
                className="group relative p-8 rounded-3xl border text-left overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(99,102,241,0.3)' }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }} />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <UserCog size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Teacher</h2>
                  <p className="text-white/50 text-sm leading-relaxed">Configure exams, manage students, and analyse performance</p>
                  <div className="mt-6 flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    Enter Dashboard <ArrowRight size={16} />
                  </div>
                </div>
              </motion.button>

              {/* Student Card */}
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelect('student')}
                className="group relative p-8 rounded-3xl border text-left overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(16,185,129,0.3)' }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
                  style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))' }} />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    <GraduationCap size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Student</h2>
                  <p className="text-white/50 text-sm leading-relaxed">Take your viva exams, get instant AI feedback and track progress</p>
                  <div className="mt-6 flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    Start Exam <ArrowRight size={16} />
                  </div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Login & Signup Forms ── */}
        {(mode === 'login' || mode === 'signup') && (
          <motion.div key={mode}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md"
          >
            {/* Back button */}
            <button onClick={() => { setMode('select'); setError(''); }}
              className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm font-medium mb-8 transition-colors">
              <ArrowLeft size={16} />
              Change role
            </button>

            {/* Card */}
            <div className="rounded-3xl p-8 border backdrop-blur-xl"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>

              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isTeacher ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#10b981,#059669)' }}>
                  {isTeacher ? <UserCog size={22} className="text-white" /> : <GraduationCap size={22} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {mode === 'login' ? 'Welcome back,' : 'Create account,'}
                  </h2>
                  <p className="text-white/40 text-sm capitalize">{role}</p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-6">
                    <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── LOGIN FORM ── */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <InputField icon={<Mail size={18} />} type="email" placeholder="Email address"
                    value={form.email} onChange={v => updateForm('email', v)} accent={accent} />
                  <InputField icon={<Lock size={18} />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password} onChange={v => updateForm('password', v)} accent={accent}
                    rightIcon={
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="text-white/30 hover:text-white/60 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="submit" disabled={loading}
                    className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base mt-2 disabled:opacity-60 shadow-lg transition-all"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${isTeacher ? '#8b5cf6' : '#059669'})` }}>
                    {loading ? <LoadingDots /> : <><span>Login</span><ArrowRight size={18} /></>}
                  </motion.button>

                  <p className="text-center text-white/40 text-sm pt-2">
                    Don't have an account?{' '}
                    <button type="button" onClick={() => { setMode('signup'); setError(''); }}
                      className="font-semibold hover:underline transition-all" style={{ color: accent }}>
                      Sign up
                    </button>
                  </p>
                </form>
              )}

              {/* ── SIGNUP FORM ── */}
              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <InputField icon={<User size={18} />} type="text" placeholder="Full name"
                    value={form.name} onChange={v => updateForm('name', v)} accent={accent} />
                  <InputField icon={<Mail size={18} />} type="email" placeholder="Email address"
                    value={form.email} onChange={v => updateForm('email', v)} accent={accent} />
                  <InputField icon={<Fingerprint size={18} />} type="text"
                    placeholder={isTeacher ? 'Teacher ID (e.g. TCH-001)' : 'Student ID (e.g. STU-101)'}
                    value={form.roleId} onChange={v => updateForm('roleId', v)} accent={accent} />
                  <InputField icon={<Lock size={18} />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 6 chars)"
                    value={form.password} onChange={v => updateForm('password', v)} accent={accent}
                    rightIcon={
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="text-white/30 hover:text-white/60 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <InputField icon={<Lock size={18} />} type="password" placeholder="Confirm password"
                    value={form.confirmPassword} onChange={v => updateForm('confirmPassword', v)} accent={accent} />

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="submit" disabled={loading}
                    className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base mt-2 disabled:opacity-60 shadow-lg transition-all"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${isTeacher ? '#8b5cf6' : '#059669'})` }}>
                    {loading ? <LoadingDots /> : <><span>Create Account</span><ArrowRight size={18} /></>}
                  </motion.button>

                  <p className="text-center text-white/40 text-sm pt-2">
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setMode('login'); setError(''); }}
                      className="font-semibold hover:underline transition-all" style={{ color: accent }}>
                      Login
                    </button>
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InputFieldProps {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  rightIcon?: React.ReactNode;
}

function InputField({ icon, type, placeholder, value, onChange, accent, rightIcon }: InputFieldProps) {
  return (
    <div className="relative group">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60 transition-colors pointer-events-none">
        {icon}
      </span>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-11 py-4 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-all"
        style={{ '--tw-ring-color': accent } as React.CSSProperties}
        onFocus={e => { e.currentTarget.style.borderColor = accent + '60'; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}20`; }}
        onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
      />
      {rightIcon && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2">{rightIcon}</span>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-2 h-2 bg-white rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </div>
  );
}
