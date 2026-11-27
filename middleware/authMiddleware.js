const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1]?.trim();
  }

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({
      success: false,
      code: "NO_TOKEN",
      message: "Not authorized, no authentication token provided",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "super_secret_jwt_key_little_sunbeam_2026_secure"
    );

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User belonging to this token no longer exists",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DEACTIVATED",
        message: "Your user account has been deactivated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Session expired. Please log in again.",
      });
    }

    console.warn("[AuthMiddleware] Invalid token:", error.message);
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Not authorized, invalid authentication token",
    });
  }
};

module.exports = { protect };
