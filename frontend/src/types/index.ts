// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
  avatar?: string;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export interface Gallery {
  id: string;
  name: string;
  description?: string;
  coverPhoto?: Photo;
  previewPhotos?: Pick<Photo, 'id' | 'thumbnailUrl' | 'watermarkedUrl' | 'width' | 'height'>[];
  photoCount: number;
  clientId: string;
  client?: Pick<User, 'id' | 'name' | 'email'>;
  isPublic: boolean;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryCreate {
  name: string;
  description?: string;
  isPublic?: boolean;
  clientId?: string;  // Required when admin creates gallery for a client
}

// ─── Photo ───────────────────────────────────────────────────────────────────

export type PhotoStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Photo {
  id: string;
  galleryId: string;
  galleryName?: string;
  filename: string;
  originalUrl: string;
  watermarkedUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  status: PhotoStatus;
  isPurchased: boolean;
  isFavorited: boolean;
  tags?: string[];
  metadata?: PhotoMetadata;
  createdAt: string;
}

export interface PhotoMetadata {
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutterSpeed?: string;
  focalLength?: string;
  takenAt?: string;
  location?: string;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  photoId?: string;
  error?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

// ─── Download ────────────────────────────────────────────────────────────────

export interface SignedDownloadUrl {
  url: string;
  expiresAt: string;
  filename: string;
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface ModalState {
  isOpen: boolean;
  photoIndex: number | null;
  photos: Photo[];
}

export type Theme = 'dark' | 'light';

export interface FilterState {
  search: string;
  status?: PhotoStatus;
  sortBy: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
}