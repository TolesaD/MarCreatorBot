const crypto = require('crypto');
const config = require('../../config/environment');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const TAG_LENGTH = 16; // 16 bytes for GCM auth tag

// Simple key derivation - use the ENCRYPTION_KEY directly as 32 bytes
function getEncryptionKey() {
  if (!config.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set in environment');
  }
  
  // If key is already 32 bytes hex, use it directly
  if (config.ENCRYPTION_KEY.length === 64) {
    return Buffer.from(config.ENCRYPTION_KEY, 'hex');
  }
  
  // Otherwise, hash it to get 32 bytes
  return crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest();
}

function encrypt(text) {
  if (!text) {
    console.error('❌ Cannot encrypt empty text');
    return null;
  }
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv_hex:authTag_hex:encrypted_hex
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    console.log(`🔐 Encryption successful. IV: ${iv.toString('hex').substring(0, 8)}...`);
    return result;
    
  } catch (error) {
    console.error('❌ Encryption error:', error.message);
    return null;
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) {
    console.error('❌ Cannot decrypt empty text');
    return null;
  }
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid encrypted text format. Expected 3 parts, got ${parts.length}`);
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    // Validate hex strings
    if (ivHex.length !== 32) throw new Error(`Invalid IV length: ${ivHex.length}`);
    if (authTagHex.length !== 32) throw new Error(`Invalid auth tag length: ${authTagHex.length}`);
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log(`🔓 Decryption successful`);
    return decrypted;
    
  } catch (error) {
    console.error('❌ Decryption error:', error.message);
    console.error('💡 Encrypted text format:', encryptedText ? `${encryptedText.substring(0, 50)}...` : 'empty');
    return null;
  }
}

// Test function to verify encryption is working
function testEncryption() {
  const testText = 'test_token_123';
  console.log('🧪 Testing encryption...');
  
  const encrypted = encrypt(testText);
  if (!encrypted) {
    console.error('❌ Encryption test failed');
    return false;
  }
  
  const decrypted = decrypt(encrypted);
  if (decrypted === testText) {
    console.log('✅ Encryption test passed');
    return true;
  } else {
    console.error('❌ Encryption test failed - decrypted text does not match');
    return false;
  }
}

module.exports = { encrypt, decrypt, testEncryption };