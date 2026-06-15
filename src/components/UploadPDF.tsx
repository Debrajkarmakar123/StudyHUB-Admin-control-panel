import { useState, useRef, FormEvent, DragEvent, ChangeEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';

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

export default function UploadPDF() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECT_PRESETS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errMessage, setErrMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setErrMessage('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type !== 'application/pdf') {
        setErrMessage('Only PDF documents are allowed.');
        return;
      }
      setFile(droppedFile);
      // Auto-populate title if empty
      if (!title) {
        const withoutExt = droppedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(withoutExt.replace(/[_-]/g, ' '));
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setErrMessage('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setErrMessage('Only PDF documents are allowed.');
        return;
      }
      setFile(selectedFile);
      if (!title) {
        const withoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(withoutExt.replace(/[_-]/g, ' '));
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setErrMessage('');
    setSuccess(false);

    if (!file) {
      setErrMessage('Please choose or drag a PDF file to upload.');
      return;
    }

    if (!title.trim()) {
      setErrMessage('Please specify a title for the document.');
      return;
    }

    const finalSubject = subject === 'Other' ? customSubject.trim() : subject;
    if (!finalSubject) {
      setErrMessage('Please supply a study subject.');
      return;
    }

    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) {
      setErrMessage('You must be signed in as an admin to perform this action.');
      return;
    }

    setUploadProgress(0);

    // 1. Storage Ref
    const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `pdfs/${uniqueFileName}`);

    // 2. Storage Task
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('File upload error during storage storage:', error);
        setErrMessage(`Storage upload failed: ${error.message}`);
        setUploadProgress(null);
      },
      async () => {
        try {
          // 3. Get Download URL
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // 4. Save to Firestore
          const pdfPayload = {
            title: title.trim(),
            subject: finalSubject,
            description: description.trim(),
            fileUrl: downloadUrl,
            fileName: file.name,
            fileSize: file.size,
            uploadedBy: currentUserEmail,
            createdAt: serverTimestamp()
          };

          const pdfsCollection = 'pdfs';
          await addDoc(collection(db, pdfsCollection), pdfPayload);

          // Complete!
          setSuccess(true);
          setTitle('');
          setDescription('');
          setFile(null);
          setCustomSubject('');
          setUploadProgress(null);
        } catch (err: any) {
          setUploadProgress(null);
          setErrMessage('Cloud metadata storage failed. Permisson denied.');
          try {
            handleFirestoreError(err, OperationType.CREATE, 'pdfs');
          } catch (e) {
            console.error(e);
          }
        }
      }
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    return (bytes / (k * k)).toFixed(2) + ' MB';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8"
      >
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="text-indigo-400 w-5 h-5 animate-pulse" />
          <h2 className="text-white text-xl font-bold">Upload Course Materials</h2>
        </div>

        {errMessage && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errMessage}</span>
          </div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>Study resources uploaded and processed successfully!</span>
          </motion.div>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          {/* File Upload Section */}
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Study PDF (Max 20MB)</label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : file
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-white/10 hover:border-white/20 bg-white/5'
              }`}
            >
              <input
                id="pdf-file-input"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                {file ? (
                  <>
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/10">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold truncate max-w-lg">{file.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      id="change-file-btn"
                      type="button"
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase font-bold rounded-lg border border-white/10 transition-all"
                    >
                      Change File
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white/5 text-slate-300 rounded-xl flex items-center justify-center border border-white/10 group-hover:text-white transition-colors">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Drag and drop file here, or click to browse</p>
                      <p className="text-slate-400 text-xs mt-1">Supports educational .pdf files</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Material Title</label>
            <input
              id="material-title-input"
              type="text"
              required
              placeholder="e.g. Intro to Advanced Calculus - Week 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
            />
          </div>

          {/* Subject presets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1 font-sans">Syllabus Subject</label>
              <select
                id="preset-subject-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all duration-200 cursor-pointer"
              >
                {SUBJECT_PRESETS.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {subject === 'Other' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Custom Subject Name</label>
                <input
                  id="custom-subject-input"
                  type="text"
                  required
                  placeholder="e.g. Cognitive Psychology"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                />
              </motion.div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1 font-sans">Description / Notes</label>
            <textarea
              id="material-desc-textarea"
              rows={4}
              maxLength={100}
              placeholder="Provide context, references, course week, or important exam guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
            />
            <div className="flex justify-end text-[10px] text-slate-500 mt-1 mr-1">
              {description.length}/1000 characters
            </div>
          </div>

          {/* Progress Indicator */}
          {uploadProgress !== null && (
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                  Uploading assets...
                </span>
                <span className="text-white font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id="publish-material-btn"
            type="submit"
            disabled={uploadProgress !== null}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-sans disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>Publish Study Material</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
