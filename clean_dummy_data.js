const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const cleanDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baby_clothing_shop';
    await mongoose.connect(mongoUri);
    console.log('[Cleanup] Connected to MongoDB at:', mongoUri);

    const User = require('./models/User');
    const Product = require('./models/Product');
    const Order = require('./models/Order');

    const dummyProductSkus = [
      'GHFT95245AAA',
      'SUN-ETH-949',
      'SUN-ETH-899',
      'SUN-ETH-699',
      'SUN-ETH-999',
      'SUN-MUS-899',
      'SUN-HOS-2499',
      'SUN-TOW-749',
    ];

    const dummyProductNames = [
      'Jorpeche Oversize Fit Blazer',
      'Ethnic Shirt - Green Kanjeevaram',
      'Ethnic Shirt - Chocolate Nisha',
      'Ethnic Shirt - Marigold Sweety',
      'Ethnic Shirt - Peacock Blue',
      'Sunny Muslin Swaddle - Pack of 3',
      'Newborn Hospital Kit - 14 Pieces',
      'Bear Ears Hooded Towel',
    ];

    const deletedProducts = await Product.deleteMany({
      $or: [
        { sku: { $in: dummyProductSkus } },
        { name: { $in: dummyProductNames } },
      ],
    });
    console.log('[Cleanup] Deleted ' + deletedProducts.deletedCount + ' dummy products.');

    const dummyUserEmails = [
      'priya@example.com',
      'customer@littlesunbeam.com',
      'user@example.com',
    ];

    const deletedUsers = await User.deleteMany({
      email: { $in: dummyUserEmails },
      role: 'user',
    });
    console.log('[Cleanup] Deleted ' + deletedUsers.deletedCount + ' dummy users.');

    const dummyOrderNumbers = ['ORD-94281', 'ORD-94282', 'ORD-94280', 'ORD-94279'];
    const deletedOrders = await Order.deleteMany({
      orderNumber: { $in: dummyOrderNumbers },
    });
    console.log('[Cleanup] Deleted ' + deletedOrders.deletedCount + ' dummy orders.');

    const remainingProducts = await Product.find({}, 'name sku price');
    const remainingUsers = await User.find({}, 'name email role');
    const remainingOrders = await Order.find({}, 'orderNumber totalAmount user').populate('user', 'name email');

    console.log('\n--- REMAINING REAL DATABASE DATA ---');
    console.log('Real Products Count:', remainingProducts.length, remainingProducts);
    console.log('Real Users Count:', remainingUsers.length, remainingUsers);
    console.log('Real Orders Count:', remainingOrders.length, remainingOrders);
    console.log('------------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('[Cleanup Error]:', error.message);
    process.exit(1);
  }
};

cleanDatabase();
