const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Razorpay = require('razorpay');

async function testRazorpay() {
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    console.log('Fetching payment pay_TIM2XvILAVhGcv...');
    const payment = await instance.payments.fetch('pay_TIM2XvILAVhGcv');
    console.log('Payment details:', JSON.stringify(payment, null, 2));

    if (payment.order_id) {
      console.log('Fetching Razorpay order:', payment.order_id);
      const rzpOrder = await instance.orders.fetch(payment.order_id);
      console.log('Order details:', JSON.stringify(rzpOrder, null, 2));
    }
  } catch (err) {
    console.error('Razorpay fetch error:', err);
  }
}

testRazorpay();
