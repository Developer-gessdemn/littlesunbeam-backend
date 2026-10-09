const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function check() {
  console.log('URI:', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  
  const rubinaUser = await User.find({ email: /rubina/i });
  console.log('=== Rubina User in DB ===');
  console.log(JSON.stringify(rubinaUser, null, 2));

  const ordersWithRubina = await Order.find({ 
    $or: [
      { 'customer.email': /rubina/i },
      { 'shippingAddress.email': /rubina/i },
      { razorpayPaymentId: /TIM2XvILAVhGcv/i },
      { razorpayOrderId: /TIM2A1gJvw7bOa/i },
      { 'paymentDetails.transactionId': /TIM2XvILAVhGcv/i }
    ] 
  });
  console.log('=== Rubina Orders in DB ===');
  console.log(JSON.stringify(ordersWithRubina, null, 2));

  const allOrders = await Order.find({}).sort({ createdAt: -1 });
  console.log('=== All Orders Count ===', allOrders.length);
  console.log(JSON.stringify(allOrders.map(o => ({
    _id: o._id,
    orderNumber: o.orderNumber,
    customer: o.customer,
    shippingAddress: o.shippingAddress,
    totalAmount: o.totalAmount,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    razorpayOrderId: o.razorpayOrderId,
    razorpayPaymentId: o.razorpayPaymentId,
    createdAt: o.createdAt
  })), null, 2));
  
  await mongoose.disconnect();
}
check().catch(console.error);
