import { useEffect, useState, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfMetadata } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Search, Filter, Edit, Trash2, ExternalLink, X, Check, Eye } from 'lucide-react';

export default function ManagePDFs() {
  const [pdfs, setPdfs] = useState<PdfMetadata[]>(() => {
    const cached = localStorage.getItem('studyhub_cached_all_pdfs');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('studyhub_cached_all_pdfs');
    return cached ? false : true;
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  // Editing state
  const [editingPdf, setEditingPdf] = useState<PdfMetadata | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const pdfsCollection = 'pdfs';
    const q = query(collection(db, pdfsCollection), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PdfMetadata[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as PdfMetadata);
        });
        setPdfs(items);
        localStorage.setItem('studyhub_cached_all_pdfs', JSON.stringify(items));
        setLoading(false);
      },
      (err) => {
        setError('Firestore access denied. Verify admin whitelisting status.');
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, pdfsCollection);
        } catch (e) {
          console.error(e);
        }
      }
    );

    return unsubscribe;
  }, []);

  // Compute unique subjects for filter options
  const uniqueSubjects = ['All', ...Array.from(new Set(pdfs.map((pdf) => pdf.subject || ''))).filter(Boolean)];

  // Filtered PDFs list
  const filteredPdfs = pdfs.filter((pdf) => {
    const searchString = `${pdf.title} ${pdf.subject} ${pdf.description}`.toLowerCase();
    const matchesSearch = searchString.includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || pdf.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  // Handle opening the Edit modal
  const openEditModal = (pdf: PdfMetadata) => {
    setEditingPdf(pdf);
    setEditTitle(pdf.title);
    setEditSubject(pdf.subject);
    setEditDescription(pdf.description || '');
  };

  // Save changes to Firestore
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPdf) return;
    setError('');
    setSuccess('');

    if (!editTitle.trim() || !editSubject.trim()) {
      setError('Title and Subject are required fields.');
      return;
    }

    setIsSaving(true);
    try {
      const pdfsCollection = 'pdfs';
      const pdfDocRef = doc(db, pdfsCollection, editingPdf.id);
      
      await updateDoc(pdfDocRef, {
        title: editTitle.trim(),
        subject: editSubject.trim(),
        description: editDescription.trim(),
      });

      setSuccess('PDF metadata successfully modified!');
      setEditingPdf(null);
    } catch (err: any) {
      setError('Failed to update PDF document metadata.');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `pdfs/${editingPdf.id}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle PDF deletion
  const handleDeletePdf = async (pdf: PdfMetadata) => {
    if (!window.confirm(`Are you sure you want to delete "${pdf.title}"? This cannot be undone.`)) {
      return;
    }
    setError('');
    setSuccess('');

    try {
      // 1. Delete physical file in Firebase Storage if URL/ref matched
      if (pdf.fileUrl) {
        try {
          const fileRef = ref(storage, pdf.fileUrl);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn('Storage deletion failed or file missing. Cleaning document metadata anyway.', storageErr);
        }
      }

      // 2. Delete Firestore metadata document
      const pdfsCollection = 'pdfs';
      await deleteDoc(doc(db, pdfsCollection, pdf.id));
      setSuccess('PDF published material has been safely destroyed.');
    } catch (err: any) {
      setError('Failed to delete Firestore record pointer.');
      try {
        handleFirestoreError(err, OperationType.DELETE, `pdfs/${pdf.id}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Control Panel Header (Filters & Search) */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 w-4 h-4 my-auto" />
          <input
            id="pdf-search-input"
            type="text"
            placeholder="Search material title or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-slate-400 w-4 h-4 shrink-0" />
          <select
            id="pdf-subject-filter-select"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full md:w-48 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            {uniqueSubjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PDF List Cards */}
      {filteredPdfs.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold text-lg">No matching PDF files</p>
          <p className="text-slate-400 text-xs mt-1">Alter your query keywords or category filter values.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPdfs.map((pdf) => (
            <motion.div
              key={pdf.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/10 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold tracking-wider uppercase rounded-full">
                    {pdf.subject}
                  </span>
                </div>

                <h3 className="text-white font-bold text-lg mt-4 truncate" title={pdf.title}>{pdf.title}</h3>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed min-h-[32px]">{pdf.description || 'No description supplied.'}</p>

                <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-400 space-y-1">
                  <p>File name: <span className="text-slate-300 font-medium">{pdf.fileName}</span></p>
                  <p>File size: <span className="text-slate-300 font-medium">{formatBytes(pdf.fileSize)}</span></p>
                  <p>Publisher: <span className="text-slate-300 font-medium">{pdf.uploadedBy}</span></p>
                </div>
              </div>

              {/* PDF Actions */}
              <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/5">
                <a
                  href={pdf.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="flex items-center justify-center gap-1.5 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold scroll-smooth transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </a>
                <button
                  id={`edit-pdf-btn-${pdf.id}`}
                  onClick={() => openEditModal(pdf)}
                  className="flex items-center justify-center gap-1.5 py-2 bg-white/5 border border-white/10 rounded-xl text-indigo-300 hover:text-white hover:bg-indigo-500/20 text-xs font-semibold transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  id={`delete-pdf-btn-${pdf.id}`}
                  onClick={() => handleDeletePdf(pdf)}
                  className="flex items-center justify-center gap-1.5 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Component Modal */}
      <AnimatePresence>
        {editingPdf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <h3 className="text-white font-bold text-lg">Edit Course Materials</h3>
                <button
                  id="close-edit-modal-btn"
                  onClick={() => setEditingPdf(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Document Title</label>
                  <input
                    id="edit-pdf-title-input"
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Subject</label>
                  <input
                    id="edit-pdf-subject-input"
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Description / Notes</label>
                  <textarea
                    id="edit-pdf-desc-textarea"
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                  />
                </div>

                <button
                  id="save-pdf-changes-btn"
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
