const Razorpay = require("razorpay");

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || "rzp_live_TaDwCOE6e7ioNi";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "z4xxsShuvwDSTyrj8iZvBQg6";

  return new Razorpay({
    key_id,
    key_secret,
  });
};

module.exports = {
  getRazorpayInstance,
};
