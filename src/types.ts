export interface PdfMetadata {
  id: string;
  title: string;
  subject: string;
  description: string;
  fileUrl: string;
  pdfUrl?: string; // Standard URL for Supabase
  storagePath?: string; // Unique file path in Supabase Storage
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | any;
}

export interface WhitelistEntry {
  email: string;
  status: 'active' | 'pending' | 'banned';
  addedAt: {
    seconds: number;
    nanoseconds: number;
  } | any;
  addedBy: string;
}

export interface Lecture {
  id: string;
  title: string;
  subject: string;
  videoUrl: string;
  thumbnail?: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | any;
  uploadedBy?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | any;
  uploadedBy?: string;
}

export type ViewType = 'dashboard' | 'portal' | 'upload' | 'manage' | 'lectures' | 'announcements' | 'users';
