import { useEffect, useState, useRef, MouseEvent } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfMetadata, Lecture, Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Filter, 
  Clock, 
  Bookmark, 
  Play, 
  Pause, 
  RotateCcw, 
  Award, 
  ArrowLeft, 
  ExternalLink, 
  Notebook, 
  Sparkles, 
  ChevronRight, 
  Calendar,
  CheckCircle,
  Megaphone,
  Bell,
  PlayCircle,
  X,
  BookOpen
} from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

export default function StudentPortal() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'announcements' | 'pdfs' | 'lectures'>('announcements');

  // Real-time collections from Firebase
  const [pdfs, setPdfs] = useState<PdfMetadata[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_student_pdfs');
    return cached ? JSON.parse(cached) : [];
  });
  const [lectures, setLectures] = useState<Lecture[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_student_lectures');
    return cached ? JSON.parse(cached) : [];
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_student_announcements');
    return cached ? JSON.parse(cached) : [];
  });

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfSearch, setPdfSearch] = useState('');
  const [pdfSubjectFilter, setPdfSubjectFilter] = useState('All');
  const [lectureSearch, setLectureSearch] = useState('');
  const [lectureSubjectFilter, setLectureSubjectFilter] = useState('All');
  
  // Selection states
  const [selectedPdf, setSelectedPdf] = useState<PdfMetadata | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  // Student interactions (notes, bookmarks, etc)
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

  // Pomodoro timer States
  const [timerLeft, setTimerLeft] = useState(1500);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flashcards state
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  // 1. Sync PDFs from Firestore
  useEffect(() => {
    const q = query(collection(db, 'pdfs'), orderBy('createdAt', 'desc'));
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
        setError('Connection issues with Live DB. Showing cached local PDF folders.');
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, 'pdfs');
        } catch (e) {
          console.error(e);
        }
      }
    );
    return unsubscribe;
  }, []);

  // 2. Sync Lectures from Firestore
  useEffect(() => {
    const q = query(collection(db, 'lectures'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Lecture[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Lecture);
        });
        setLectures(items);
        localStorage.setItem('studyhub_cached_student_lectures', JSON.stringify(items));
      },
      (err) => {
        console.error('Error listening to lectures:', err);
      }
    );
    return unsubscribe;
  }, []);

  // 3. Sync Announcements from Firestore
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Announcement[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Announcement);
        });
        setAnnouncements(items);
        localStorage.setItem('studyhub_cached_student_announcements', JSON.stringify(items));
      },
      (err) => {
        console.error('Error listening to announcements:', err);
      }
    );
    return unsubscribe;
  }, []);

  // Local storage synchronization
  useEffect(() => {
    localStorage.setItem('studyhub_student_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('studyhub_student_completed', JSON.stringify(completedDocs));
  }, [completedDocs]);

  useEffect(() => {
    localStorage.setItem('studyhub_student_notes', JSON.stringify(notes));
  }, [notes]);

  // Pomodoro study stopwatch logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.35);
            } catch (_) {}
            return 1500;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Sync chosen PDF module study notes / flashcards
  useEffect(() => {
    if (selectedPdf) {
      setActiveNote(notes[selectedPdf.id] || '');
      const flash = generateDynamicFlashcards(selectedPdf);
      setActiveFlashcards(flash);
      setCurrentFlashcardIndex(0);
      setShowFlashcardAnswer(false);
    }
  }, [selectedPdf]);

  const savePdfNotes = () => {
    if (selectedPdf) {
      setNotes((prev) => ({
        ...prev,
        [selectedPdf.id]: activeNote
      }));
    }
  };

  const generateDynamicFlashcards = (pdf: PdfMetadata): Flashcard[] => {
    const sub = pdf.subject;
    const desc = pdf.description || '';
    return [
      {
        question: `What primary topic is explored inside "${pdf.title}"?`,
        answer: desc ? `The syllabus details state: "${desc}". Subject is ${sub}.` : `This coursework focuses on reinforcing fundamentals of ${sub}.`
      },
      {
        question: `How can one maximize comprehension of this ${sub} module?`,
        answer: `By reviewing the formulas, making annotations, using active recall, and running focused Pomodoro study timers.`
      },
      {
        question: `What are the file specs for "${pdf.fileName}"?`,
        answer: `It is a secure file of ${(pdf.fileSize / (1024 * 1024)).toFixed(2)} MB, uploaded by faculty coordinator ${pdf.uploadedBy || 'Syllabus Admin'}.`
      }
    ];
  };

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

  // Lists Filters Compute
  const pdfSubjects = ['All', ...Array.from(new Set(pdfs.map((p) => p.subject || ''))).filter(Boolean)];
  const lectureSubjects = ['All', ...Array.from(new Set(lectures.map((l) => l.subject || ''))).filter(Boolean)];

  const filteredPdfs = pdfs.filter((pdf) => {
    const str = `${pdf.title} ${pdf.subject} ${pdf.description}`.toLowerCase();
    const matchSearch = str.includes(pdfSearch.toLowerCase());
    const matchSubject = pdfSubjectFilter === 'All' || pdf.subject === pdfSubjectFilter;
    return matchSearch && matchSubject;
  });

  const filteredLectures = lectures.filter((l) => {
    const str = `${l.title} ${l.subject}`.toLowerCase();
    const matchSearch = str.includes(lectureSearch.toLowerCase());
    const matchSubject = lectureSubjectFilter === 'All' || l.subject === lectureSubjectFilter;
    return matchSearch && matchSubject;
  });

  // Safe Embed conversion for YouTube URLs
  const getEmbedVideoUrl = (url: string) => {
    try {
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        const v = urlParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}`;
      } else if (url.includes('youtu.be/')) {
        const v = url.split('youtu.be/')[1]?.split('?')[0];
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
    } catch (_) {}
    return url;
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Welcome Unit */}
      {!selectedPdf && (
        <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px]" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-bold uppercase tracking-widest rounded-full">
                Syllabus Stream Connected
              </span>
              <h1 className="text-white text-3xl font-black tracking-tight mt-4">StudyHub Classroom Ecosystem</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-2 leading-relaxed">
                Connect directly with course circular announcements, lecture presentations, assignments, and study video guides compiled securely in real-time.
              </p>
            </div>
            
            {/* Minimal Indicators */}
            <div className="flex gap-4 p-4 border border-white/5 bg-slate-950/50 rounded-2xl">
              <div className="text-center px-2">
                <p className="text-white text-md font-bold">{pdfs.length}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">PDF files</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center px-2">
                <p className="text-white text-md font-bold">{lectures.length}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Videos</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center px-2">
                <p className="text-white text-md font-bold">{announcements.length}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Circulars</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!selectedPdf ? (
          // Main dynamic student app categories switcher
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Segmented control navigation */}
            <div className="flex border border-white/10 bg-white/5 p-1 rounded-2xl max-w-md backdrop-blur-md">
              <button
                id="main-tab-announcements"
                onClick={() => { setActiveTab('announcements'); setSelectedLecture(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'announcements'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notice Board</span>
              </button>
              
              <button
                id="main-tab-pdfs"
                onClick={() => { setActiveTab('pdfs'); setSelectedLecture(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'pdfs'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Study Library</span>
              </button>

              <button
                id="main-tab-lectures"
                onClick={() => { setActiveTab('lectures'); setSelectedLecture(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'lectures'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Lesson Videos</span>
              </button>
            </div>

            {/* TAB CONTENT: Announcements (Notice Board) */}
            {activeTab === 'announcements' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-lg mb-2 pl-1">
                  <Megaphone className="w-5 h-5 text-indigo-400" />
                  <span>Syllabus Deadlines & Broadsheets</span>
                </div>

                {announcements.length === 0 ? (
                  <div className="p-12 border border-white/10 rounded-3xl bg-white/5 text-center">
                    <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
                    <h3 className="text-white font-bold text-md">Clean broadsheet slate</h3>
                    <p className="text-slate-500 text-xs mt-1">There are no administrative board announcements posted currently.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-5 rounded-3xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-4">
                            <h4 className="text-white text-md font-extrabold tracking-tight">{ann.title}</h4>
                            <span className="text-[9px] text-slate-500 font-medium shrink-0 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatTimeStr(ann.createdAt)}
                            </span>
                          </div>
                          <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                            {ann.message}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-slate-500 text-right">
                          Instructor: <strong className="text-indigo-400">{ann.uploadedBy || 'Syllabus Admin'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB CONTENT: Study Library (PDFs) */}
            {activeTab === 'pdfs' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Search Bar & Categories scroll */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-4 border border-white/10 rounded-2xl bg-white/5">
                  <div className="relative w-full md:max-w-xs">
                    <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 w-3.5 h-3.5 my-auto" />
                    <input
                      id="student-pdf-search"
                      type="text"
                      placeholder="Search PDF document names..."
                      value={pdfSearch}
                      onChange={(e) => setPdfSearch(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none pb-0.5">
                    {pdfSubjects.map((sub) => (
                      <button
                        key={sub}
                        id={`pdf-sub-filter-${sub}`}
                        onClick={() => setPdfSubjectFilter(sub)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
                          pdfSubjectFilter === sub
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid */}
                {filteredPdfs.length === 0 ? (
                  <div className="p-12 text-center border border-white/10 rounded-3xl bg-white/5">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-white font-bold text-md">No books matching search</h3>
                    <p className="text-slate-500 text-xs mt-1">Try toggling filter categories or refine search queries.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPdfs.map((pdf) => {
                      const isComplete = completedDocs.includes(pdf.id);
                      const isBookmarked = bookmarks.includes(pdf.id);
                      return (
                        <div
                          key={pdf.id}
                          className="p-5 rounded-3xl bg-slate-900/40 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
                          onClick={() => setSelectedPdf(pdf)}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase rounded">
                                {pdf.subject}
                              </span>
                              <div className="flex gap-1">
                                {isComplete && (
                                  <span className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" title="Mastered">
                                    <Award className="w-3 h-3" />
                                  </span>
                                )}
                                <button
                                  id={`pdf-bookmark-btn-${pdf.id}`}
                                  onClick={(e) => toggleBookmark(pdf.id, e)}
                                  className={`p-1 rounded border ${isBookmarked ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-slate-500'}`}
                                >
                                  <Bookmark className="w-3 h-3 fill-current" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-white font-extrabold text-sm mt-4 truncate" title={pdf.title}>{pdf.title}</h4>
                            <p className="text-slate-400 text-xs line-clamp-2 mt-1 min-h-[32px]">{pdf.description || 'Syllabus presentation materials.'}</p>
                          </div>

                          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Syllabus Slide</span>
                            <span className="text-indigo-400 font-semibold group-hover:underline flex items-center gap-0.5">
                              Learn <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB CONTENT: Video Lectures (Lesson Videos) */}
            {activeTab === 'lectures' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-4 border border-white/10 rounded-2xl bg-white/5">
                  <div className="relative w-full md:max-w-xs">
                    <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 w-3.5 h-3.5 my-auto" />
                    <input
                      id="student-lecture-search"
                      type="text"
                      placeholder="Search class lecture videos..."
                      value={lectureSearch}
                      onChange={(e) => setLectureSearch(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none pb-0.5">
                    {lectureSubjects.map((sub) => (
                      <button
                        key={sub}
                        id={`lecture-sub-filter-${sub}`}
                        onClick={() => setLectureSubjectFilter(sub)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
                          lectureSubjectFilter === sub
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid */}
                {filteredLectures.length === 0 ? (
                  <div className="p-12 text-center border border-white/10 rounded-3xl bg-white/5">
                    <PlayCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-white font-bold text-md">No videos matches search criteria</h3>
                    <p className="text-slate-500 text-xs mt-1">Review guidelines or search terms.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLectures.map((lec) => (
                      <div
                        key={lec.id}
                        className="p-4 rounded-3xl bg-slate-900/40 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
                        onClick={() => setSelectedLecture(lec)}
                      >
                        <div className="space-y-3">
                          <div className="aspect-video bg-slate-950 rounded-2xl border border-white/5 relative overflow-hidden">
                            <img
                              src={lec.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop'}
                              alt={lec.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                              <PlayCircle className="w-12 h-12 text-indigo-400 fill-indigo-400/20 group-hover:scale-110 transition-transform" />
                            </div>
                          </div>

                          <div>
                            <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase rounded-lg">
                              {lec.subject}
                            </span>
                            <h4 className="text-white text-sm font-extrabold truncate mt-2.5" title={lec.title}>{lec.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-1 truncate break-all">{lec.videoUrl}</p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-slate-500 flex justify-between items-center">
                          <span>By: {lec.uploadedBy || 'Instructor'}</span>
                          <span className="text-indigo-400 font-bold group-hover:underline">Play Video Lesson</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // Active Study Hub Module Workspace
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-slate-300"
          >
            {/* Left/Middle Column - Reader Workspace */}
            <div className="lg:col-span-2 space-y-6">
              {/* Navigation Back Button */}
              <button
                id="back-to-library-btn"
                onClick={() => {
                  savePdfNotes();
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
                    <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{selectedPdf.description || 'No supplementary lesson notes provided for this course material.'}</p>
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
                <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] text-slate-400">
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
                  <p className="text-slate-400 text-xs mt-1 max-w-md">
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
                    <h3 className="text-white text-sm font-bold animate-pulse">Active Quiz & Memorizer</h3>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-bold">Flashcard {currentFlashcardIndex + 1} of 3</span>
                </div>

                {activeFlashcards.length > 0 && (
                  <div className="space-y-4">
                    <div 
                      onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
                      className="p-5 min-h-[140px] rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between relative"
                    >
                      <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-2 block animate-fade-in">
                        {showFlashcardAnswer ? 'Answer Revealed:' : 'Recall Question:'}
                      </span>
                      
                      <div className="flex-1 flex items-center animate-fade-in">
                        <p className="text-white text-xs leading-relaxed font-semibold font-sans">
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

                      <button
                        id="correct-flashcard-btn"
                        className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg text-[10px] transition-all"
                        onClick={() => {
                          if (currentFlashcardIndex < activeFlashcards.length - 1) {
                            setCurrentFlashcardIndex(prev => prev + 1);
                            setShowFlashcardAnswer(false);
                          }
                        }}
                      >
                        I recall this!
                      </button>

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
                    <h3 className="text-white text-sm font-bold">Lecture Notes Pad</h3>
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
                      onClick={savePdfNotes}
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

      {/* IMMERSIVE VIDEO MODAL WATCH OVERLAY FOR LECTURES */}
      <AnimatePresence>
        {selectedLecture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-3xl"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-black uppercase rounded">
                    {selectedLecture.subject}
                  </span>
                  <h3 className="text-white font-black text-lg mt-1 tracking-tight">{selectedLecture.title}</h3>
                </div>
                <button
                  id="close-player-modal-btn"
                  onClick={() => setSelectedLecture(null)}
                  className="p-1 px-2 border border-white/10 rounded-lg text-slate-400 hover:text-white bg-slate-950"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video frame sandbox container */}
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 relative">
                {selectedLecture.videoUrl.includes('youtube.com') || selectedLecture.videoUrl.includes('youtu.be') ? (
                  <iframe
                    className="w-full h-full"
                    src={getEmbedVideoUrl(selectedLecture.videoUrl)}
                    title={selectedLecture.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <video
                    className="w-full h-full"
                    src={selectedLecture.videoUrl}
                    controls
                    poster={selectedLecture.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop'}
                  >
                    Your browser does not support html5 video stream.
                  </video>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400">
                <p>Digital Link: <a href={selectedLecture.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">{selectedLecture.videoUrl} <ExternalLink className="w-3 h-3"/></a></p>
                <p>Professor: <strong className="text-white font-medium">{selectedLecture.uploadedBy || 'Syllabus Specialist'}</strong></p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
