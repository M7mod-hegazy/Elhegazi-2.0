import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Random Arabic names
const firstNames = [
  'محمد', 'أحمد', 'علي', 'حسن', 'عمر', 'خالد', 'سعيد', 'عبدالله', 'يوسف', 'إبراهيم',
  'فاطمة', 'عائشة', 'خديجة', 'مريم', 'زينب', 'سارة', 'نور', 'ليلى', 'هدى', 'أمل'
];

const lastNames = [
  'أحمد', 'محمد', 'علي', 'حسن', 'السيد', 'عبدالرحمن', 'الشريف', 'المصري', 'العربي', 'الدين',
  'سالم', 'كامل', 'فهمي', 'رشيد', 'جمال', 'كريم', 'حسين', 'عثمان', 'طه', 'صالح'
];

// Generate random data
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomName() {
  return `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
}

function generateRandomEmail(name) {
  const username = name.replace(/\s+/g, '').toLowerCase();
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  return `${username}${Math.floor(Math.random() * 1000)}@${getRandomElement(domains)}`;
}

function generateRandomPhone() {
  const prefixes = ['050', '053', '054', '055', '056', '058', '059'];
  const prefix = getRandomElement(prefixes);
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `+966${prefix}${number}`;
}

async function migrateOrders() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arabian-blue-bloom');
    console.log('✅ Connected to MongoDB');

    const Order = mongoose.model('Order');
    
    console.log('🔍 Finding orders without customer info...');
    const orders = await Order.find({
      $or: [
        { 'shippingAddress.name': { $exists: false } },
        { 'shippingAddress.name': null },
        { 'shippingAddress.name': '' }
      ]
    });

    console.log(`📦 Found ${orders.length} orders to update`);

    let updated = 0;
    for (const order of orders) {
      const name = generateRandomName();
      const email = generateRandomEmail(name);
      const phone = generateRandomPhone();

      // Update shipping address
      if (!order.shippingAddress) {
        order.shippingAddress = {};
      }
      
      order.shippingAddress.name = name;
      order.shippingAddress.email = email;
      order.shippingAddress.phone = phone;

      // Update billing address if it exists
      if (order.billingAddress && typeof order.billingAddress === 'object') {
        order.billingAddress.name = name;
        order.billingAddress.email = email;
        order.billingAddress.phone = phone;
      }

      await order.save();
      updated++;
      
      console.log(`✅ Updated order ${order.orderNumber || order._id}: ${name} - ${email} - ${phone}`);
    }

    console.log(`\n🎉 Migration completed! Updated ${updated} orders.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateOrders();
