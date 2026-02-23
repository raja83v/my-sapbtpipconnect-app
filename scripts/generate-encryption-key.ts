import crypto from "crypto";

// Generate a 32-byte (256-bit) key for AES-256-GCM encryption
const key = crypto.randomBytes(32).toString("base64");
console.log("Generated ENCRYPTION_KEY (add to .env.local):");
console.log(`ENCRYPTION_KEY=${key}`);
console.log("");

// Also generate a JWT secret
const jwtSecret = crypto.randomBytes(64).toString("hex");
console.log("Generated JWT_SECRET (add to .env.local):");
console.log(`JWT_SECRET=${jwtSecret}`);
console.log("");

// Generate a CRON_SECRET
const cronSecret = crypto.randomBytes(32).toString("hex");
console.log("Generated CRON_SECRET (add to .env.local):");
console.log(`CRON_SECRET=${cronSecret}`);
