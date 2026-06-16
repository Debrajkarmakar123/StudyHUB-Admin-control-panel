import { useEffect, useState, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Lecture } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, Search, Filter, Edit, Trash2, X, Check, Save, Plus, AlertTriangle, Sparkles } from 'lucide-react';

const SUBJECT_PRESETS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'History',
  'Literature',
  'Other'
];

export default function ManageLectures() {
  const [lectures, setLectures] = useState<Lecture[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_all_lectures');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('studyhub_cached_all_lectures');
    return cached ? false : true;
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  // New Lecture Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECT_PRESETS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editThumbnail, setEditThumbnail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const coll = 'lectures';
    const q = query(collection(db, coll), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Lecture[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Lecture);
        });
        setLectures(items);
        localStorage.setItem('studyhub_cached_all_lectures', JSON.stringify(items));
        setLoading(false);
      },
      (err) => {
        setError('Firestore access denied inside lectures. Verify admin whitelisting status.');
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, coll);
        } catch (e) {
          console.error(e);
        }
      }
    );

    return unsubscribe;
  }, []);

  const handleCreateLecture = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !videoUrl.trim()) {
      setError('Title and Video URL are required fields.');
      return;
    }

    // Basic video url validation (e.g. must look like link)
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      setError('Please provide a valid Video URL starting with http:// or https://');
      return;
    }

    const finalSubject = subject === 'Other' ? customSubject.trim() : subject;
    if (!finalSubject) {
      setError('Please supply a lecture subject.');
      return;
    }

    const currentEmail = auth.currentUser?.email;
    if (!currentEmail) {
      setError('You must be signed in as an admin to upload lecture links.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        subject: finalSubject,
        videoUrl: videoUrl.trim(),
        thumbnail: thumbnail.trim() || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop',
        uploadedBy: currentEmail,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'lectures'), payload);
      setSuccess('Study Video Lecture published successfully!');
      setTitle('');
      setVideoUrl('');
      setThumbnail('');
      setCustomSubject('');
    } catch (err: any) {
      setError('Cloud storage publishing failed. Permission denied.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'lectures');
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLecture) return;
    setError('');
    setSuccess('');

    if (!editTitle.trim() || !editSubject.trim() || !editVideoUrl.trim()) {
      setError('Title, Subject, and Video URL are required.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'lectures', editingLecture.id);
      await updateDoc(docRef, {
        title: editTitle.trim(),
        subject: editSubject.trim(),
        videoUrl: editVideoUrl.trim(),
        thumbnail: editThumbnail.trim()
      });

      setSuccess('Lecture details successfully modified!');
      setEditingLecture(null);
    } catch (err: any) {
      setError('Failed to update Lecture document metadata.');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `lectures/${editingLecture.id}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLecture = async (lec: Lecture) => {
    if (!window.confirm(`Are you sure you want to delete "${lec.title}"?`)) {
      return;
    }
    setError('');
    setSuccess('');

    try {
      await deleteDoc(doc(db, 'lectures', lec.id));
      setSuccess('Video Lecture has been safely expunged.');
    } catch (err: any) {
      setError('Failed to delete Lecture from Firestore database.');
      try {
        handleFirestoreError(err, OperationType.DELETE, `lectures/${lec.id}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Unique Subjects filter computation
  const uniqueSubjects = ['All', ...Array.from(new Set(lectures.map((l) => l.subject || ''))).filter(Boolean)];

  const filteredLectures = lectures.filter((l) => {
    const searchStr = `${l.title} ${l.subject}`.toLowerCase();
    const matchSearch = searchStr.includes(searchQuery.toLowerCase());
    const matchSubject = selectedSubject === 'All' || l.subject === selectedSubject;
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-center gap-2 animate-pulse">
          <Check className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation section form */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl h-fit"
        >
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="text-indigo-400 w-5 h-5 animate-pulse" />
            <h3 className="text-white font-bold text-lg">Publish Video Lecture</h3>
          </div>

          <form onSubmit={handleCreateLecture} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Lecture Title</label>
              <input
                id="lecture-title-input"
                type="text"
                required
                placeholder="e.g. Organic Chemistry: Covalent Bonds"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Syllabus Subject</label>
                <select
                  id="lecture-subject-select"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {SUBJECT_PRESETS.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {subject === 'Other' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Custom Subject</label>
                  <input
                    id="lecture-custom-subject"
                    type="text"
                    required
                    placeholder="e.g. Cognitive Psychology"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none"
                  />
                </motion.div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Lesson Video link (YouTube, Drive, mp4)</label>
              <input
                id="lecture-video-url-input"
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Poster Thumbnail Image URL (Optional)</label>
              <input
                id="lecture-thumbnail-input"
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              id="submit-lecture-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-4 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Publish Lecture Video</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Live List panel */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col justify-between"
        >
          {/* Filtering bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-white/5 pb-6 mb-6">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 w-4 h-4 my-auto" />
              <input
                id="lecture-search"
                type="text"
                placeholder="Search lectures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white placeholder-slate-500 text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="lecture-subject-filter"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full sm:w-36 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs cursor-pointer focus:outline-none"
              >
                {uniqueSubjects.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List display */}
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredLectures.length === 0 ? (
            <div className="text-center py-12">
              <PlayCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-bold text-md">No lecture documents uploaded yet</p>
              <p className="text-slate-500 text-xs">Publish your first digital lecture slide above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {filteredLectures.map((lec) => (
                <div
                  key={lec.id}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-white/5">
                      <img
                        src={lec.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop'}
                        alt={lec.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <PlayCircle className="w-10 h-10 text-white opacity-85 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>

                    <div>
                      <span className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[9px] font-black uppercase rounded">
                        {lec.subject}
                      </span>
                      <h4 className="text-white text-sm font-bold truncate mt-2" title={lec.title}>{lec.title}</h4>
                      <p className="text-slate-500 text-[10px] break-all max-w-[220px] truncate mt-1">{lec.videoUrl}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 justify-end">
                    <button
                      id={`edit-lec-${lec.id}`}
                      onClick={() => {
                        setEditingLecture(lec);
                        setEditTitle(lec.title);
                        setEditSubject(lec.subject);
                        setEditVideoUrl(lec.videoUrl);
                        setEditThumbnail(lec.thumbnail || '');
                      }}
                      className="p-1 px-2.5 bg-white/5 border border-white/10 hover:border-indigo-500/20 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                    >
                      Edit
                    </button>
                    <button
                      id={`delete-lec-${lec.id}`}
                      onClick={() => handleDeleteLecture(lec)}
                      className="p-1 px-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg text-[10px] font-bold transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit Lecture Modal */}
      <AnimatePresence>
        {editingLecture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <h3 className="text-white font-bold text-lg">Edit Lecture Details</h3>
                <button
                  id="close-edit-modal-btn"
                  onClick={() => setEditingLecture(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Lecture Title</label>
                  <input
                    id="edit-lec-title"
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Subject</label>
                  <input
                    id="edit-lec-subject"
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Lecture Video URL</label>
                  <input
                    id="edit-lec-video"
                    type="url"
                    required
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Thumbnail Poster URL</label>
                  <input
                    id="edit-lec-thumbnail"
                    type="url"
                    value={editThumbnail}
                    onChange={(e) => setEditThumbnail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <button
                  id="save-lecture-changes-btn"
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 mt-6 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Lecture Changes</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
