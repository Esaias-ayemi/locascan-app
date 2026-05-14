/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { 
  QrCode, 
  MapPin, 
  User, 
  LogOut, 
  LayoutDashboard, 
  BookOpen, 
  CheckCircle, 
  AlertCircle,
  Plus,
  RefreshCw,
  BarChart3,
  ChevronRight,
  Scan,
  Clock,
  Calendar,
  XCircle,
  Home,
  Settings,
  Mail,
  Lock,
  Shield,
  X,
  ArrowLeft,
  ArrowRight,
  Zap,
  Globe,
  ShieldCheck,
  Building2,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { cn } from './lib/utils';
import { 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  confirmPasswordReset,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit,
  deleteDoc,
  onSnapshot,
  increment,
  writeBatch,
  Timestamp
} from './lib/db-compat';
import { isSupabaseConfigured } from './lib/supabase';

// --- Types ---
interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'lecturer';
  onboarding_completed: boolean;
  level?: string;
  department?: string;
  matric_number?: string;
  staff_id?: string;
  phone_number?: string;
}

interface Course {
  id: string;
  course_code: string;
  course_title: string;
}

interface Session {
  id: string;
  course_id: string;
  lecturer_id: string;
  qr_token: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  expires_at: string;
  is_active: boolean;
}

// --- API Config removed, using Firebase directly ---

// --- Utilities ---

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'navy',
  size?: 'sm' | 'md' | 'lg'
}>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-black text-white hover:bg-zinc-800',
      secondary: 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200',
      outline: 'border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-50',
      ghost: 'bg-transparent hover:bg-zinc-100 text-zinc-600 dark:text-zinc-300',
      danger: 'bg-red-500 text-white hover:bg-red-600',
      navy: 'bg-navy-900 text-white hover:bg-navy-800',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm', className)}>
    {children}
  </div>
);

// --- Onboarding ---

const Onboarding = ({ user, onComplete }: { user: User; onComplete: (u: User) => void }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone_number: user.phone_number || '',
    level: user.level || '',
    department: user.department || '',
    matric_number: user.matric_number || '',
    staff_id: user.staff_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { 
        ...formData, 
        onboarding_completed: true 
      });
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const updatedUser = { id: userSnap.id, ...userSnap.data() } as User;
        onComplete(updatedUser);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="space-y-8">
            <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-3 rounded-2xl w-fit">
              <User className="h-8 w-8" />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-none">
                Complete your <br />
                <span className="text-zinc-400 dark:text-zinc-500 italic">profile.</span>
              </h1>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm">
                We need a few more details to personalize your {user.role} experience.
              </p>
            </div>
            
            <div className="hidden md:block space-y-6 pt-8">
              <div className="flex items-center gap-4 text-zinc-400 dark:text-zinc-500">
                <div className="w-10 h-10 rounded-full border border-zinc-100 dark:border-zinc-800 flex items-center justify-center font-bold text-sm">1</div>
                <span className="font-medium">Account Created</span>
              </div>
              <div className="flex items-center gap-4 text-navy-900 dark:text-white dark:text-navy-100">
                <div className="w-10 h-10 rounded-full bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 flex items-center justify-center font-bold text-sm">2</div>
                <span className="font-medium">Profile Details</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-400 dark:text-zinc-500">
                <div className="w-10 h-10 rounded-full border border-zinc-100 dark:border-zinc-800 flex items-center justify-center font-bold text-sm">3</div>
                <span className="font-medium">Ready to Go</span>
              </div>
            </div>
          </div>

          <Card className="p-10 border-zinc-100 dark:border-zinc-800 shadow-2xl shadow-navy-900/5 rounded-[2.5rem]">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Data Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <Mail className="h-4 w-4 text-navy-900 dark:text-white dark:text-navy-100" />
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase tracking-wider">Personal Data</h3>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Full Name</label>
                  <Input 
                    className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    required 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Email (Read-only)</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 dark:bg-zinc-800 border-transparent cursor-not-allowed opacity-70"
                      value={user.email} 
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Phone Number</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      placeholder="08012345678"
                      value={formData.phone_number} 
                      onChange={e => setFormData({ ...formData, phone_number: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
              </div>

              {/* Student/Lecturer Details Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <BookOpen className="h-4 w-4 text-navy-900 dark:text-white dark:text-navy-100" />
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase tracking-wider">
                    {user.role === 'student' ? 'Student Details' : 'Staff Details'}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Department</label>
                    <select 
                      className="flex h-14 w-full rounded-2xl border-transparent bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus:bg-white focus:border-navy-900 transition-all"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      required
                    >
                      <option value="">Select</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                    </select>
                  </div>
                  {user.role === 'student' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Level</label>
                      <select 
                        className="flex h-14 w-full rounded-2xl border-transparent bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus:bg-white focus:border-navy-900 transition-all"
                        value={formData.level}
                        onChange={e => setFormData({ ...formData, level: e.target.value })}
                        required
                      >
                        <option value="">Select</option>
                        <option value="100">100 Level</option>
                        <option value="200">200 Level</option>
                        <option value="300">300 Level</option>
                        <option value="400">400 Level</option>
                        <option value="500">500 Level</option>
                      </select>
                    </div>
                  )}
                </div>

                {user.role === 'student' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Matric Number</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      value={formData.matric_number} 
                      onChange={e => setFormData({ ...formData, matric_number: e.target.value })} 
                      required 
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button className="w-full h-14 rounded-2xl text-lg bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 hover:bg-navy-800 shadow-xl shadow-navy-900/20" disabled={loading}>
                {loading ? 'Saving...' : 'Complete Registration'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-navy-900 dark:text-white dark:text-navy-100 font-sans selection:bg-navy-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tight">
            <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-1.5 rounded-xl">
              <CheckCircle className="h-6 w-6" />
            </div>
            LocaScan
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <a href="#features" className="hover:text-navy-900 transition-colors">Features</a>
            <a href="#about" className="hover:text-navy-900 transition-colors">About</a>
            <a href="#how-it-works" className="hover:text-navy-900 transition-colors">How it Works</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>Login</Button>
            <Button variant="navy" onClick={() => navigate('/login')}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
        </div>
        <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
              Secure. Bi-Modal.<br />
              <span className="text-zinc-400 dark:text-zinc-500 italic">Seamless.</span>
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              A dynamic QR and GPS-based attendance tracking system designed for modern educational institutions. Eliminate proxy attendance with precision.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <Button size="lg" variant="navy" className="h-16 px-10 text-lg rounded-2xl shadow-2xl shadow-navy-900/20" onClick={() => navigate('/login')}>
              Start Tracking Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-lg rounded-2xl" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              See Features
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-zinc-50 dark:bg-zinc-900 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: QrCode,
                title: "Dynamic QR Codes",
                description: "Codes rotate every 60 seconds to prevent students from sharing photos of the screen.",
                color: "bg-blue-500"
              },
              {
                icon: MapPin,
                title: "GPS Geofencing",
                description: "Attendance is only marked if the student is physically within the lecturer's defined radius.",
                color: "bg-emerald-500"
              },
              {
                icon: BarChart3,
                title: "Real-time Analytics",
                description: "Instant insights into student engagement and attendance patterns for lecturers.",
                color: "bg-purple-500"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-zinc-950 p-10 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-8 transition-transform group-hover:scale-110", feature.color)}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-5xl font-bold tracking-tight leading-none">
              Why Bi-Modal Attendance?
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Traditional attendance methods are prone to manipulation. Our platform combines visual verification (QR) with spatial verification (GPS) to create a foolproof system.
            </p>
            <div className="space-y-4">
              {[
                "Eliminate proxy attendance completely",
                "Automated reporting and CSV exports",
                "Mobile-first design for students on the go",
                "Secure and encrypted data handling"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-navy-500 to-blue-500 rounded-[3rem] blur-2xl opacity-20 animate-pulse" />
            <div className="relative bg-[#031a2f] rounded-[3rem] p-12 text-white aspect-square flex flex-col justify-center">
              <div className="space-y-6">
                <div className="text-6xl font-bold">99.9%</div>
                <div className="text-xl opacity-80 uppercase tracking-widest font-medium">Accuracy Rate</div>
                <div className="h-1 w-24 bg-white/20" />
                <p className="text-lg opacity-60">
                  Our dual-verification process ensures that every attendance record is authentic and verified by both time and space.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-zinc-100 dark:border-zinc-800 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tight">
            <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-1.5 rounded-xl">
              <CheckCircle className="h-6 w-6" />
            </div>
            LocaScan
          </div>
          <div className="flex gap-10 text-sm font-medium text-zinc-400 dark:text-zinc-500">
            <a href="#" className="hover:text-navy-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-navy-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-navy-900 transition-colors">Contact Us</a>
          </div>
          <div className="text-zinc-400 dark:text-zinc-500 text-sm">
            © 2026 LocaScan Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
const Login = ({ setUser }: { setUser: (u: User) => void }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isResetPassword) {
        await confirmPasswordReset(auth, resetToken, newPassword);
        setSuccess('Password reset successful! Please login.');
        setIsResetPassword(false);
        setIsForgotPassword(false);
      } else if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccess('If an account exists, a reset email has been sent.');
      } else if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        try {
          // Create user profile in Firestore
          await setDoc(doc(db, 'users', userCred.user.uid), {
            id: userCred.user.uid,
            name,
            email,
            role,
            onboarding_completed: false,
            created_at: serverTimestamp()
          });
          setIsRegister(false);
          setSuccess('Registration successful! Please login.');
        } catch (dbErr: any) {
          console.error("Firestore creation error:", dbErr);
          await signOut(auth);
          setError(`Account created, but profile setup failed: ${dbErr.message || 'Permission denied'}`);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // User state will be handled by onAuthStateChanged in App
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = err.message || 'Something went wrong';
      if (err.code === 'auth/email-already-in-use') message = 'Email already in use';
      if (err.code === 'auth/invalid-credential') message = 'Invalid email or password';
      if (err.code === 'auth/weak-password') message = 'Password should be at least 6 characters';
      if (err.code === 'auth/network-request-failed') message = 'Network error. Please check your connection.';
      if (err.code === 'auth/operation-not-allowed') message = 'Email/password login is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 font-bold text-3xl tracking-tight mb-4">
              <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-2 rounded-2xl">
                <CheckCircle className="h-7 w-7" />
              </div>
              LocaScan
            </div>
            <p className="text-zinc-400 dark:text-zinc-500 font-medium">
              {isResetPassword ? 'Enter your new password' : 
               isForgotPassword ? 'Reset your account password' :
               isRegister ? 'Create your account to get started' : 
               'Welcome back, please login to your account'}
            </p>
          </div>

          <Card className="p-10 border-zinc-100 dark:border-zinc-800 shadow-2xl shadow-navy-900/5 rounded-[2.5rem]">
            <form onSubmit={handleSubmit} className="space-y-6">
              {isResetPassword ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Reset Token</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      value={resetToken} 
                      onChange={(e) => setResetToken(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">New Password</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      type="password" 
                      placeholder="••••••••"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      required 
                    />
                  </div>
                </>
              ) : isForgotPassword ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Email Address</label>
                  <Input 
                    className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                    type="email" 
                    placeholder="name@university.edu"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                  />
                </div>
              ) : (
                <>
                  {isRegister && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Full Name</label>
                      <Input 
                        className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                        placeholder="John Doe"
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Email Address</label>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      type="email" 
                      placeholder="name@university.edu"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Password</label>
                      {!isRegister && (
                        <button 
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-[10px] font-bold text-navy-600 hover:text-navy-900 uppercase tracking-widest"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <Input 
                      className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-transparent focus:bg-white focus:border-navy-900 transition-all"
                      type="password" 
                      placeholder="••••••••"
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  {isRegister && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">I am a...</label>
                      <select 
                        className="flex h-14 w-full rounded-2xl border-transparent bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus:bg-white focus:border-navy-900 transition-all"
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                      >
                        <option value="student">Student</option>
                        <option value="lecturer">Lecturer</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              
              {error && (
                <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>
              )}
              
              <Button className="w-full h-14 rounded-2xl text-lg bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 hover:bg-navy-800 shadow-xl shadow-navy-900/20" disabled={loading}>
                {loading ? 'Processing...' : 
                 isResetPassword ? 'Reset Password' :
                 isForgotPassword ? 'Send Reset Link' : 
                 isRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <button 
                onClick={() => {
                  setIsRegister(!isRegister);
                  setIsForgotPassword(false);
                  setIsResetPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-sm font-bold text-zinc-400 dark:text-zinc-500 hover:text-navy-900 transition-colors uppercase tracking-widest"
              >
                {isRegister ? 'Already have an account? Login' : 
                 isForgotPassword ? 'Back to Login' :
                 "Don't have an account? Sign Up"}
              </button>
              {isForgotPassword && (
                <div>
                  <button 
                    onClick={() => {
                      setIsForgotPassword(false);
                      setIsResetPassword(false);
                      setSuccess('');
                      setError('');
                    }}
                    className="text-xs font-bold text-zinc-300 hover:text-zinc-500 uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </Card>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => navigate('/')}
              className="text-xs font-bold text-zinc-300 hover:text-zinc-500 uppercase tracking-widest transition-colors"
            >
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};


const PrivacySecurityPanel = ({ onBack }: { onBack: () => void }) => {
  const [dataSharing, setDataSharing] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Privacy & Security</h2>
      </div>

      <Card className="p-6 border-zinc-100 dark:border-zinc-800 space-y-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-navy-900 dark:text-white dark:text-navy-100">Data Sharing</h4>
              <p className="text-sm text-zinc-500">Allow anonymized analytics to improve the app</p>
            </div>
            <button 
              onClick={() => setDataSharing(!dataSharing)}
              className={cn("w-11 h-6 rounded-full transition-colors flex items-center px-1 focus:outline-none", dataSharing ? "bg-navy-900 dark:bg-navy-100" : "bg-zinc-200 dark:bg-zinc-700")}
            >
              <motion.div 
                animate={{ x: dataSharing ? 20 : 0 }} 
                className="w-4 h-4 rounded-full bg-white dark:bg-navy-900 shadow-sm"
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-navy-900 dark:text-white dark:text-navy-100">Location Services</h4>
              <p className="text-sm text-zinc-500">Use precise location for tracking attendance</p>
            </div>
            <button 
              onClick={() => setLocationServices(!locationServices)}
              className={cn("w-11 h-6 rounded-full transition-colors flex items-center px-1 focus:outline-none", locationServices ? "bg-navy-900 dark:bg-navy-100" : "bg-zinc-200 dark:bg-zinc-700")}
            >
              <motion.div 
                animate={{ x: locationServices ? 20 : 0 }} 
                className="w-4 h-4 rounded-full bg-white dark:bg-navy-900 shadow-sm"
              />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <h4 className="font-medium text-navy-900 dark:text-white dark:text-navy-100">Two-Factor Authentication</h4>
              <p className="text-sm text-zinc-500">Add an extra layer of security to your account</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => alert("Setting up 2FA requires additional verification.")}>
              Enable 2FA
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <h4 className="font-medium text-navy-900 dark:text-white dark:text-navy-100">Account Data</h4>
              <p className="text-sm text-zinc-500">Permanently delete your account and all associated data</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => { if(window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) alert('Account deletion requested.'); }}>
              Delete Account
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// --- Lecturer Dashboard ---

const LecturerDashboard = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'analytics' | 'attendance' | 'settings'>(
    () => (localStorage.getItem('lecturerActiveTab') as any) || 'home'
  );

  useEffect(() => {
    localStorage.setItem('lecturerActiveTab', activeTab);
  }, [activeTab]);
  const [isPrivacySettings, setIsPrivacySettings] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ code: '', title: '', level: '', department: '', required_attendance: '70', expected_classes: '10' });
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [selectedCourseSessions, setSelectedCourseSessions] = useState<any[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<any[]>([]);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [customCoords, setCustomCoords] = useState({ lat: '', lng: '', radius: '50' });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [managingCourse, setManagingCourse] = useState<any | null>(null);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    fetchCourses();
    fetchCourseStats();
  }, []);

  useEffect(() => {
    if (selectedCourse && activeTab === 'attendance') {
      fetchActiveSession(selectedCourse.id);
    }
  }, [selectedCourse, activeTab]);

  useEffect(() => {
    if (activeSession && activeSession.is_active) {
      timerRef.current = setInterval(() => {
        rotateQR();
      }, 55000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeSession]);

  const fetchCourses = async () => {
    try {
      const q = query(collection(db, 'courses'), where('lecturer_id', '==', user.id));
      const querySnapshot = await getDocs(q);
      const coursesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(coursesData);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'courses');
    }
  };

  const fetchCourseStats = async () => {
    try {
      // In a real app, this would be optimized. Here we'll fetch basic data.
      const coursesQ = query(collection(db, 'courses'), where('lecturer_id', '==', user.id));
      const coursesSnap = await getDocs(coursesQ);
      const stats = await Promise.all(coursesSnap.docs.map(async (courseDoc) => {
        const courseData = courseDoc.data();
        
        // Count sessions
        const sessionsQ = query(collection(db, 'sessions'), where('course_id', '==', courseDoc.id));
        const sessionsSnap = await getDocs(sessionsQ);
        
        // Count registrations
        const registrationsQ = query(collection(db, 'course_registrations'), where('course_id', '==', courseDoc.id));
        const registrationsSnap = await getDocs(registrationsQ);
        
        return {
          id: courseDoc.id,
          course_code: courseData.course_code,
          course_title: courseData.course_title,
          total_sessions: sessionsSnap.size,
          total_students: registrationsSnap.size,
          students_attended_at_least_once: 0 // Simplification for now
        };
      }));
      setCourseStats(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchActiveSession = async (courseId: string) => {
    const q = query(
      collection(db, 'sessions'), 
      where('course_id', '==', courseId), 
      where('is_active', '==', true),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      setActiveSession({ id: snap.docs[0].id, ...snap.docs[0].data() } as Session);
    } else {
      setActiveSession(null);
    }
  };

  const fetchCourseSessions = async (courseId: string) => {
    const q = query(collection(db, 'sessions'), where('course_id', '==', courseId), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    const sessions = await Promise.all(snap.docs.map(async (sDoc) => {
      const attendanceQ = query(collection(db, 'attendance'), where('session_id', '==', sDoc.id));
      const attendanceSnap = await getDocs(attendanceQ);
      return { id: sDoc.id, ...sDoc.data(), attendance_count: attendanceSnap.size };
    }));
    setSelectedCourseSessions(sessions);
  };

  const fetchSessionAttendance = async (sessionId: string) => {
    const q = query(collection(db, 'attendance'), where('session_id', '==', sessionId));
    const snap = await getDocs(q);
    const attendance = await Promise.all(snap.docs.map(async (aDoc) => {
      const aData = aDoc.data();
      const uSnap = await getDoc(doc(db, 'users', aData.student_id));
      const uData = uSnap.data();
      return { 
        name: uData?.name || 'Unknown', 
        matric_number: uData?.matric_number || 'N/A', 
        signed_in_at: aData.marked_at?.toDate?.()?.toISOString() || aData.marked_at 
      };
    }));
    setSessionAttendance(attendance);
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        course_code: newCourse.code,
        course_title: newCourse.title,
        lecturer_id: user.id,
        level: newCourse.level,
        department: newCourse.department,
        required_attendance: parseInt(newCourse.required_attendance),
        expected_classes: parseInt(newCourse.expected_classes),
        created_at: serverTimestamp()
      });
      setNewCourse({ code: '', title: '', level: '', department: '', required_attendance: '70', expected_classes: '10' });
      setShowAddCourse(false);
      fetchCourses();
      fetchCourseStats();
      setStatus({ type: 'success', message: 'Course created successfully' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'courses');
    } finally {
      setLoading(false);
    }
  };

  const updateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        course_code: editingCourse.course_code,
        course_title: editingCourse.course_title,
        level: editingCourse.level,
        department: editingCourse.department,
        required_attendance: parseInt(editingCourse.required_attendance),
        expected_classes: parseInt(editingCourse.expected_classes),
      });
      setManagingCourse({ ...editingCourse });
      setEditingCourse(null);
      fetchCourses();
      fetchCourseStats();
      setStatus({ type: 'success', message: 'Course updated successfully' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'courses');
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course? This will not delete historical attendance but will prevent future sessions.')) return;
    setLoading(true);
    try {
      // Deactivate all active sessions for safety
      const activeQ = query(collection(db, 'sessions'), where('course_id', '==', courseId), where('is_active', '==', true));
      const activeSnap = await getDocs(activeQ);
      const batch = writeBatch(db);
      activeSnap.docs.forEach(d => batch.update(d.ref, { is_active: false }));
      await batch.commit();

      await deleteDoc(doc(db, 'courses', courseId));
      setManagingCourse(null);
      setEditingCourse(null);
      fetchCourses();
      fetchCourseStats();
      setStatus({ type: 'success', message: 'Course deleted' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'courses');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    const radius = parseInt(customCoords.radius) || 50;

    const start = async (lat: number, lng: number) => {
      try {
        const qr_token = crypto.randomUUID();
        const expires_at = new Date(Date.now() + 60 * 1000).toISOString();
        
        // Deactivate other sessions for this course
        const activeQ = query(collection(db, 'sessions'), where('course_id', '==', selectedCourse.id), where('is_active', '==', true));
        const activeSnap = await getDocs(activeQ);
        const batch = writeBatch(db);
        activeSnap.docs.forEach(doc => batch.update(doc.ref, { is_active: false }));
        await batch.commit();

        const docRef = await addDoc(collection(db, 'sessions'), {
          course_id: selectedCourse.id,
          lecturer_id: user.id,
          qr_token,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
          expires_at,
          is_active: true,
          created_at: serverTimestamp()
        });

        setActiveSession({
          id: docRef.id,
          course_id: selectedCourse.id,
          lecturer_id: user.id,
          qr_token,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
          expires_at,
          is_active: true
        });
        setStatus({ type: 'success', message: 'Attendance session started' });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'sessions');
      } finally {
        setLoading(false);
      }
    };

    if (manualLocation && customCoords.lat && customCoords.lng) {
      await start(parseFloat(customCoords.lat), parseFloat(customCoords.lng));
    } else {
      setStatus({ type: 'info', message: 'Requesting geolocation...' });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          start(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          let msg = 'Geolocation failed. Please enable location or use manual coordinates.';
          if (err.code === 1) msg = 'Location permission denied. Please enable it in your browser settings.';
          setStatus({ type: 'error', message: msg });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const rotateQR = async () => {
    if (!activeSession) return;
    try {
      const qr_token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 60 * 1000).toISOString();
      await updateDoc(doc(db, 'sessions', activeSession.id), { qr_token, expires_at });
      setActiveSession(prev => prev ? { ...prev, qr_token, expires_at } : null);
    } catch (err) {
      console.error("Rotate error:", err);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await updateDoc(doc(db, 'sessions', activeSession.id), { is_active: false });
      setActiveSession(null);
      setStatus({ type: 'info', message: 'Session ended' });
      fetchCourseStats();
    } catch (err) {
      console.error("End session error:", err);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Lecturer Portal</h2>
                <p className="text-navy-100 opacity-80">{user.department} • Email: {user.email}</p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <div className="text-2xl font-bold">{courses.length}</div>
                    <div className="text-xs uppercase tracking-wider opacity-60">My Courses</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <div className="text-2xl font-bold">
                      {courseStats.reduce((acc, curr) => acc + curr.total_sessions, 0)}
                    </div>
                    <div className="text-xs uppercase tracking-wider opacity-60">Total Sessions</div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white dark:text-navy-100">My Courses</h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddCourse(true)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              {showAddCourse && (
                <Card className="p-6 border-navy-900/10 bg-navy-50/30">
                  <form onSubmit={addCourse} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="Code (e.g. CS101)" value={newCourse.code} onChange={e => setNewCourse({...newCourse, code: e.target.value})} required />
                      <Input placeholder="Title" value={newCourse.title} onChange={e => setNewCourse({...newCourse, title: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <select 
                        className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none"
                        value={newCourse.department}
                        onChange={e => setNewCourse({...newCourse, department: e.target.value})}
                        required
                      >
                        <option value="">Department</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Physics">Physics</option>
                      </select>
                      <select 
                        className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none"
                        value={newCourse.level}
                        onChange={e => setNewCourse({...newCourse, level: e.target.value})}
                        required
                      >
                        <option value="">Level</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                        <option value="300">300</option>
                        <option value="400">400</option>
                        <option value="500">500</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Min. Attendance (%)</label>
                        <Input type="number" placeholder="70" value={newCourse.required_attendance} onChange={e => setNewCourse({...newCourse, required_attendance: e.target.value})} required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Expected Classes</label>
                        <Input type="number" placeholder="10" value={newCourse.expected_classes} onChange={e => setNewCourse({...newCourse, expected_classes: e.target.value})} required />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1 bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900" disabled={loading}>Create Course</Button>
                      <Button type="button" variant="ghost" onClick={() => setShowAddCourse(false)}>Cancel</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid gap-3">
                {courses.map(course => (
                  <Card key={course.id} className="p-4 border-zinc-100 dark:border-zinc-800 flex flex-col gap-4 transition-all">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => {
                        if (managingCourse?.id === course.id) {
                          setManagingCourse(null);
                          setEditingCourse(null);
                        } else {
                          setManagingCourse(course);
                          setEditingCourse(null);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-navy-50 dark:bg-navy-900/30 rounded-xl flex items-center justify-center text-navy-900 dark:text-white dark:text-navy-100 font-bold">
                          {course.course_code.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.course_code}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{course.course_title}</div>
                        </div>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-zinc-300 transition-transform", managingCourse?.id === course.id && "rotate-90")} />
                    </div>

                    {managingCourse?.id === course.id && !editingCourse && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setEditingCourse({ ...course })}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => deleteCourse(course.id)}
                        >
                          Delete
                        </Button>
                      </motion.div>
                    )}

                    {editingCourse?.id === course.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <form onSubmit={updateCourse} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="Code" value={editingCourse.course_code} onChange={e => setEditingCourse({...editingCourse, course_code: e.target.value})} required />
                            <Input placeholder="Title" value={editingCourse.course_title} onChange={e => setEditingCourse({...editingCourse, course_title: e.target.value})} required />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <select 
                              className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none"
                              value={editingCourse.department}
                              onChange={e => setEditingCourse({...editingCourse, department: e.target.value})}
                              required
                            >
                              <option value="Computer Science">Computer Science</option>
                              <option value="Engineering">Engineering</option>
                              <option value="Mathematics">Mathematics</option>
                              <option value="Physics">Physics</option>
                            </select>
                            <select 
                              className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none"
                              value={editingCourse.level}
                              onChange={e => setEditingCourse({...editingCourse, level: e.target.value})}
                              required
                            >
                              <option value="100">100</option>
                              <option value="200">200</option>
                              <option value="300">300</option>
                              <option value="400">400</option>
                              <option value="500">500</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Min. Attendance (%)</label>
                              <Input type="number" value={editingCourse.required_attendance} onChange={e => setEditingCourse({...editingCourse, required_attendance: e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Expected Classes</label>
                              <Input type="number" value={editingCourse.expected_classes} onChange={e => setEditingCourse({...editingCourse, expected_classes: e.target.value})} required />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" className="flex-1 bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900" disabled={loading}>Save</Button>
                            <Button type="button" variant="ghost" onClick={() => setEditingCourse(null)}>Cancel</Button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </motion.div>
        );

      case 'analytics':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Attendance Analytics</h2>
            <div className="grid gap-4">
              {courseStats.map(course => (
                <Card key={course.id} className="p-5 space-y-6 border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-navy-900 dark:text-white dark:text-navy-100 text-lg">{course.course_code}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{course.course_title}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Students</div>
                      <div className="text-lg font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.total_students}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50 dark:border-zinc-900">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Total Sessions</div>
                      <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.total_sessions}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Active Attendance</div>
                      <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.students_attended_at_least_once}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        setSelectedCourse(course);
                        fetchCourseSessions(course.id);
                        setShowStudentsModal(true);
                        setSelectedSession(null);
                        setSessionAttendance([]); // Clear session attendance
                      }}
                    >
                      Sessions
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-xl"
                      onClick={async () => {
                        setSelectedCourse(course);
                        setLoading(true);
                        try {
                          // Fetch student list for course
                          const regQ = query(collection(db, 'course_registrations'), where('course_id', '==', course.id));
                          const regSnap = await getDocs(regQ);
                          
                          // Fetch sessions held for this course
                          const sessQ = query(collection(db, 'sessions'), where('course_id', '==', course.id));
                          const sessSnap = await getDocs(sessQ);
                          const totalExpected = course.expected_classes || 10;
                          const totalHeld = sessSnap.size;

                          const students = await Promise.all(regSnap.docs.map(async (regDoc) => {
                            const regData = regDoc.data();
                            const uSnap = await getDoc(doc(db, 'users', regData.student_id));
                            const uData = uSnap.data();
                            
                            // Count student's attendance for this course
                            const attQ = query(
                              collection(db, 'attendance'), 
                              where('student_id', '==', regData.student_id)
                            );
                            const attSnap = await getDocs(attQ);
                            // Filter locally for this course's sessions
                            const sessionIds = sessSnap.docs.map(d => d.id);
                            const attendedCount = attSnap.docs.filter(d => sessionIds.includes(d.data().session_id)).length;
                            
                            return {
                              name: uData?.name || 'Unknown',
                              matric_number: uData?.matric_number || 'N/A',
                              attended: attendedCount,
                              percentage: totalExpected > 0 ? Math.round((attendedCount / totalExpected) * 100) : 0
                            };
                          }));

                          setSessionAttendance(students);
                          setShowStudentsModal(true);
                          setSelectedSession({ id: 'overall', isOverall: true });
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Students
                    </Button>
                    <Button 
                      variant="navy" 
                      size="sm" 
                      className="flex-1 rounded-xl"
                      onClick={async () => {
                        // Res-use the logic above to fetch data for CSV
                        setLoading(true);
                        try {
                          const regQ = query(collection(db, 'course_registrations'), where('course_id', '==', course.id));
                          const regSnap = await getDocs(regQ);
                          const sessQ = query(collection(db, 'sessions'), where('course_id', '==', course.id));
                          const sessSnap = await getDocs(sessQ);
                          const sessionIds = sessSnap.docs.map(d => d.id);

                          const students = await Promise.all(regSnap.docs.map(async (regDoc) => {
                            const regData = regDoc.data();
                            const uSnap = await getDoc(doc(db, 'users', regData.student_id));
                            const uData = uSnap.data();
                            const attQ = query(collection(db, 'attendance'), where('student_id', '==', regData.student_id));
                            const attSnap = await getDocs(attQ);
                            const attendedCount = attSnap.docs.filter(d => sessionIds.includes(d.data().session_id)).length;
                            
                            return {
                              Name: uData?.name || 'Unknown',
                              Matric: uData?.matric_number || 'N/A',
                              Attended: attendedCount,
                              Total: sessSnap.size,
                              Percentage: sessSnap.size > 0 ? `${Math.round((attendedCount / sessSnap.size) * 100)}%` : '0%'
                            };
                          }));
                          downloadCSV(students, `${course.course_code}_attendance.csv`);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      CSV
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {showStudentsModal && selectedCourse && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900">
                    <div>
                      <h3 className="text-xl font-bold">
                        {selectedSession?.isOverall ? 'Overall Attendance' : `${selectedCourse.course_code} Sessions`}
                      </h3>
                      <p className="text-xs opacity-70">
                        {selectedSession?.isOverall ? 'Student attendance percentages' : 'Select a session to view attendees'}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => setShowStudentsModal(false)} className="text-white hover:bg-white/10">
                      <X className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!selectedSession ? (
                      <div className="grid gap-3">
                        {selectedCourseSessions.map(session => (
                          <button 
                            key={session.id}
                            onClick={() => {
                              setSelectedSession(session);
                              fetchSessionAttendance(session.id);
                            }}
                            className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-navy-900 transition-all text-left group"
                          >
                            <div>
                              <div className="font-bold text-navy-900 dark:text-white dark:text-navy-100">{new Date(session.created_at).toLocaleDateString()}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(session.created_at).toLocaleTimeString()}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Attendees</div>
                                <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{session.attendance_count}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-navy-900" />
                            </div>
                          </button>
                        ))}
                        {selectedCourseSessions.length === 0 && (
                          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">No sessions recorded for this course.</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)} className="mb-2">
                          <ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back to Sessions
                        </Button>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-navy-900 dark:text-white dark:text-navy-100">
                            {selectedSession.isOverall ? 'Student List' : `Attendees (${sessionAttendance.length})`}
                          </h4>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => downloadCSV(sessionAttendance, `${selectedSession.isOverall ? 'Overall' : 'Session'}_Attendance.csv`)}
                          >
                            Download List
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          {sessionAttendance.map((student, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                              <div className="flex-1">
                                <div className="font-bold text-sm text-navy-900 dark:text-white dark:text-navy-100">{student.name}</div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{student.matric_number}</div>
                              </div>
                              {selectedSession.isOverall ? (
                                <div className="text-right">
                                  <div className={cn(
                                    "text-sm font-bold",
                                    student.percentage < 70 ? "text-red-500" : "text-emerald-500"
                                  )}>
                                    {student.percentage}%
                                  </div>
                                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{student.attended} sessions</div>
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{new Date(student.signed_in_at).toLocaleTimeString()}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        );

      case 'attendance':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Start Attendance</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm px-8">Select a course to generate a dynamic QR code for students to scan.</p>
            </div>

            <Card className="p-8 border-zinc-100 dark:border-zinc-800">
              {courses.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-navy-50 dark:bg-navy-900/30 rounded-full flex items-center justify-center mx-auto">
                    <BookOpen className="h-8 w-8 text-navy-900 dark:text-white dark:text-navy-100 opacity-20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-navy-900 dark:text-white dark:text-navy-100">No Courses Found</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">You need to add courses in the Home tab before you can start attendance.</p>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab('home')}>Go to Home</Button>
                </div>
              ) : activeSession ? (
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-6 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800">
                    <QRCodeSVG value={activeSession.qr_token} size={240} level="H" />
                  </div>
                  <div className="text-center space-y-4 w-full">
                    <div>
                      <h3 className="text-xl font-bold text-navy-900 dark:text-white dark:text-navy-100">{selectedCourse?.course_code}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Session is active and rotating</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                      <Clock className="h-4 w-4" />
                      QR code updates every 60 seconds
                    </div>
                    <Button variant="danger" onClick={endSession} className="w-full h-14 text-lg rounded-2xl mt-4">
                      End Attendance Session
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase tracking-wider">Select Course</label>
                    <div className="grid gap-3">
                      {courses.map(course => (
                        <button
                          key={course.id}
                          onClick={() => setSelectedCourse(course)}
                          className={cn(
                            "w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left",
                            selectedCourse?.id === course.id 
                              ? "border-navy-900 bg-navy-900 text-white shadow-lg" 
                              : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-200"
                          )}
                        >
                          <div>
                            <div className="font-bold">{course.course_code}</div>
                            <div className={cn("text-xs opacity-70", selectedCourse?.id === course.id ? "text-white" : "text-zinc-500 dark:text-zinc-400")}>
                              {course.course_title}
                            </div>
                          </div>
                          {selectedCourse?.id === course.id && <CheckCircle className="h-5 w-5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase">Location Restriction</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">Manual</span>
                        <input 
                          type="checkbox" 
                          checked={manualLocation} 
                          onChange={e => setManualLocation(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-navy-900 dark:text-white dark:text-navy-100 focus:ring-navy-900"
                        />
                      </div>
                    </div>

                    {manualLocation && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Lat" value={customCoords.lat} onChange={e => setCustomCoords({...customCoords, lat: e.target.value})} />
                        <Input placeholder="Lng" value={customCoords.lng} onChange={e => setCustomCoords({...customCoords, lng: e.target.value})} />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                        <span>Radius</span>
                        <span>{customCoords.radius} meters</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="500" 
                        step="10"
                        value={customCoords.radius}
                        onChange={e => setCustomCoords({...customCoords, radius: e.target.value})}
                        className="w-full h-2 bg-zinc-100 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-navy-900"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={startSession} 
                    disabled={loading || !selectedCourse} 
                    className="w-full h-16 text-lg bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 hover:bg-navy-800 rounded-2xl shadow-xl shadow-navy-900/20"
                  >
                    {loading ? <RefreshCw className="h-6 w-6 animate-spin" /> : 'Start Attendance'}
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        );

      case 'settings':
        if (isPrivacySettings) {
          return <PrivacySecurityPanel onBack={() => setIsPrivacySettings(false)} />;
        }

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Settings</h2>
            
            <div className="space-y-3">
              <Card className="p-6 border-zinc-100 dark:border-zinc-800 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 rounded-full flex items-center justify-center text-2xl font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-900 dark:text-white dark:text-navy-100 text-lg">{user.name}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50 dark:border-zinc-900">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Email</div>
                    <div className="text-sm font-medium text-navy-900 dark:text-white dark:text-navy-100 truncate">{user.email}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Department</div>
                    <div className="text-sm font-medium text-navy-900 dark:text-white dark:text-navy-100">{user.department || 'N/A'}</div>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <button 
                  onClick={() => setIsPrivacySettings(true)}
                  className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5" />
                    <span className="font-medium">Privacy & Security</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center justify-between p-4 bg-red-50 rounded-2xl text-red-600 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <LecturerLayout user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </LecturerLayout>
  );
};

// --- Student Portal ---

const StudentPortal = ({ user, onLogout, setUser }: { user: User; onLogout: () => void; setUser: (u: User) => void }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'analytics' | 'attendance' | 'registration' | 'settings'>(
    () => (localStorage.getItem('studentActiveTab') as any) || 'home'
  );

  useEffect(() => {
    localStorage.setItem('studentActiveTab', activeTab);
  }, [activeTab]);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [registeredSemesters, setRegisteredSemesters] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState('2025/2026 First Semester');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPrivacySettings, setIsPrivacySettings] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [user.level, user.department]);

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSemesters(),
        fetchAttendance(),
        fetchAvailableCourses(),
        fetchAttendanceHistory(historyDate)
      ]);
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async () => {
    try {
      const q = query(collection(db, 'semester_registrations'), where('student_id', '==', user.id));
      const snap = await getDocs(q);
      setRegisteredSemesters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Fetch semesters error:", e);
    }
  };

  const fetchAttendance = async () => {
    try {
      const regQ = query(collection(db, 'course_registrations'), where('student_id', '==', user.id));
      const regSnap = await getDocs(regQ);
      const stats = await Promise.all(regSnap.docs.map(async (regDoc) => {
        const regData = regDoc.data();
        const cSnap = await getDoc(doc(db, 'courses', regData.course_id));
        const cData = cSnap.data();
        
        // Sessions held for this course
        const sessQ = query(collection(db, 'sessions'), where('course_id', '==', regData.course_id));
        const sessSnap = await getDocs(sessQ);
        const sessionsHeld = sessSnap.size;
        
        // Student's attendance for this course
        const attQ = query(
          collection(db, 'attendance'), 
          where('student_id', '==', user.id)
        );
        const attSnap = await getDocs(attQ);
        const courseSessIds = sessSnap.docs.map(d => d.id);
        const attended = attSnap.docs.filter(d => courseSessIds.includes(d.data().session_id)).length;
        
        return {
          id: regData.course_id,
          course_code: cData?.course_code || 'N/A',
          course_title: cData?.course_title || 'N/A',
          attended_sessions: attended,
          total_sessions_held: sessionsHeld,
          expected_classes: cData?.expected_classes || 10,
          attended: attended // for backward compatibility in the calculation
        };
      }));
      setAttendanceStats(stats);
    } catch (e) {
      console.error("Fetch attendance error:", e);
    }
  };

  const fetchAvailableCourses = async () => {
    try {
      const q = query(
        collection(db, 'courses'), 
        where('department', '==', user.department),
        where('level', '==', user.level)
      );
      const snap = await getDocs(q);
      const allCourses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter out already registered
      const regQ = query(collection(db, 'course_registrations'), where('student_id', '==', user.id));
      const regSnap = await getDocs(regQ);
      const regIds = regSnap.docs.map(d => d.data().course_id);
      
      setAvailableCourses(allCourses.filter(c => !regIds.includes(c.id)));
    } catch (e) {
      console.error("Fetch available courses error:", e);
    }
  };

  const fetchAttendanceHistory = async (date: string) => {
    try {
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);
      
      const q = query(
        collection(db, 'attendance'), 
        where('student_id', '==', user.id),
        where('marked_at', '>=', Timestamp.fromDate(start)),
        where('marked_at', '<=', Timestamp.fromDate(end))
      );
      const snap = await getDocs(q);
      const history = await Promise.all(snap.docs.map(async (aDoc) => {
        const aData = aDoc.data();
        const cSnap = await getDoc(doc(db, 'courses', aData.course_id));
        const cData = cSnap.data();
        return {
          course_code: cData?.course_code || 'N/A',
          course_title: cData?.course_title || 'N/A',
          marked_at: aData.marked_at.toDate().toISOString()
        };
      }));
      setAttendanceHistory(history);
    } catch (e) {
      console.error("Fetch attendance history error:", e);
    }
  };

  const registerCourse = async (courseId: string) => {
    if (!user.onboarding_completed) {
      setStatus({ type: 'error', message: 'Please complete your profile setup in the Settings tab before registering for courses.' });
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'course_registrations'), {
        student_id: user.id,
        course_id: courseId,
        registered_at: serverTimestamp()
      });
      refreshData();
      setStatus({ type: 'success', message: 'Registered successfully' });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to register' });
      try {
        handleFirestoreError(err, OperationType.CREATE, 'course_registrations');
      } catch (e) {
        // Ignored here
      }
    } finally {
      setLoading(false);
    }
  };

  const unregisterCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to unregister from this course?')) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'course_registrations'), 
        where('student_id', '==', user.id),
        where('course_id', '==', courseId)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      refreshData();
      setStatus({ type: 'success', message: 'Unregistered successfully' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'course_registrations');
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    setScanning(true);
    setStatus(null);
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }, 100);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanning();
    setLoading(true);
    setStatus({ type: 'info', message: 'Verifying location...' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Find session by token
          const q = query(
            collection(db, 'sessions'), 
            where('qr_token', '==', decodedText),
            where('is_active', '==', true)
          );
          const snap = await getDocs(q);
          
          if (snap.empty) {
            throw new Error('Invalid or expired QR code');
          }
          
          const sessionDoc = snap.docs[0];
          const sessionData = sessionDoc.data();
          
          // Check expiration
          if (new Date(sessionData.expires_at) < new Date()) {
            throw new Error('Session has expired');
          }

          // Check distance
          const distance = calculateDistance(
            pos.coords.latitude, pos.coords.longitude,
            sessionData.latitude, sessionData.longitude
          );
          
          if (distance > sessionData.radius_meters) {
            throw new Error(`You are too far away (${Math.round(distance)}m). You must be within ${sessionData.radius_meters}m.`);
          }

          // Check if already scanned
          const existingQ = query(
            collection(db, 'attendance'),
            where('session_id', '==', sessionDoc.id),
            where('student_id', '==', user.id)
          );
          const existingSnap = await getDocs(existingQ);
          if (!existingSnap.empty) {
            throw new Error('Attendance already marked for this session');
          }

          // Mark attendance
          await addDoc(collection(db, 'attendance'), {
            student_id: user.id,
            session_id: sessionDoc.id,
            course_id: sessionData.course_id,
            marked_at: serverTimestamp(),
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });

          setStatus({ type: 'success', message: 'Attendance marked successfully!' });
          fetchAttendance();
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message || 'Failed to mark attendance' });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setStatus({ type: 'error', message: 'Geolocation access denied. Please enable GPS.' });
        setLoading(false);
      }
    );
  };

  const onScanFailure = (error: any) => {};

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Dashboard</h2>
              <Button variant="ghost" size="sm" onClick={refreshData} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
            <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Welcome Back!</h2>
                <p className="text-navy-100 opacity-80">{user.department} • {user.level} Level</p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <div className="text-2xl font-bold">{attendanceStats.length}</div>
                    <div className="text-xs uppercase tracking-wider opacity-60">Courses</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <div className="text-2xl font-bold">
                      {attendanceStats.length > 0 
                        ? Math.round(attendanceStats.reduce((acc, curr) => acc + (curr.attended / (curr.total_sessions || 1) * 100), 0) / attendanceStats.length)
                        : 0}%
                    </div>
                    <div className="text-xs uppercase tracking-wider opacity-60">Avg. Attendance</div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-navy-900 dark:text-white dark:text-navy-100">Registered Courses</h3>
              <div className="grid gap-3">
                {attendanceStats.map(course => (
                  <Card key={course.id} className="flex items-center justify-between p-4 border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-navy-50 dark:bg-navy-900/30 rounded-xl flex items-center justify-center text-navy-900 dark:text-white dark:text-navy-100 font-bold">
                        {course.course_code.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.course_code}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{course.course_title}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => unregisterCourse(course.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    </div>
                  </Card>
                ))}
                {attendanceStats.length === 0 && (
                  <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No courses registered yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white dark:text-navy-100">Attendance History</h3>
                <input 
                  type="date" 
                  value={historyDate}
                  onChange={(e) => {
                    setHistoryDate(e.target.value);
                    fetchAttendanceHistory(e.target.value);
                  }}
                  className="text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-navy-900"
                />
              </div>
              <Card className="p-4 border-zinc-100 dark:border-zinc-800">
                {attendanceHistory.length > 0 ? (
                  <div className="space-y-3">
                    {attendanceHistory.map((record, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
                        <div>
                          <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{record.course_code}</div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{record.course_title}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-emerald-600">Present</div>
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{new Date(record.marked_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-10" />
                    <p className="text-xs">No attendance records for this date</p>
                  </div>
                )}
              </Card>
            </div>
          </motion.div>
        );

      case 'analytics':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Attendance Summary</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Check Date:</span>
                <input 
                  type="date" 
                  value={analyticsDate}
                  onChange={(e) => setAnalyticsDate(e.target.value)}
                  className="text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-navy-900"
                />
              </div>
            </div>
            <div className="grid gap-4">
              {attendanceStats.map(course => {
                const totalExpected = course.expected_classes || 10;
                const attended = course.attended_sessions;
                const heldSoFar = course.total_sessions_held;
                const absent = Math.max(0, heldSoFar - attended);
                const overallPercentage = Math.round((attended / totalExpected) * 100);
                const currentPercentage = heldSoFar > 0 ? Math.round((attended / heldSoFar) * 100) : 0;
                const passMark = 70;

                // Check if student was present on the selected date
                const wasPresentOnDate = attendanceHistory.some(h => 
                  h.course_code === course.course_code && 
                  new Date(h.marked_at).toISOString().split('T')[0] === analyticsDate
                );
                
                return (
                  <Card key={course.id} className="p-5 space-y-6 border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-navy-900 dark:text-white dark:text-navy-100 text-lg">{course.course_code}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{course.course_title}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider",
                          overallPercentage >= passMark ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {overallPercentage}% Overall
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                          {currentPercentage}% Current
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-2 text-center">
                        <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{totalExpected}</div>
                        <div className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Expected</div>
                      </div>
                      <div className="bg-navy-50 dark:bg-navy-900/30 rounded-2xl p-2 text-center">
                        <div className="text-sm font-bold text-navy-900 dark:text-white dark:text-navy-100">{heldSoFar}</div>
                        <div className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Held</div>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl p-2 text-center">
                        <div className="text-sm font-bold text-emerald-600">{attended}</div>
                        <div className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Present</div>
                      </div>
                      <div className="bg-red-50 rounded-2xl p-2 text-center">
                        <div className="text-sm font-bold text-red-600">{absent}</div>
                        <div className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Absent</div>
                      </div>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-navy-900 dark:text-white dark:text-navy-100" />
                        <span className="text-xs font-medium text-navy-900 dark:text-white dark:text-navy-100">Status for {analyticsDate}</span>
                      </div>
                      {wasPresentOnDate ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase">Present</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase">No Record</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">
                        <span>Attendance Progress</span>
                        <span>{overallPercentage}% of {totalExpected} classes</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, overallPercentage)}%` }}
                          className={cn("h-full", overallPercentage >= passMark ? "bg-navy-900" : "bg-red-500")}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                        * Target: {passMark}% ({Math.ceil(totalExpected * (passMark/100))} classes)
                      </p>
                    </div>
                  </Card>
                );
              })}
              {attendanceStats.length === 0 && (
                <div className="text-center py-24 text-zinc-400 dark:text-zinc-500">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-10" />
                  <p>Register for courses to see analytics</p>
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'attendance':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Mark Attendance</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm px-8">Scan the QR code displayed by your lecturer to mark your attendance.</p>
            </div>

            <Card className="p-8 border-zinc-100 dark:border-zinc-800">
              {scanning ? (
                <div className="space-y-6">
                  <div id="reader" className="overflow-hidden rounded-2xl border-4 border-navy-900/10" />
                  <Button variant="outline" onClick={stopScanning} className="w-full">Cancel Scanning</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 space-y-8">
                  <div className="w-32 h-32 bg-navy-50 dark:bg-navy-900/30 rounded-full flex items-center justify-center relative">
                    <Scan className="h-12 w-12 text-navy-900 dark:text-white dark:text-navy-100" />
                    <div className="absolute inset-0 border-2 border-navy-900/20 rounded-full animate-ping" />
                  </div>
                  <Button onClick={startScanning} className="w-full max-w-xs bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 hover:bg-navy-800 h-14 text-lg">
                    Start Scanning
                  </Button>
                </div>
              )}

              {status && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "mt-6 p-4 rounded-2xl text-sm font-medium flex items-center gap-3",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700" : 
                    status.type === 'error' ? "bg-red-50 text-red-700" : "bg-navy-50 dark:bg-navy-900/30 text-navy-700"
                  )}
                >
                  {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  {status.message}
                </motion.div>
              )}
            </Card>
          </motion.div>
        );

      case 'registration':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Course Registration</h2>
            </div>

            <div className="space-y-4">
              {!user.onboarding_completed ? (
                <Card className="p-8 border-amber-100 bg-amber-50 text-center space-y-4">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <User className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-amber-900">Profile Incomplete</h3>
                    <p className="text-sm text-amber-700">You must complete your profile (Level and Department) in the Settings tab to see available courses for registration.</p>
                  </div>
                  <Button variant="navy" className="bg-amber-600 hover:bg-amber-700" onClick={() => setActiveTab('settings')}>
                    Go to Settings
                  </Button>
                </Card>
              ) : (
                <>
                  {availableCourses.map(course => (
                    <Card key={course.id} className="p-5 border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-navy-500 uppercase">{course.course_code}</div>
                        <h4 className="font-bold text-navy-900 dark:text-white dark:text-navy-100">{course.course_title}</h4>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{course.department} • {course.level} Level</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="navy"
                        onClick={() => registerCourse(course.id)}
                        disabled={loading}
                      >
                        Register
                      </Button>
                    </Card>
                  ))}
                  {availableCourses.length === 0 && (
                    <div className="text-center py-24 text-zinc-400 dark:text-zinc-500">
                      <Plus className="h-16 w-16 mx-auto mb-4 opacity-10" />
                      <p>No new courses available for registration in your level/department</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        );

      case 'settings':
        if (isEditingProfile) {
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </button>
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Update Profile</h2>
              </div>
              
              <Card className="p-6 border-zinc-100 dark:border-zinc-800">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      name: formData.get('name'),
                      phone_number: formData.get('phone_number'),
                      department: formData.get('department'),
                      level: formData.get('level'),
                      matric_number: formData.get('matric_number'),
                      onboarding_completed: true
                    };
                    try {
                      await updateDoc(doc(db, 'users', user.id), data);
                      const userSnap = await getDoc(doc(db, 'users', user.id));
                      setStatus({ type: 'success', message: 'Profile updated successfully!' });
                      setTimeout(() => {
                        if (userSnap.exists()) {
                          setUser({ id: userSnap.id, ...userSnap.data() } as User);
                        }
                        setIsEditingProfile(false);
                        setStatus(null);
                      }, 2000);
                    } catch (err: any) {
                      handleFirestoreError(err, OperationType.UPDATE, 'users');
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <Mail className="h-4 w-4 text-navy-900 dark:text-white dark:text-navy-100" />
                      <h3 className="text-xs font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase tracking-wider">Personal Data</h3>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Full Name</label>
                      <Input name="name" defaultValue={user.name} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Phone Number</label>
                      <Input name="phone_number" defaultValue={user.phone_number} required />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <BookOpen className="h-4 w-4 text-navy-900 dark:text-white dark:text-navy-100" />
                      <h3 className="text-xs font-bold text-navy-900 dark:text-white dark:text-navy-100 uppercase tracking-wider">Student Details</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Department</label>
                        <select 
                          name="department"
                          className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                          defaultValue={user.department || ""}
                          required
                        >
                          <option value="">Select Department</option>
                          <option value="Computer Science">Computer Science</option>
                          <option value="Engineering">Engineering</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="Physics">Physics</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Level</label>
                        <select 
                          name="level"
                          className="flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                          defaultValue={user.level || ""}
                          required
                        >
                          <option value="">Select Level</option>
                          <option value="100">100 Level</option>
                          <option value="200">200 Level</option>
                          <option value="300">300 Level</option>
                          <option value="400">400 Level</option>
                          <option value="500">500 Level</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Matric Number</label>
                      <Input name="matric_number" defaultValue={user.matric_number} required />
                    </div>
                  </div>

                  {status && (
                    <div className={cn(
                      "p-4 rounded-2xl text-sm font-medium",
                      status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    )}>
                      {status.message}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-14 rounded-2xl bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900" disabled={loading}>
                    {loading ? 'Updating...' : 'Save Changes'}
                  </Button>
                </form>
              </Card>
            </motion.div>
          );
        }

        if (isChangingPassword) {
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsChangingPassword(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </button>
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Change Password</h2>
              </div>
              
              <Card className="p-6 border-zinc-100 dark:border-zinc-800">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setStatus({ type: 'info', message: 'Password change feature coming soon' });
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Current Password</label>
                    <Input type="password" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Password</label>
                    <Input type="password" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm New Password</label>
                    <Input type="password" required />
                  </div>
                  {status && (
                    <div className="p-4 rounded-2xl bg-navy-50 dark:bg-navy-900/30 text-navy-700 text-sm">
                      {status.message}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-14 rounded-2xl bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900">
                    Update Password
                  </Button>
                </form>
              </Card>
            </motion.div>
          );
        }

        if (isPrivacySettings) {
          return <PrivacySecurityPanel onBack={() => setIsPrivacySettings(false)} />;
        }

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            <h2 className="text-2xl font-bold text-navy-900 dark:text-white dark:text-navy-100">Settings</h2>
            
            <Card className="p-6 border-zinc-100 dark:border-zinc-800 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 rounded-full flex items-center justify-center text-2xl font-bold">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-navy-900 dark:text-white dark:text-navy-100 text-lg">{user.name}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50 dark:border-zinc-900">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Matric Number</div>
                  <div className="text-sm font-medium text-navy-900 dark:text-white dark:text-navy-100">{user.matric_number || 'N/A'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Level</div>
                  <div className="text-sm font-medium text-navy-900 dark:text-white dark:text-navy-100">{user.level || 'N/A'}</div>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Update Profile</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5" />
                  <span className="font-medium">Change Password</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setIsPrivacySettings(true)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5" />
                  <span className="font-medium">Privacy & Security</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-between p-4 bg-red-50 rounded-2xl text-red-600 hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Sign Out</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <StudentLayout user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </StudentLayout>
  );
};

// --- Main Layouts ---

const StudentLayout = ({ user, onLogout, children, activeTab, setActiveTab }: { 
  user: User; 
  onLogout: () => void; 
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}) => {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pb-24">
      {/* Header */}
      <header className="px-6 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 font-bold text-2xl text-navy-900 dark:text-white dark:text-navy-100">
          <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-1 rounded-lg">
            <CheckCircle className="h-5 w-5" />
          </div>
          LocaScan
        </div>
        <div className="text-right">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Hello, {user.name}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 pb-8 z-50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {[
            { id: 'home', icon: LayoutDashboard, label: 'Home' },
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'attendance', icon: Scan, label: 'LocaScan' },
            { id: 'registration', icon: BookOpen, label: 'Courses' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                activeTab === tab.id ? "text-navy-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"
              )}
            >
              <tab.icon className={cn("h-6 w-6", activeTab === tab.id && "fill-navy-900/10")} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

const LecturerLayout = ({ user, onLogout, children, activeTab, setActiveTab }: { 
  user: User; 
  onLogout: () => void; 
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}) => {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pb-24">
      {/* Header */}
      <header className="px-6 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 font-bold text-2xl text-navy-900 dark:text-white dark:text-navy-100">
          <div className="bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 p-1 rounded-lg">
            <CheckCircle className="h-5 w-5" />
          </div>
          LocaScan
        </div>
        <div className="text-right">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Hello, {user.name}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 pb-8 z-50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {[
            { id: 'home', icon: LayoutDashboard, label: 'Home' },
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'attendance', icon: Scan, label: 'LocaScan' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                activeTab === tab.id ? "text-navy-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"
              )}
            >
              <tab.icon className={cn("h-6 w-6", activeTab === tab.id && "fill-navy-900/10")} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-950 p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-amber-600 mb-4">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Missing Supabase Config</h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-4">
            Please configure your Supabase environment variables in the variables menu:
          </p>
          <ul className="list-disc pl-5 text-sm font-mono text-zinc-500 dark:text-zinc-400 space-y-2 mb-6 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Once you add them, the application will refresh.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
            setUser({ id: userSnap.id, ...userSnap.data() } as User);
          } else {
            console.warn("Profile doc missing for user. Attempting to recreate it...");
            const placeholderUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.email?.split('@')[0] || 'Unknown User',
              role: 'student',
              onboarding_completed: false,
              created_at: serverTimestamp()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), placeholderUser);
              setUser(placeholderUser as User);
            } catch (e: any) {
              console.error("Failed to create placeholder profile:", e);
              alert("Sign-in issue: Failed to create your user profile. Are you sure you ran SQL queries in Supabase? " + (e.message || ''));
              await signOut(auth);
              setUser(null);
            }
          }
        } catch (e) {
          console.error("Error fetching profile:", e);
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    try {
      await signOut(auth);
      setUser(null);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <RefreshCw className="h-8 w-8 animate-spin text-zinc-300" />
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          !user ? <LandingPage /> : (
            !user.onboarding_completed ? <Navigate to="/onboarding" /> : (
              user.role === 'lecturer' ? (
                <LecturerDashboard user={user} onLogout={handleLogout} />
              ) : (
                <StudentPortal user={user} onLogout={handleLogout} setUser={setUser} />
              )
            )
          )
        } />
        <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
        <Route path="/onboarding" element={
          user ? (
            user.onboarding_completed ? <Navigate to="/" /> : <Onboarding user={user} onComplete={setUser} />
          ) : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
