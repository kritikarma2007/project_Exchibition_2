import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
  roleId: string;
  createdAt: number;
}

const SESSION_KEY = 'viva_ai_session';

// ─── Session helpers ──────────────────────────────────────────────────────────

export function getCurrentUser(): UserData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setCurrentUser(user: UserData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Firebase Auth calls ──────────────────────────────────────────────────────

export async function signUp(
  name: string,
  email: string,
  password: string,
  role: 'teacher' | 'student',
  roleId: string
): Promise<{ user?: UserData; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const userData: UserData = {
      id: cred.user.uid,
      name,
      email,
      role,
      roleId,
      createdAt: Date.now(),
    };

    // Store custom claims/role data in Firestore
    await setDoc(doc(db, 'users', cred.user.uid), userData);

    setCurrentUser(userData);
    return { user: userData };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || 'Signup failed.' };
  }
}

export async function login(
  email: string,
  password: string,
  role: 'teacher' | 'student'
): Promise<{ user?: UserData; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    
    // Fetch user data from Firestore to get their role
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    
    if (!userDoc.exists()) {
      return { error: 'Account data missing. Please sign up again.' };
    }
    
    const userData = userDoc.data() as UserData;
    
    if (userData.role !== role) {
      return { error: `Invalid role. This account is registered as a ${userData.role}.` };
    }

    setCurrentUser(userData);
    return { user: userData };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || 'Invalid credentials or login failed.' };
  }
}
