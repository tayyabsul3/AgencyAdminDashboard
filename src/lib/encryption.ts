import CryptoJS from "crypto-js";


const ALGORITHM = CryptoJS.lib.Cipher;

export const encryptString = (plaintext: string, secretKey: string): string => {
  if (!secretKey) {
    console.error("Encryption failed: Secret key is required.");
    return plaintext; 
  }
  try {
    const encrypted = CryptoJS.AES.encrypt(plaintext, secretKey);
    return encrypted.toString();
  } catch (e) {
    console.error("CryptoJS Encryption Error:", e);
    return plaintext;
  }
};


export const decryptString = (ciphertext: string, secretKey: string): string => {
  if (!secretKey) {
    return "Error: Secret Key Missing";
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!plaintext || plaintext.startsWith("U2FsdGVkX")) {
        return "Decryption Failed: Incorrect Key or Data Corrupted";
    }

    return plaintext;
  } catch (e) {
    console.error("CryptoJS Decryption Error:", e);
    return "Decryption Error";
  }
};