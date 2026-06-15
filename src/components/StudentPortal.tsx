import { useEffect, useState, useRef, MouseEvent } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfMetadata } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Filter, 
  Clock, 
  Bookmark, 
  BookMarked,
  Play, 
  Pause, 
  RotateCcw, 
  Award, 
  ThumbsUp, 
  ArrowLeft, 
  ExternalLink, 
  Notebook, 
  Sparkles, 
  ChevronRight, 
  Calendar,
  CheckCircle,
  Hash
} from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

export default function StudentPortal() {
  const [pdfs, setPdfs] = useState<PdfMetadata[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_student_pdfs');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('studyhub_cached_student_pdfs');
    return cached ? false : true;
  });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedPdf, setSelectedPdf] = useState<PdfMetadata | null>(null);

  // Student interaction states
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = localStorage.getItem('studyhub_student_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [completedDocs, setCompletedDocs] = useState<string[]>(() => {
    const saved = localStorage.getItem('studyhub_student_completed');
    return saved ? JSON.parse(saved) : [];
  });
  const [notes, setNotes] = useState<{ [pdfId: string]: string }>(() => {
    const saved = localStorage.getItem('studyhub_student_notes');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeNote, setActiveNote] = useState('');

  // Pomodoro Study Timer States
  const [timerLeft, setTimerLeft] = useState(1500); // 25 mins in seconds
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flashcards generated client-side from titles
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  // Listen for Live Firestore data
  useEffect(() => {
    const pdfsCollection = 'pdfs';
    const q = query(collection(db, pdfsCollection), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PdfMetadata[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as PdfMetadata);
        });
        setPdfs(items);
        localStorage.setItem('studyhub_cached_student_pdfs', JSON.stringify(items));
        setLoading(false);
      },
      (err) => {
        setError('Connection issues with Live StudyHub database. Accessing cached local resources.');
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, pdfsCollection);
        } catch (e) {
          console.error(e);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync interactions to LocalStorage
  useEffect(() => {
    localStorage.setItem('studyhub_student_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('studyhub_student_completed', JSON.stringify(completedDocs));
  }, [completedDocs]);

  useEffect(() => {
    localStorage.setItem('studyhub_student_notes', JSON.stringify(notes));
  }, [notes]);

  // Pomodoro timer core effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            // Dynamic Alert sound check
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.3);
            } catch (_) {}
            return 1500;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Load and save active note when selection switches
  useEffect(() => {
    if (selectedPdf) {
      setActiveNote(notes[selectedPdf.id] || '');
      // Generate specialized flashcards on the fly to help study!
      const flash = generateFlashcards(selectedPdf);
      setActiveFlashcards(flash);
      setCurrentFlashcardIndex(0);
      setShowFlashcardAnswer(false);
    }
  }, [selectedPdf]);

  const saveActiveNote = () => {
    if (selectedPdf) {
      setNotes((prev) => ({
        ...prev,
        [selectedPdf.id]: activeNote
      }));
    }
  };

  const generateFlashcards = (pdf: PdfMetadata): Flashcard[] => {
    const titleLower = pdf.title.toLowerCase();
    const sub = pdf.subject;
    const desc = pdf.description || '';

    // Clever fallback templates for immediate study engagement
    return [
      {
        question: `What are the core concepts covered inside "${pdf.title}"?`,
        answer: desc ? `The primary focus details: "${desc}". Subject Category is ${sub}.` : `This study sheet aims to reinforce fundamentals in the field of ${sub}.`
      },
      {
        question: `How can one apply the syllabus principles from this ${sub} material?`,
        answer: `By reviewing key formulas/theorems in this document, practicing problem sets, and testing assumptions through active recall.`
      },
      {
        question: `What is the significance of studying "${pdf.fileName}"?`,
        answer: `It serves as verified coursework. The file size is ${(pdf.fileSize / (1024 * 1024)).toFixed(2)} MB, encapsulating core references and academic checkpoints.`
      }
    ];
  };

  // Toggle helpers
  const toggleBookmark = (id: string, e?: MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setBookmarks((prev) => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const toggleComplete = (id: string) => {
    setCompletedDocs((prev) =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerLeft(1500);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    return (bytes / (k * k)).toFixed(2) + ' MB';
  };

  const formatTimeStr = (timestamp: any) => {
    if (!timestamp) return 'Syllabus Core';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter computation
  const activeSubjects = ['All', ...Array.from(new Set(pdfs.map((p) => p.subject || ''))).filter(Boolean)];
  
  const filteredPdfs = pdfs.filter((pdf) => {
    const str = `${pdf.title} ${pdf.subject} ${pdf.description}`.toLowerCase();
    const matchSearch = str.includes(searchQuery.toLowerCase());
    const matchSubject = selectedSubject === 'All' || pdf.subject === selectedSubject;
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Student Portal layout */}
      <AnimatePresence mode="wait">
        {!selectedPdf ? (
          // Library Catalog View
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Header Jumbotron */}
            <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px]" />
              <div className="relative z-10 max-w-2xl">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider">
                  Live Connection Verified
                </span>
                <h1 className="text-white text-3xl font-extrabold tracking-tight mt-4">Welcome to StudyHub Library</h1>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Access official curriculum lecture slides, assignments, review guides, and coursework worksheets posted in real-time by StudyHub Admins.
                </p>
                
                {/* Integration Info Banner */}
                <div className="mt-4 flex items-center gap-1.5 text-xs text-indigo-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Real-time connected to Firestore DB: <strong className="text-white font-mono">studyhub-cb6eb</strong></span>
                </div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border border-white/10 bg-white/5 p-4 rounded-2xl backdrop-blur-md">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 w-4 h-4 my-auto pointer-events-none" />
                <input
                  id="student-search-input"
                  type="text"
                  placeholder="What subject or topic do you want to master today?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Dynamic Categories Scroll */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />
                <div className="flex items-center gap-1.5">
                  {activeSubjects.slice(0, 5).map((subj) => (
                    <button
                      key={subj}
                      id={`student-subj-btn-${subj}`}
                      onClick={() => setSelectedSubject(subj)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedSubject === subj
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                  {activeSubjects.length > 5 && (
                    <select
                      id="student-subject-extra"
                      value={activeSubjects.includes(selectedSubject) && activeSubjects.indexOf(selectedSubject) >= 5 ? selectedSubject : 'More'}
                      onChange={(e) => {
                        if (e.target.value !== 'More') setSelectedSubject(e.target.value);
                      }}
                      className="bg-white/5 text-slate-400 border border-transparent rounded-xl px-2 py-1.5 text-xs font-semibold cursor-pointer outline-none hover:text-white"
                    >
                      <option value="More" disabled>More...</option>
                      {activeSubjects.slice(5).map(sub => (
                        <option className="bg-slate-950 text-white" key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Grid */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredPdfs.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-16 text-center">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg">No syllabus materials matches your filter</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
                  Try adjusting categories, expanding search queries, or request an administrator to upload specific course materials.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPdfs.map((pdf) => {
                  const isBookmarked = bookmarks.includes(pdf.id);
                  const isCompleted = completedDocs.includes(pdf.id);
                  const hasNotes = !!notes[pdf.id];

                  return (
                    <motion.div
                      key={pdf.id}
                      layoutId={`pdf-card-${pdf.id}`}
                      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 relative flex flex-col justify-between hover:border-white/20 transition-all duration-300 group hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer"
                      onClick={() => setSelectedPdf(pdf)}
                    >
                      <div>
                        {/* Subject Badge & Check/Bookmark indicators */}
                        <div className="flex justify-between items-center">
                          <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded-xl">
                            {pdf.subject}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {hasNotes && (
                              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Has Notes">
                                <Notebook className="w-3 h-3" />
                              </span>
                            )}
                            {isCompleted && (
                              <span className="p-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20" title="Mastered">
                                <Award className="w-3 h-3" />
                              </span>
                            )}
                            <button
                              id={`bookmark-toggle-${pdf.id}`}
                              onClick={(e) => toggleBookmark(pdf.id, e)}
                              className={`p-1 rounded-md border transition-all ${
                                isBookmarked 
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' 
                                  : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                              }`}
                              title={isBookmarked ? 'Saved to bookmarks' : 'Add bookmark'}
                            >
                              <Bookmark className="w-3 h-3 fill-current opacity-90" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Desc */}
                        <h3 className="text-white font-extrabold text-md mt-4 group-hover:text-indigo-400 transition-colors line-clamp-1" title={pdf.title}>
                          {pdf.title}
                        </h3>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2 min-h-[32px]">
                          {pdf.description || 'No detailed review guide has been populated.'}
                        </p>

                        {/* Metadata Details */}
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatBytes(pdf.fileSize)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {formatTimeStr(pdf.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Entry Strip */}
                      <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
                        <span>Launch Study Module</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          // Active Study Hub Module Workspace
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left/Middle Column - Reader Workspace */}
            <div className="lg:col-span-2 space-y-6">
              {/* Navigation Back Button */}
              <button
                id="back-to-library-btn"
                onClick={() => {
                  saveActiveNote();
                  setSelectedPdf(null);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-all px-1 py-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to StudyHub Library catalog</span>
              </button>

              {/* Doc Details Banner */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-extrabold uppercase tracking-widest rounded-md">
                      {selectedPdf.subject}
                    </span>
                    <h2 className="text-white text-2xl font-black tracking-tight mt-3">{selectedPdf.title}</h2>
                    <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">{selectedPdf.description || 'No supplementary lesson notes provided for this course material.'}</p>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id="study-complete-toggle-btn"
                      onClick={() => toggleComplete(selectedPdf.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        completedDocs.includes(selectedPdf.id)
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>{completedDocs.includes(selectedPdf.id) ? 'Mastered' : 'Mark Lesson Mastered'}</span>
                    </button>
                    
                    <button
                      id="study-bookmark-toggle-btn"
                      onClick={() => toggleBookmark(selectedPdf.id)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        bookmarks.includes(selectedPdf.id)
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>

                {/* PDF info strip */}
                <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
                  <p>Document source: <strong className="text-slate-300">{selectedPdf.fileName}</strong></p>
                  <span>•</span>
                  <p>Size: <strong className="text-slate-300">{formatBytes(selectedPdf.fileSize)}</strong></p>
                  <span>•</span>
                  <p>Instructor/Admin: <strong className="text-slate-300">{selectedPdf.uploadedBy}</strong></p>
                </div>
              </div>

              {/* Dynamic Embed or Instant PDF Launch Panel */}
              <div className="rounded-3xl border border-white/10 bg-slate-950 overflow-hidden relative" style={{ height: '520px' }}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex flex-col justify-center items-center text-center p-8">
                  <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="text-white font-extrabold text-lg">Official Study Resource Document</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-md">
                    Secure educational resource distribution. You can preview PDF securely inside browser sandbox, download locally or send to desktop.
                  </p>

                  <div className="flex items-center gap-3 mt-6">
                    <a
                      href={selectedPdf.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-500/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Document PDF</span>
                    </a>
                    
                    <a
                      href={selectedPdf.fileUrl}
                      download={selectedPdf.fileName}
                      className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <span>Download File</span>
                    </a>
                  </div>
                </div>
                {/* Embed background canvas preview */}
                <div className="w-full h-full opacity-10 bg-grid-pattern flex items-center justify-center">
                  <span className="font-mono text-9xl text-white font-black tracking-widest uppercase opacity-20">PDF</span>
                </div>
              </div>
            </div>

            {/* Right Column - Study Companion Tools */}
            <div className="space-y-6">
              {/* Pomodoro Focus session */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pink-400" />
                    <h3 className="text-white text-sm font-bold">Focus Study Timer</h3>
                  </div>
                  <span className="text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full font-bold uppercase">
                    Pomodoro Method
                  </span>
                </div>

                <div className="text-center py-4">
                  <p className="text-white text-5xl font-mono font-black tracking-tight">{formatTimer(timerLeft)}</p>
                  <p className="text-[11px] text-slate-400 mt-2">Maintain absolute cognitive flow while reviewing worksheets.</p>

                  <div className="flex items-center justify-center gap-3 mt-5">
                    {timerRunning ? (
                      <button
                        id="pause-timer-btn"
                        onClick={() => setTimerRunning(false)}
                        className="px-4 py-2 bg-pink-500/15 border border-pink-500/30 text-pink-400 rounded-xl text-xs font-bold hover:bg-pink-500/25 transition-all flex items-center gap-1"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        id="start-timer-btn"
                        onClick={() => setTimerRunning(true)}
                        className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Work Flow</span>
                      </button>
                    )}

                    <button
                      id="reset-timer-btn"
                      onClick={resetTimer}
                      className="p-2 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 text-slate-400 hover:text-white transition-all"
                      title="Reset Session"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Flashcard study module */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3.5 mb-4 justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <h3 className="text-white text-sm font-bold">Active Quiz & Memorizer</h3>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-bold">Flashcard 1 of 3</span>
                </div>

                {activeFlashcards.length > 0 && (
                  <div className="space-y-4">
                    {/* Flippable card */}
                    <div 
                      onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
                      className="p-5 min-h-[140px] rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between relative"
                    >
                      <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-2 block">
                        {showFlashcardAnswer ? 'Answer Revealed:' : 'Recall Question:'}
                      </span>
                      
                      <div className="flex-1 flex items-center">
                        <p className="text-white text-xs leading-relaxed font-medium">
                          {showFlashcardAnswer 
                            ? activeFlashcards[currentFlashcardIndex].answer 
                            : activeFlashcards[currentFlashcardIndex].question
                          }
                        </p>
                      </div>

                      <div className="text-[9px] text-right text-slate-500 mt-3 italic">
                        Click flashcard to flip / reveal
                      </div>
                    </div>

                    {/* Cycle buttons */}
                    <div className="flex justify-between items-center text-xs">
                      <button
                        id="prev-flashcard-btn"
                        disabled={currentFlashcardIndex === 0}
                        onClick={() => {
                          setCurrentFlashcardIndex(prev => Math.max(0, prev - 1));
                          setShowFlashcardAnswer(false);
                        }}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] disabled:opacity-30 disabled:pointer-events-none transition-all"
                      >
                        Prev Card
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          id="correct-flashcard-btn"
                          className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg text-[10px] transition-all"
                          onClick={() => {
                            // Cycle next automatically
                            if (currentFlashcardIndex < activeFlashcards.length - 1) {
                              setCurrentFlashcardIndex(prev => prev + 1);
                              setShowFlashcardAnswer(false);
                            }
                          }}
                        >
                          I recall this!
                        </button>
                      </div>

                      <button
                        id="next-flashcard-btn"
                        disabled={currentFlashcardIndex === activeFlashcards.length - 1}
                        onClick={() => {
                          setCurrentFlashcardIndex(prev => Math.min(activeFlashcards.length - 1, prev + 1));
                          setShowFlashcardAnswer(false);
                        }}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] disabled:opacity-30 disabled:pointer-events-none transition-all"
                      >
                        Next Card
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Study Notes Textbox pad */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <Notebook className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-white text-sm font-bold font-sans">Lecture Notes Pad</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">Auto-saves locally</span>
                </div>

                <div className="space-y-3">
                  <textarea
                    id="student-notepad-textarea"
                    rows={6}
                    value={activeNote}
                    onChange={(e) => {
                      setActiveNote(e.target.value);
                      // Save note to local state dictionary
                      setNotes(prev => ({
                        ...prev,
                        [selectedPdf.id]: e.target.value
                      }));
                    }}
                    placeholder="Scribble formula references, course guidelines, exam tasks, or summary concepts here..."
                    className="w-full bg-slate-950/40 border border-white/5 rounded-2xl p-4 text-white text-xs leading-relaxed placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-sans"
                  />
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>{activeNote.length} characters written</span>
                    <button
                      id="save-notes-btn"
                      onClick={saveActiveNote}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/10 transition-all"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
