import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfMetadata } from '../types';
import { motion } from 'motion/react';
import { FileText, Layers, HardDrive, Clock, ExternalLink, GraduationCap, ChevronRight } from 'lucide-react';

export default function Dashboard({ setView }: { setView: (view: any) => void }) {
  const [pdfs, setPdfs] = useState<PdfMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const pdfsCollection = 'pdfs';
    const q = query(collection(db, pdfsCollection), orderBy('createdAt', 'desc'), limit(5));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PdfMetadata[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as PdfMetadata);
        });
        setPdfs(items);
        setLoading(false);
      },
      (err) => {
        setError('Failed to fetch recent uploads. Access denied or offline.');
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

  // Fetch all PDFs to compute complete stats
  const [allPdfsCount, setAllPdfsCount] = useState(0);
  const [allSubjectsCount, setAllSubjectsCount] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    const pdfsCollection = 'pdfs';
    const q = query(collection(db, pdfsCollection));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setAllPdfsCount(snapshot.size);
        
        const subjectsSet = new Set<string>();
        let sizeAccumulator = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.subject) {
            subjectsSet.add(data.subject.trim());
          }
          if (data.fileSize) {
            sizeAccumulator += data.fileSize;
          }
        });
        
        setAllSubjectsCount(subjectsSet.size);
        setTotalSize(sizeAccumulator);
      },
      (err) => {
        console.error('Stats loading error:', err);
      }
    );
    return unsubscribe;
  }, []);

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time helper
  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Grid Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/10">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Total PDFs</p>
          </div>
          <p className="text-white text-4xl font-bold tracking-tight">{allPdfsCount}</p>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
            Study materials ready for download
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/10">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Active Subjects</p>
          </div>
          <p className="text-white text-4xl font-bold tracking-tight">{allSubjectsCount}</p>
          <p className="text-[11px] text-slate-400 mt-2">
            Primary syllabus categories covered
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <HardDrive className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/10">
              <HardDrive className="w-6 h-6" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Cloud Storage Used</p>
          </div>
          <p className="text-white text-4xl font-bold tracking-tight">{formatBytes(totalSize)}</p>
          <div className="mt-3.5 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full" style={{ width: allPdfsCount > 0 ? '45%' : '0%' }}></div>
          </div>
        </motion.div>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Uploads Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-white font-bold text-lg">Recent PDF Uploads</h3>
            <button
              id="view-all-pdfs-btn"
              onClick={() => setView('manage')}
              className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Manage All</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 p-6 space-y-4">
            {pdfs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileText className="w-12 h-12 text-slate-500 mb-3" />
                <p className="text-slate-300 font-medium">No PDFs uploaded yet</p>
                <button
                  id="dash-upload-prompt-btn"
                  onClick={() => setView('upload')}
                  className="mt-3 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 transition-all"
                >
                  Upload Your First Material
                </button>
              </div>
            ) : (
              pdfs.slice(0, 4).map((pdf, idx) => (
                <div
                  key={pdf.id}
                  className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/10">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{pdf.title}</p>
                    <p className="text-slate-400 text-[11px] truncate mt-0.5">
                      Subject: <span className="text-slate-300 font-medium">{pdf.subject}</span> • {formatBytes(pdf.fileSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(pdf.createdAt)}
                    </span>
                    <a
                      href={pdf.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-all"
                      title="Open PDF"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Tips Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col gap-4 text-slate-300 text-sm"
        >
          <h3 className="text-white font-bold text-lg border-b border-white/5 pb-3">System Metrics Explanation</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider text-indigo-400 mb-1">StudyHub Standard</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                StudyHub runs on Google Cloud Firestore Enterprise, matching secure real-time listener limits and optimized storage buckets.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider text-blue-400 mb-1">Automatic Duplication Check</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                PDF Upload automatically attaches cryptographic timestamps. Re-uploading metadata to matching subject schemas updates current resources.
              </p>
            </div>

            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
              <p className="font-bold text-white text-xs mb-1">Quick Action: User Management</p>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Need to allow colleague admins to publish course PDFs? Whitelist their email addresses.
              </p>
              <button
                id="dash-users-redirect-btn"
                onClick={() => setView('users')}
                className="px-3 py-1.5 bg-indigo-500/20 text-white text-[10px] font-bold rounded-lg border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
              >
                Configure Whitelist
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
