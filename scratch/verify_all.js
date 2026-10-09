const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

  const rubinaUser = await User.findOne({ email: 'rubina@gmail.com' });
  console.log('Rubina User ID:', rubinaUser?._id);

  const rubinaOrders = await Order.find({
    $or: [
      { user: rubinaUser._id },
      { customerId: String(rubinaUser._id) },
      { 'customer.email': 'rubina@gmail.com' },
      { 'shippingAddress.email': 'rubina@gmail.com' }
    ]
  });

  console.log('=== Rubina Orders in MongoDB === Count:', rubinaOrders.length);
  rubinaOrders.forEach(o => {
    console.log({
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      orderStatus: o.orderStatus,
      razorpayPaymentId: o.razorpayPaymentId,
      razorpayOrderId: o.razorpayOrderId,
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt
    });
  });

  const totalOrders = await Order.countDocuments();
  console.log('=== Total Orders in MongoDB ===', totalOrders);

  await mongoose.disconnect();
}
verify().catch(console.error);
