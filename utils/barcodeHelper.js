/**
 * Calculates EAN-13 checksum digit for a 12-digit prefix.
 * @param {string} prefix 12-digit string
 * @returns {number} 13th digit (0-9), or -1 if invalid
 */
function calculateEan13Checksum(prefix) {
  if (!prefix || prefix.length !== 12 || !/^\d{12}$/.test(prefix)) return -1;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(prefix[i], 10);
    // Position weights: odd positions (weight 1), even positions (weight 3)
    // 0-indexed: index 0 (1st position - weight 1), index 1 (2nd position - weight 3), etc.
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validates if a barcode is a valid EAN-13 code.
 * @param {string} barcode 
 * @returns {boolean}
 */
function isValidEan13(barcode) {
  if (!barcode || typeof barcode !== 'string') return false;
  if (!/^\d{13}$/.test(barcode)) return false;
  const prefix = barcode.slice(0, 12);
  const checksum = parseInt(barcode[12], 10);
  const calculated = calculateEan13Checksum(prefix);
  return calculated !== -1 && calculated === checksum;
}

/**
 * Generates a unique 13-digit EAN-13 barcode prefix.
 * @returns {string} EAN-13 barcode
 */
function generateEan13() {
  // Using EAN-13 country prefix 890 (India)
  const random9 = Math.floor(100000000 + Math.random() * 900000000).toString();
  const prefix = '890' + random9;
  const checksum = calculateEan13Checksum(prefix);
  return prefix + checksum;
}

module.exports = {
  calculateEan13Checksum,
  isValidEan13,
  generateEan13
};
