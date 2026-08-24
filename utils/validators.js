const mongoose = require("mongoose");

const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

const isValidPhone = (phone) => {
  if (!phone) return true; // Phone can be optional or validated if provided
  const re = /^[0-9+\-\s()]{7,15}$/;
  return re.test(String(phone).trim());
};

const isValidPincode = (pincode) => {
  if (!pincode) return true;
  const re = /^[0-9a-zA-Z\s\-]{3,10}$/;
  return re.test(String(pincode).trim());
};

const isValidObjectId = (id) => {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPincode,
  isValidObjectId,
};
