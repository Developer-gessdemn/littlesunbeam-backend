const jwt = require("jsonwebtoken");

const generateToken = (id, role = "user") => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || "super_secret_jwt_key_little_sunbeam_2026_secure",
    {
      expiresIn: process.env.JWT_EXPIRE || "30d",
    }
  );
};

module.exports = generateToken;
