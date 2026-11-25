const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { isValidEmail } = require("../utils/validators");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/emailService");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, phone number, and password",
      });
    }

    const cleanPhone = String(phone || "").trim();
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : "",
      password,
    });

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    const identifier = (email || phone || "").trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      });
    }

    let user;
    if (/^\d{10}$/.test(identifier)) {
      user = await User.findOne({ phone: identifier }).select("+password");
    } else {
      user = await User.findOne({ email: identifier.toLowerCase() }).select("+password");
    }

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated. Please contact support.",
      });
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Current user profile fetched successfully",
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - send OTP to email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const rawInput = (req.body.email || req.body.identifier || req.body.phone || "").trim();

    if (!rawInput) {
      return res.status(400).json({
        success: false,
        message: "Please enter your registered email address or mobile number",
      });
    }

    let user = null;
    if (/^\d{10}$/.test(rawInput)) {
      user = await User.findOne({ phone: rawInput }).select("+resetPasswordToken +resetPasswordExpire +resetPasswordLastSent");
    } else if (isValidEmail(rawInput)) {
      user = await User.findOne({ email: rawInput.toLowerCase() }).select("+resetPasswordToken +resetPasswordExpire +resetPasswordLastSent");
    } else {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address or 10-digit mobile number",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email or mobile number. Please check and try again.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "No email address linked to this account to receive OTP. Please contact support.",
      });
    }

    // 60-second resend cooldown
    if (user.resetPasswordLastSent) {
      const secondsSinceLast = (Date.now() - new Date(user.resetPasswordLastSent).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        const remaining = Math.ceil(60 - secondsSinceLast);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting another OTP.`,
          retryAfter: remaining,
        });
      }
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP and store with expiry (5 minutes)
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.resetPasswordToken = hashedOtp;
    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000; // 5 minutes
    user.resetPasswordLastSent = new Date();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    const emailResult = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      otp,
    });

    if (!emailResult.success) {
      // Clear the token if email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      console.error("[forgotPassword] Email send error:", emailResult.error);

      // Give a user-friendly message for domain verification issues
      const isDomainError = emailResult.error && (
        emailResult.error.includes("not verified") ||
        emailResult.error.includes("domain") ||
        emailResult.error.includes("testing emails")
      );
      return res.status(500).json({
        success: false,
        message: isDomainError
          ? "Email delivery is temporarily unavailable. Please contact support at littlesunbeamkidswear@gmail.com or WhatsApp +91 90255 59837."
          : "Failed to send OTP email. Please try again later.",
      });
    }

    // Mask recipient email for privacy (e.g. j***e@gmail.com)
    const [uName, domain] = user.email.split("@");
    const maskedUser = uName.length > 2 ? `${uName[0]}***${uName[uName.length - 1]}` : `${uName[0]}***`;
    const maskedEmail = `${maskedUser}@${domain}`;

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${maskedEmail}. Check your inbox — valid for 5 minutes.`,
      data: {
        email: user.email,
        maskedEmail,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for password reset
// @route   POST /api/auth/verify-reset-otp
// @access  Public
const verifyResetOtp = async (req, res, next) => {
  try {
    const rawInput = (req.body.email || req.body.identifier || req.body.phone || "").trim();
    const { otp } = req.body;

    if (!rawInput || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and OTP",
      });
    }

    if (!/^\d{6}$/.test(otp.toString().trim())) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp.toString().trim()).digest("hex");

    let query = {
      resetPasswordToken: hashedOtp,
      resetPasswordExpire: { $gt: Date.now() },
    };

    if (/^\d{10}$/.test(rawInput)) {
      query.phone = rawInput;
    } else {
      query.email = rawInput.toLowerCase();
    }

    const user = await User.findOne(query).select("+resetPasswordToken +resetPasswordExpire");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    // OTP is valid — generate a temporary reset token for the final step (10 mins)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully! Please set your new password.",
      data: {
        resetToken,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const rawInput = (req.body.email || req.body.identifier || req.body.phone || "").trim();
    const { resetToken, password, confirmPassword } = req.body;

    if (!rawInput || !resetToken || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, reset token, and new password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const hashedResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    let query = {
      resetPasswordToken: hashedResetToken,
      resetPasswordExpire: { $gt: Date.now() },
    };

    if (/^\d{10}$/.test(rawInput)) {
      query.phone = rawInput;
    } else {
      query.email = rawInput.toLowerCase();
    }

    const user = await User.findOne(query).select("+resetPasswordToken +resetPasswordExpire +password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please start the process again.",
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Auto-login: generate a fresh JWT
    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: "Password reset successful! You are now logged in.",
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
