/**
 * Client-side RSA-OAEP encryption for passwords.
 * Uses node-forge (works on HTTP and HTTPS — no secure-context requirement).
 * Matches backend: RSA-OAEP + SHA-256, base64 ciphertext.
 */
import forge from 'node-forge'

export async function encryptPassword(password: string, publicKeyPem: string): Promise<string> {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem)
  const encrypted = publicKey.encrypt(forge.util.encodeUtf8(password), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha256.create(),
    },
  })
  return forge.util.encode64(encrypted)
}
