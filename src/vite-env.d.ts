/// <reference types="vite/client" />

declare module 'virtual:founder-source-vault' {
  export interface FounderSourceVaultPayload {
    textFiles: Record<string, string>;
    imageFiles: string[];
    baseGddText: string;
    marketAddendumText: string;
    generatedAt: string;
  }

  const vaultPayload: FounderSourceVaultPayload;
  export default vaultPayload;
}
