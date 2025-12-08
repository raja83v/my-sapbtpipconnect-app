#!/usr/bin/env node

/**
 * Generate a secure encryption key for AES-256-GCM
 * 
 * Usage:
 *   node scripts/generate-encryption-key.js
 * 
 * This will output a base64-encoded 32-byte key suitable for use with
 * the encryption utilities in this project.
 */

const crypto = require('crypto');

// Generate a random 32-byte key (256 bits for AES-256)
const key = crypto.randomBytes(32);

// Encode as base64
const base64Key = key.toString('base64');

console.log('\n='.repeat(70));
console.log('🔐 ENCRYPTION KEY GENERATED');
console.log('='.repeat(70));
console.log('\nYour new encryption key (base64-encoded 32 bytes):');
console.log('\n' + base64Key);
console.log('\n' + '='.repeat(70));
console.log('\n📝 NEXT STEPS:\n');
console.log('1. Add to .env.local (for local development):');
console.log(`   ENCRYPTION_KEY=${base64Key}`);
console.log('\n2. Add to Convex (for backend):');
console.log(`   npx convex env set ENCRYPTION_KEY ${base64Key}`);
console.log('\n3. Add to Vercel (for production):');
console.log('   - Go to your Vercel project settings');
console.log('   - Navigate to Environment Variables');
console.log(`   - Add: ENCRYPTION_KEY = ${base64Key}`);
console.log('\n' + '='.repeat(70));
console.log('\n⚠️  IMPORTANT: Keep this key secret and secure!');
console.log('   - Never commit it to version control');
console.log('   - Use the same key in all environments');
console.log('   - If you change the key, all existing encrypted data');
console.log('     will become unreadable\n');
console.log('='.repeat(70) + '\n');