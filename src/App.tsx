import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentViva } from './components/StudentViva';
import { AuthPage } from './components/AuthPage';
import { getCurrentUser, logout, UserData } from './services/auth';

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);

  // Auto-restore session on page load
  useEffect(() => {
    const saved = getCurrentUser();
    if (saved) setUser(saved);
  }, []);

  const handleAuth = (authUser: UserData) => {
    setUser(authUser);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <Layout
      activeTab={user.role === 'teacher' ? 'teacher' : 'student'}
      setActiveTab={() => {}}
      role={user.role}
      setRole={handleLogout}
    >
      {user.role === 'teacher' && <TeacherDashboard user={user} />}
      {user.role === 'student' && <StudentViva user={user} />}
    </Layout>
  );
}
