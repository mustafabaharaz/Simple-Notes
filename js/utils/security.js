/* ============================================
   SECURITY.JS - Encryption & Security Functions
   ============================================ */

// Simple XOR encryption (for basic privacy)
function simpleEncrypt(text, password) {
  if (!text || !password) return text;
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ password.charCodeAt(i % password.length)
    );
  }
  return btoa(result); // Base64 encode
}

// Simple XOR decryption
function simpleDecrypt(encrypted, password) {
  if (!encrypted || !password) return encrypted;
  
  try {
    const decoded = atob(encrypted); // Base64 decode
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ password.charCodeAt(i % password.length)
      );
    }
    return result;
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}

// Advanced encryption using CryptoJS (if available)
function advancedEncrypt(text, password) {
  if (typeof CryptoJS === 'undefined') {
    console.warn('CryptoJS not loaded, falling back to simple encryption');
    return simpleEncrypt(text, password);
  }
  
  try {
    return CryptoJS.AES.encrypt(text, password).toString();
  } catch (e) {
    console.error('Advanced encryption failed:', e);
    return simpleEncrypt(text, password);
  }
}

// Advanced decryption using CryptoJS
function advancedDecrypt(encrypted, password) {
  if (typeof CryptoJS === 'undefined') {
    return simpleDecrypt(encrypted, password);
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Advanced decryption failed:', e);
    return simpleDecrypt(encrypted, password);
  }
}

// Hash password (for verification)
function hashPassword(password) {
  if (typeof CryptoJS !== 'undefined') {
    return CryptoJS.SHA256(password).toString();
  }
  // Simple hash fallback
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Sanitize HTML (using DOMPurify if available)
function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
      ALLOWED_ATTR: []
    });
  }
  
  // Basic sanitization fallback
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

// Check password strength
function checkPasswordStrength(password) {
  let strength = 0;
  const feedback = [];
  
  if (password.length >= 8) strength++;
  else feedback.push('Use at least 8 characters');
  
  if (/[a-z]/.test(password)) strength++;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) strength++;
  else feedback.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) strength++;
  else feedback.push('Add numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  else feedback.push('Add special characters');
  
  const levels = ['weak', 'weak', 'fair', 'good', 'strong', 'very-strong'];
  
  return {
    level: levels[strength],
    strength: strength,
    feedback: feedback
  };
}

console.log('✅ Security utilities loaded');