import { useEffect, useState, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Megaphone, Edit, Trash2, X, Check, Save, Plus, AlertTriangle, Sparkles, Calendar, Clock } from 'lucide-react';

export default function ManageAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_all_announcements');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('studyhub_cached_all_announcements');
    return cached ? false : true;
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing State
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const coll = 'announcements';
    const q = query(collection(db, coll), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Announcement[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Announcement);
        });
        setAnnouncements(items);
        localStorage.setItem('studyhub_cached_all_announcements', JSON.stringify(items));
        setLoading(false);
      },
      (err) => {
        setError('Firestore access denied inside announcements. Verify admin whitelisting status.');
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

  const handleCreateAnn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !message.trim()) {
      setError('Title and Message/Body are required.');
      return;
    }

    const currentEmail = auth.currentUser?.email;
    if (!currentEmail) {
      setError('You must be signed in as an admin to post global announcements.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        uploadedBy: currentEmail,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'announcements'), payload);
      setSuccess('Broadcasting Announcement Successful!');
      setTitle('');
      setMessage('');
    } catch (err: any) {
      setError('Failed to broadcast cloud announcement.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'announcements');
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAnn) return;
    setError('');
    setSuccess('');

    if (!editTitle.trim() || !editMessage.trim()) {
      setError('Title and Message elements are required.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'announcements', editingAnn.id);
      await updateDoc(docRef, {
        title: editTitle.trim(),
        message: editMessage.trim()
      });

      setSuccess('Announcement modified successfully!');
      setEditingAnn(null);
    } catch (err: any) {
      setError('Failed to update Announcement document.');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `announcements/${editingAnn.id}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAnn = async (ann: Announcement) => {
    if (!window.confirm(`Are you sure you want to delete "${ann.title}"?`)) {
      return;
    }
    setError('');
    setSuccess('');

    try {
      await deleteDoc(doc(db, 'announcements', ann.id));
      setSuccess('Announcement has been safely revoked from notice board.');
    } catch (err: any) {
      setError('Failed to scrub announcement document metadata.');
      try {
        handleFirestoreError(err, OperationType.DELETE, `announcements/${ann.id}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const formatTimeStr = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form publishing section */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl h-fit animate-fade-in"
        >
          <div className="flex items-center gap-2 mb-6">
            <Megaphone className="text-pink-400 w-5 h-5 animate-bounce" />
            <h3 className="text-white font-bold text-lg">Post Circular Notice</h3>
          </div>

          <form onSubmit={handleCreateAnn} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Notice Title</label>
              <input
                id="ann-title-input"
                type="text"
                required
                placeholder="e.g. Midterm Exams Schedule Release"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 ml-1">Message Body</label>
              <textarea
                id="ann-message-input"
                rows={5}
                required
                placeholder="Write your syllabus announcements details or notification content..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              id="submit-ann-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-4 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Post Announcement</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Live notice boards */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col justify-between"
        >
          <div className="flex justify-between items-center border-b border-white/5 pb-6 mb-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>Notice Circular Board</span>
            </h3>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {announcements.length} active
            </span>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-wiggle" />
              <p className="text-slate-300 font-bold text-md animate-fade-in">No administrative broadsheets posted yet</p>
              <p className="text-slate-500 text-xs">Announce coursework alterations, calendar alerts, or exam notices.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-lg flex items-center justify-center">
                          <Megaphone className="w-4 h-4" />
                        </div>
                        <h4 className="text-white text-md font-extrabold">{ann.title}</h4>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatTimeStr(ann.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed pl-1"/>
                    <div className="text-slate-300 text-xs whitespace-pre-line pl-1 leading-relaxed">
                      {ann.message}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 mt-4 pt-3 text-[10px] text-slate-500">
                    <span>By: <strong className="text-slate-400 font-semibold">{ann.uploadedBy || 'Syllabus Admin'}</strong></span>
                    <div className="flex items-center gap-2">
                      <button
                        id={`edit-ann-${ann.id}`}
                        onClick={() => {
                          setEditingAnn(ann);
                          setEditTitle(ann.title);
                          setEditMessage(ann.message);
                        }}
                        className="p-1 px-2 text-indigo-400 hover:text-white hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/15 rounded font-bold"
                      >
                        Edit
                      </button>
                      <button
                        id={`delete-ann-${ann.id}`}
                        onClick={() => handleDeleteAnn(ann)}
                        className="p-1 px-2 text-rose-400 hover:text-white hover:bg-rose-500/10 border border-transparent hover:border-rose-500/15 rounded font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit Announcement Modal */}
      <AnimatePresence>
        {editingAnn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <h3 className="text-white font-bold text-lg">Modify Circular Record</h3>
                <button
                  id="close-edit-modal-btn"
                  onClick={() => setEditingAnn(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Notice Title</label>
                  <input
                    id="edit-ann-title"
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Message Body</label>
                  <textarea
                    id="edit-ann-message"
                    rows={5}
                    required
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <button
                  id="save-announcement-changes-btn"
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 mt-6 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Notice Changes</span>
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
