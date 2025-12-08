/**
 * Encryption utilities for Next.js
 *
 * This module provides encryption/decryption functions using Web Crypto API.
 * Uses AES-256-GCM algorithm - same as Convex backend.
 */

/**
 * Get the encryption key from environment variables
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Add it to your .env.local file'
    );
  }
  return key;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted data with IV prepended (format: iv:ciphertext)
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    const encryptionKey = getEncryptionKey();

    // Decode the base64 key
    const keyData = base64ToBytes(encryptionKey);

    // Verify key length (should be 32 bytes for AES-256)
    if (keyData.length !== 32) {
      throw new Error(`Invalid key length: ${keyData.length} bytes (expected 32 bytes for AES-256)`);
    }

    // Import the key for AES-GCM encryption
    const key = await crypto.subtle.importKey(
      'raw',
      keyData.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate a random 12-byte IV (recommended for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Convert plaintext to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt the data
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      data
    );

    // Combine IV and ciphertext, then encode as base64
    const ivBase64 = bytesToBase64(iv);
    const ciphertextBase64 = bytesToBase64(new Uint8Array(ciphertext));

    return `${ivBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Encryption error details:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
    throw new Error('Failed to encrypt data: Unknown error');
  }
}

/**
 * Decrypt a string that was encrypted with the encrypt function
 *
 * @param encryptedData - Base64-encoded encrypted data (format: iv:ciphertext)
 * @returns The decrypted plaintext string
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const encryptionKey = getEncryptionKey();

    // Decode the base64 key
    const keyData = base64ToBytes(encryptionKey);

    // Verify key length
    if (keyData.length !== 32) {
      throw new Error(`Invalid key length: ${keyData.length} bytes (expected 32 bytes for AES-256)`);
    }

    // Import the key for AES-GCM decryption
    const key = await crypto.subtle.importKey(
      'raw',
      keyData.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Split the IV and ciphertext
    const [ivBase64, ciphertextBase64] = encryptedData.split(':');

    if (!ivBase64 || !ciphertextBase64) {
      throw new Error('Invalid encrypted data format (expected format: iv:ciphertext)');
    }

    // Decode from base64
    const iv = base64ToBytes(ivBase64);
    const ciphertext = base64ToBytes(ciphertextBase64);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    // Convert bytes back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error details:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
    throw new Error('Failed to decrypt data: Unknown error');
  }
}
