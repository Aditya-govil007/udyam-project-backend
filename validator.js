// validator.js
const validate = (data) => {
  const { aadhaarNumber, panNumber } = data;
  
  if (!aadhaarNumber || aadhaarNumber.length !== 12 || isNaN(aadhaarNumber)) {
    return 'Invalid Aadhaar number';
  }
  
  if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
    return 'Invalid PAN number';
  }
  
  return null; // Return null if validation passes
};

module.exports = { validate };