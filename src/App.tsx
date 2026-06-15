import { useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Upload, 
  Layers, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  X, 
  BookOpen, 
  User as UserIcon, 
  ShieldCheck,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import UploadPDF from './components/UploadPDF';
import ManagePDFs from './components/ManagePDFs';
import UsersManagement from './components/UsersManagement';
import { ViewType } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authenticated State sync plus bootstrapped super admin validation
  useEffect(() => {
    let unsubscribeWhitelist: () => void = () => {};

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setIsWhitelisted(null);
        setLoading(false);
        return;
      }

      const emailKey = currentUser.email ? currentUser.email.toLowerCase().trim() : '';

      try {
        // Boostrap check for superuser
        if (emailKey === 'yoyohoneysinger633@gmail.com' || emailKey === 'yoyohoneysinger@gmail.com') {
          setIsWhitelisted(true);
          setLoading(false);

          // Sync database record silently in an isolated container block
          (async () => {
            try {
              const docRef = doc(db, 'admin_whitelist', emailKey);
              const docSnap = await getDoc(docRef);
              if (!docSnap.exists()) {
                await setDoc(docRef, {
                  email: emailKey,
                  status: 'active',
                  addedAt: serverTimestamp(),
                  addedBy: emailKey
                });
              }
            } catch (syncErr) {
              console.warn('Silent superuser whitelist bootstrap sync skipped/failed (access remains granted):', syncErr);
            }
          })();
          return;
        }

        // Standard whitelist check live stream helper
        unsubscribeWhitelist = onSnapshot(
          doc(db, 'admin_whitelist', emailKey),
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data.status === 'active') {
                setIsWhitelisted(true);
              } else {
                setIsWhitelisted(false);
              }
            } else {
              setIsWhitelisted(false);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Whitelist read error:', err);
            setIsWhitelisted(false);
            setLoading(false);
          }
        );

      } catch (err) {
        console.error('Error during whitelist validation:', err);
        setIsWhitelisted(false);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubscribeWhitelist();
    };
  }, []);

  const handleLogout = () => {
    signOut(auth);
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-slate-950 font-sans overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse">
            <BookOpen className="text-white w-7 h-7" />
          </div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">Initializing StudyHub Security...</p>
          <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-[60%] rounded-full animate-infinite animate-pulse shrink-0" />
          </div>
        </div>
      </div>
    );
  }

  // Not Logged In -> Serve high-quality LoginForm
  if (!user) {
    return <LoginForm />;
  }

  // Logged In but Unauthorized -> Serve Access Block screen
  if (isWhitelisted === false) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-slate-950 font-sans overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[150px]"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl text-center shadow-2xl mx-4"
        >
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-7 h-7" />
          </div>
          
          <h2 className="text-white font-bold text-2xl tracking-tight mb-2">Access Restrained</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            The logged-in email <strong className="text-slate-200">{user.email}</strong> is not listed on the permitted administrator whitelist.
          </p>

          <div className="p-4 bg-slate-900/50 rounded-2xl text-xs text-slate-400 text-left mb-6 space-y-1">
            <p className="font-semibold text-white">Why am I seeing this?</p>
            <p>StudyHub strictly mandates access whitelist verification. Only active colleagues cleared by super-administrators can download, publish, or modify syllabus data pointers.</p>
          </div>

          <button
            id="unauthorized-logout-btn"
            onClick={handleLogout}
            className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Log In</span>
          </button>
        </motion.div>
      </div>
    );
  }

  // Active Admin -> Full Dashboard access with glass styling
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload PDF', icon: Upload },
    { id: 'manage', label: 'Manage PDFs', icon: Layers },
    { id: 'users', label: 'User Whitelist', icon: ShieldCheck },
  ] as const;

  return (
    <div className="relative flex h-screen w-screen bg-slate-950 font-sans overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[130px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[160px]" />

      {/* Responsive Mobile Header */}
      <header className="lg:hidden absolute top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-lg flex items-center justify-center">
            <BookOpen className="text-white w-4 h-4" />
          </div>
          <span className="text-white font-bold text-md tracking-tight">StudyHub</span>
        </div>
        <button
          id="mobile-menu-toggle-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 px-2 border border-white/10 rounded-lg bg-white/5 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar - Desktop Layout */}
      <aside className="hidden lg:flex w-64 h-full bg-white/5 backdrop-blur-2xl border-r border-white/10 flex-col z-20">
        {/* Brand Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-white font-black text-lg tracking-tight">StudyHub</h1>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-8 space-y-1.5">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-white/15 border border-white/10 text-white shadow-lg shadow-white/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            );
          })}
        </nav>

        {/* Logged In Info and Sign Out bottom container */}
        <div className="p-6">
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-slate-300" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-bold text-white truncate my-0" title={user.email || ''}>{user.email}</p>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">
                  {(user.email === 'yoyohoneysinger633@gmail.com' || user.email === 'yoyohoneysinger@gmail.com') ? 'Super Admin' : 'Syllabus Admin'}
                </p>
              </div>
            </div>
            <button
              id="desktop-logout-btn"
              onClick={handleLogout}
              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-rose-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar - Mobile Sliding Layout Menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 h-full bg-slate-900 border-r border-white/10 flex flex-col z-50 lg:hidden"
            >
              <div className="p-6 pb-2 flex items-center justify-between border-b border-white/5 h-16">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-blue-400-tr rounded-lg flex items-center justify-center">
                    <BookOpen className="text-white w-4 h-4" />
                  </div>
                  <span className="text-white font-bold text-md tracking-tight">StudyHub</span>
                </div>
                <button
                  id="close-mobile-menu-btn"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 items-center justify-center bg-white/5 border border-white/10 rounded-lg text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1.5">
                {navItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`mobile-nav-${item.id}`}
                      onClick={() => {
                        setView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-white/15 border border-white/10 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  );
                })}
              </nav>

              <div className="p-6 border-t border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-white truncate my-0">{user.email}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">Admin</p>
                  </div>
                </div>
                <button
                  id="mobile-logout-btn"
                  onClick={handleLogout}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content container with top bar */}
      <main className="flex-1 h-full flex flex-col z-10 pt-16 lg:pt-0 overflow-hidden">
        {/* Dynamic Header */}
        <header className="h-20 px-6 lg:px-10 flex items-center justify-between border-b border-white/5 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-white font-extrabold text-xl lg:text-2xl tracking-tight capitalize">
              {view === 'users' ? 'Admin Whitelist Whitelist' : `${view} Dashboard`}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">StudyHub Administrator Portal</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider leading-none">Security Level</p>
              <p className="text-emerald-400 text-xs font-bold flex items-center justify-end gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Shield</span>
              </p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-slate-300 text-xs font-semibold">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px]">Syllabus V2.1</span>
            </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="p-6 lg:p-10 flex-1 overflow-y-auto">
          {view === 'dashboard' && <Dashboard setView={setView} />}
          {view === 'upload' && <UploadPDF />}
          {view === 'manage' && <ManagePDFs />}
          {view === 'users' && <UsersManagement />}
        </div>
      </main>
    </div>
  );
}
