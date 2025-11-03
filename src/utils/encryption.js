const crypto = require('crypto');
const config = require('../../config/environment');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// CRITICAL FIX: Better key handling with validation
function getEncryptionKey() {
  if (!config.ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY is not set in environment');
    throw new Error('ENCRYPTION_KEY is required but not set');
  }
  
  // CRITICAL: Handle different key formats
  let keyBuffer;
  
  if (config.ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(config.ENCRYPTION_KEY)) {
    // Key is already 32 bytes in hex format
    keyBuffer = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    console.log('🔑 Using hex encryption key');
  } else {
    // Key is a string, hash it to get 32 bytes
    keyBuffer = crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest();
    console.log('🔑 Using hashed string encryption key');
  }
  
  // Validate key length
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid key length: ${keyBuffer.length} bytes (expected 32)`);
  }
  
  return keyBuffer;
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
    
    console.log(`🔐 Encryption successful. Original: ${text.substring(0, 10)}... → Encrypted: ${result.substring(0, 20)}...`);
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
  
  // CRITICAL FIX: Check if it's already decrypted (plain token)
  if (encryptedText.includes(':') === false) {
    console.log('🔓 Text appears to be already decrypted, returning as-is');
    return encryptedText;
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
    
    console.log(`🔓 Decryption successful: ${decrypted.substring(0, 10)}...`);
    return decrypted;
    
  } catch (error) {
    console.error('❌ Decryption error:', error.message);
    console.error('💡 Encrypted text sample:', encryptedText ? `${encryptedText.substring(0, 30)}...` : 'empty');
    return null;
  }
}

// CRITICAL: Add method to check if encryption is working
function isEncryptionWorking() {
  try {
    const testText = 'test_bot_token_123456';
    console.log('🧪 Testing encryption system...');
    
    const encrypted = encrypt(testText);
    if (!encrypted) {
      console.error('❌ Encryption test failed - encryption returned null');
      return false;
    }
    
    const decrypted = decrypt(encrypted);
    if (decrypted === testText) {
      console.log('✅ Encryption test PASSED');
      return true;
    } else {
      console.error('❌ Encryption test failed - decrypted text does not match');
      console.error(`Expected: ${testText}, Got: ${decrypted}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Encryption test error:', error.message);
    return false;
  }
}

module.exports = { 
  encrypt, 
  decrypt, 
  isEncryptionWorking,
  getEncryptionKey 
};