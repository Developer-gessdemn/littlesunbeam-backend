const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Razorpay = require('razorpay');

async function listPayments() {
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  console.log('Using Key ID:', process.env.RAZORPAY_KEY_ID);

  try {
    const payments = await instance.payments.all({ count: 15 });
    console.log('Total Payments in Razorpay Account:', payments.count);
    console.log('Payments:', JSON.stringify(payments.items.map(p => ({
      id: p.id,
      order_id: p.order_id,
      amount: p.amount,
      status: p.status,
      email: p.email,
      contact: p.contact,
      created_at: new Date(p.created_at * 1000).toISOString(),
      notes: p.notes,
      method: p.method
    })), null, 2));
  } catch (err) {
    console.error('Razorpay list error:', err);
  }
}

listPayments();
