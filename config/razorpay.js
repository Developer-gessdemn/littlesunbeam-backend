const Razorpay = require("razorpay");

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_TTYFrGlH8NWdDV";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "HgY9N9qekQtjTsmchnkj4Eql";

  return new Razorpay({
    key_id,
    key_secret,
  });
};

module.exports = {
  getRazorpayInstance,
};
