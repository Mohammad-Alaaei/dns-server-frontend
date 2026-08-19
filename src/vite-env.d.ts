/// <reference types="vite/client" />

declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}

declare const __APP_VERSION__: string
