const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getAllUsers, getAllOrders } = require('../controllers/adminController');

async function testAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Test getAllUsers
  const reqUsers = { query: {} };
  const resUsers = {
    status: (code) => ({
      json: (data) => {
        const rubina = (data.data?.users || []).find(u => u.email === 'rubina@gmail.com');
        console.log('=== Rubina Admin Users Summary ===');
        console.log({
          name: rubina?.name,
          email: rubina?.email,
          ordersCount: rubina?.ordersCount,
          totalSpent: rubina?.totalSpent,
          shippingAddress: rubina?.shippingAddress,
          orders: rubina?.orders
        });
      }
    })
  };
  await getAllUsers(reqUsers, resUsers, console.error);

  // Test getAllOrders
  const reqOrders = { query: { all: 'true' } };
  const resOrders = {
    status: (code) => ({
      json: (data) => {
        const rubinaOrder = (data.data?.orders || []).find(o => o.razorpayPaymentId === 'pay_TlM2XvlLAVhGcv');
        console.log('=== Rubina Admin Orders Entry ===');
        console.log({
          orderNumber: rubinaOrder?.orderNumber,
          customer: rubinaOrder?.customer,
          totalAmount: rubinaOrder?.totalAmount,
          paymentStatus: rubinaOrder?.paymentStatus,
          paymentMethod: rubinaOrder?.paymentMethod,
          razorpayPaymentId: rubinaOrder?.razorpayPaymentId,
          razorpayOrderId: rubinaOrder?.razorpayOrderId,
          createdAt: rubinaOrder?.createdAt
        });
      }
    })
  };
  await getAllOrders(reqOrders, resOrders, console.error);

  await mongoose.disconnect();
}

testAdmin().catch(console.error);
