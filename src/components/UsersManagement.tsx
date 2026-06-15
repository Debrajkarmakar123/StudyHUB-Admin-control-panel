import { useEffect, useState, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { WhitelistEntry } from '../types';
import { motion } from 'motion/react';
import { UserCheck, Shield, Trash2, Plus, UserPlus, AlertTriangle, Check, UserMinus } from 'lucide-react';

export default function UsersManagement() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add User Whitelist Form State
  const [newEmail, setNewEmail] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'pending' | 'banned'>('active');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const wlCollection = 'admin_whitelist';
    const q = query(collection(db, wlCollection), orderBy('addedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: WhitelistEntry[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as WhitelistEntry);
        });
        setWhitelist(items);
        setLoading(false);
      },
      (err) => {
        setError('Firestore read access denied. Only whitelisted admin credentials are valid.');
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, wlCollection);
        } catch (e) {
          console.error(e);
        }
      }
    );

    return unsubscribe;
  }, []);

  const handleAddEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailToWhitelist = newEmail.trim().toLowerCase();
    if (!emailToWhitelist) {
      setError('Please supply a valid admin email.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToWhitelist)) {
      setError('Invalid email address format.');
      return;
    }

    const currentAdminEmail = auth.currentUser?.email;
    if (!currentAdminEmail) {
      setError('You must be signed in to whitelist secondary emails.');
      return;
    }

    setIsAdding(true);
    try {
      const docId = emailToWhitelist;
      const wlCollection = 'admin_whitelist';
      
      await setDoc(doc(db, wlCollection, docId), {
        email: emailToWhitelist,
        status: selectedStatus,
        addedAt: serverTimestamp(),
        addedBy: currentAdminEmail
      });

      setSuccess(`"${emailToWhitelist}" has been successfully appended to the admin whitelist as [${selectedStatus}].`);
      setNewEmail('');
    } catch (err: any) {
      setError('Failed to update whitelist document in Firestore.');
      try {
        handleFirestoreError(err, OperationType.CREATE, `admin_whitelist/${emailToWhitelist}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleStatusChange = async (email: string, newStatus: 'active' | 'pending' | 'banned') => {
    setError('');
    setSuccess('');

    const currentAdminEmail = auth.currentUser?.email;
    if (email === currentAdminEmail) {
      setError('You are forbidden from changing your own whitelisted eligibility status.');
      return;
    }

    if (email === 'yoyohoneysinger633@gmail.com') {
      setError('Root super admin status matches read-only protection rules.');
      return;
    }

    try {
      const wlCollection = 'admin_whitelist';
      await setDoc(doc(db, wlCollection, email), {
        email: email,
        status: newStatus,
        addedAt: serverTimestamp(),
        addedBy: currentAdminEmail || 'system'
      }, { merge: true });

      setSuccess(`Updated status for "${email}" to [${newStatus}].`);
    } catch (err: any) {
      setError('Failed to alter whitelist status.');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `admin_whitelist/${email}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteWhitelist = async (email: string) => {
    setError('');
    setSuccess('');

    if (email === 'yoyohoneysinger633@gmail.com') {
      setError('The bootstrapped super administrator cannot be removed from the whitelist.');
      return;
    }

    const currentAdminEmail = auth.currentUser?.email;
    if (email === currentAdminEmail) {
      setError('You cannot remove your own email from the whitelist. lockout protection active.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove "${email}" from the admin whitelist?`)) {
      return;
    }

    try {
      const wlCollection = 'admin_whitelist';
      await deleteDoc(doc(db, wlCollection, email));
      setSuccess(`"${email}" has been successfully expunged from the whitelist.`);
    } catch (err: any) {
      setError('Failed to delete whitelist item.');
      try {
        handleFirestoreError(err, OperationType.DELETE, `admin_whitelist/${email}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Helper for timezone formatting
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid: Form and Live Whitelist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl h-fit"
        >
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="text-indigo-400 w-5 h-5" />
            <h3 className="text-white font-bold text-lg">Whitelist New Admin</h3>
          </div>

          <form onSubmit={handleAddEmail} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Colleague Email</label>
              <input
                id="whitelist-email-input"
                type="email"
                required
                placeholder="colleague@studyhub.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-2 ml-1">Default Authorization Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'pending', 'banned'] as const).map((status) => (
                  <button
                    key={status}
                    id={`status-select-btn-${status}`}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={`py-2 text-[11px] font-bold tracking-wide uppercase rounded-xl border transition-all ${
                      selectedStatus === status
                        ? status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="submit-whitelist-user-btn"
              type="submit"
              disabled={isAdding}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-1.5"
            >
              {isAdding ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Grant Admin Access</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Live list panel */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-emerald-400 w-5 h-5" />
              <h3 className="text-white font-bold text-lg">Permitted Administrators Whitelist</h3>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {whitelist.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-slate-500 font-bold tracking-widest border-b border-white/5">
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Access State</th>
                  <th className="py-4 px-6">Date Added</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {whitelist.map((entry) => {
                  const isCurrentUser = entry.email === auth.currentUser?.email;
                  const isSuperAdmin = entry.email === 'yoyohoneysinger633@gmail.com';

                  return (
                    <tr key={entry.email} className="text-sm hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className={`${isCurrentUser ? 'text-indigo-300 font-semibold' : 'text-slate-200'}`}>
                            {entry.email}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] text-indigo-400 font-medium">Logged In Current Session</span>
                          )}
                          {isSuperAdmin && (
                            <span className="text-[10px] text-amber-400 font-medium">Bootstrapped Root Super Admin</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          entry.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : entry.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs">
                        <div className="flex flex-col">
                          <span>{formatDate(entry.addedAt)}</span>
                          <span className="text-[10px] text-slate-500">By: {entry.addedBy}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Set active */}
                          {entry.status !== 'active' && !isSuperAdmin && !isCurrentUser && (
                            <button
                              id={`promote-user-btn-${entry.email}`}
                              onClick={() => handleStatusChange(entry.email, 'active')}
                              className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/20"
                              title="Set Active"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Set banned */}
                          {entry.status !== 'banned' && !isSuperAdmin && !isCurrentUser && (
                            <button
                              id={`demote-user-btn-${entry.email}`}
                              onClick={() => handleStatusChange(entry.email, 'banned')}
                              className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded border border-rose-500/20"
                              title="Ban User"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Expunge */}
                          <button
                            id={`expunge-user-btn-${entry.email}`}
                            disabled={isCurrentUser || isSuperAdmin}
                            onClick={() => handleDeleteWhitelist(entry.email)}
                            className="p-1 bg-white/5 hover:bg-rose-500/35 text-slate-500 hover:text-white rounded border border-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Remove from Whitelist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
