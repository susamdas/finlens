/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'static' | 'api'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ANALYST_PROVIDER?: 'rules' | 'proxy'
  readonly VITE_ANALYST_PROXY_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
