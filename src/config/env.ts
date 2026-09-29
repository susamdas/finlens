/**
 * Typed, validated access to build-time environment variables.
 * UI and business logic read configuration from here, never from import.meta.env directly.
 */
export type DataSource = 'static' | 'api'
export type AnalystProviderKind = 'rules' | 'proxy'

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export const env = {
  dataSource: oneOf<DataSource>(import.meta.env.VITE_DATA_SOURCE, ['static', 'api'], 'static'),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  analystProvider: oneOf<AnalystProviderKind>(
    import.meta.env.VITE_ANALYST_PROVIDER,
    ['rules', 'proxy'],
    'rules',
  ),
  analystProxyUrl: import.meta.env.VITE_ANALYST_PROXY_URL ?? '',
} as const
