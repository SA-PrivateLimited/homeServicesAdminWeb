/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EMP_REMOTE_URL?: string;
  readonly VITE_EMP_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
