import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Classroom, Enrollment, ClassMessage } from '../types';

// ── Classrooms ────────────────────────────────────────────────────────────────

export async function createClassroom(
  name: string,
  subject: string,
  teacherId: string,
  teacherName: string
) {
  const newRef = doc(collection(db, 'classrooms'));
  const classroom: Classroom = {
    id: newRef.id,
    name,
    subject,
    teacherId,
    teacherName,
    createdAt: Date.now(),
  };

  await setDoc(newRef, classroom);
  return classroom;
}

export async function getTeacherClassrooms(teacherId: string) {
  const q = query(collection(db, 'classrooms'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Classroom).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteClassroom(classroomId: string) {
  await deleteDoc(doc(db, 'classrooms', classroomId));

  // Also delete associated enrollments and messages
  const enrollmentsQuery = query(collection(db, 'enrollments'), where('classroomId', '==', classroomId));
  const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
  const deleteEnrollments = enrollmentsSnapshot.docs.map(d => deleteDoc(d.ref));
  
  const messagesQuery = query(collection(db, 'messages'), where('classroomId', '==', classroomId));
  const messagesSnapshot = await getDocs(messagesQuery);
  const deleteMessages = messagesSnapshot.docs.map(d => deleteDoc(d.ref));

  await Promise.all([...deleteEnrollments, ...deleteMessages]);
  return { success: true };
}

// ── Students ──────────────────────────────────────────────────────────────────

export async function addStudentToClassroom(classroomId: string, studentEmail: string) {
  // Find student by email
  const userQ = query(collection(db, 'users'), where('email', '==', studentEmail), where('role', '==', 'student'));
  const userSnapshot = await getDocs(userQ);
  
  if (userSnapshot.empty) {
    throw new Error('Student not found with this email. Make sure they have signed up.');
  }

  const student = userSnapshot.docs[0].data();
  
  // Check if already enrolled
  const enrollQ = query(
    collection(db, 'enrollments'), 
    where('classroomId', '==', classroomId), 
    where('studentId', '==', student.id)
  );
  const enrollSnapshot = await getDocs(enrollQ);
  
  if (!enrollSnapshot.empty) {
    throw new Error('Student is already enrolled in this classroom.');
  }

  // Determine what name to use (the backend API schema didn't have user table linked directly, 
  // but now we have it so we can easily get the actual name)
  const newRef = doc(collection(db, 'enrollments'));
  const enrollment: Enrollment = {
    id: newRef.id,
    classroomId,
    studentId: student.id,
    studentName: student.name,
    studentEmail: student.email,
    joinedAt: Date.now(),
  };

  await setDoc(newRef, enrollment);
  return enrollment;
}

export async function getClassroomStudents(classroomId: string) {
  const q = query(collection(db, 'enrollments'), where('classroomId', '==', classroomId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Enrollment);
}

export async function removeStudentFromClassroom(classroomId: string, studentId: string) {
  const q = query(
    collection(db, 'enrollments'), 
    where('classroomId', '==', classroomId),
    where('studentId', '==', studentId)
  );
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    await deleteDoc(snapshot.docs[0].ref);
  }
  
  return { success: true };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function postMessage(classroomId: string, text: string, examCode?: string) {
  const newRef = doc(collection(db, 'messages'));
  const message: ClassMessage = {
    id: newRef.id,
    classroomId,
    text,
    examCode,
    createdAt: Date.now(),
  };

  await setDoc(newRef, message);
  return message;
}

export async function getMessages(classroomId: string) {
  const q = query(collection(db, 'messages'), where('classroomId', '==', classroomId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => doc.data() as ClassMessage)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ── Student: enrolled classrooms ──────────────────────────────────────────────

export async function getStudentClassrooms(studentId: string) {
  // First, find all enrollments for this student
  const q = query(collection(db, 'enrollments'), where('studentId', '==', studentId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return [];
  
  const classroomIds = snapshot.docs.map(doc => doc.data().classroomId as string);
  
  // Now fetch the classroom details for those IDs
  // Note: in-queries in Firestore are limited to 10 items.
  // We'll fetch all classrooms client-side for simplicity in this prototype.
  const classroomsSnapshot = await getDocs(collection(db, 'classrooms'));
  
  const enrolledClassrooms = classroomsSnapshot.docs
    .map(doc => doc.data() as Classroom)
    .filter(classroom => classroomIds.includes(classroom.id))
    .sort((a, b) => b.createdAt - a.createdAt);
    
  return enrolledClassrooms;
}
