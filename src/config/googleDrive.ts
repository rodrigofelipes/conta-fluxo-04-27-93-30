export interface GoogleDriveConfig {
  serviceAccountTokenFunction: string;
  rootFolderId?: string;
  cacheTokenMs: number;
}

export const googleDriveConfig: GoogleDriveConfig = {
  serviceAccountTokenFunction: 'google-drive-token',
  rootFolderId: import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID,
  cacheTokenMs: Number(import.meta.env.VITE_GOOGLE_DRIVE_TOKEN_CACHE_MS ?? 50_000),
};
