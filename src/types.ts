export interface PdfMetadata {
  id: string;
  title: string;
  subject: string;
  description: string;
  fileUrl: string;
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

export type ViewType = 'dashboard' | 'upload' | 'manage' | 'users';
