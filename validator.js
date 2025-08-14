// validator.js
const validate = (data) => {
  const { aadhaarNumber, panNumber } = data;

  // Aadhaar validation only in production
  if (process.env.NODE_ENV === 'production') {
    if (!aadhaarNumber || aadhaarNumber.length !== 12 || isNaN(aadhaarNumber)) {
      return 'Invalid Aadhaar number';
    }
  }

  // PAN validation (always active)
  if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
    return 'Invalid PAN number';
  }

  return null; // Return null if validation passes
};

module.exports = { validate };
