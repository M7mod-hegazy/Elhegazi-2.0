import Order from '../models/Order.js';

class OrderAutomationService {
  constructor() {
    this.statusTransitions = {
      pending: { next: 'confirmed', delay: 2 * 60 * 1000 }, // 2 minutes for testing
      confirmed: { next: 'processing', delay: 5 * 60 * 1000 }, // 5 minutes for testing
      processing: { next: 'shipped', delay: 10 * 60 * 1000 }, // 10 minutes for testing
      shipped: { next: 'out_for_delivery', delay: 15 * 60 * 1000 }, // 15 minutes for testing
      out_for_delivery: { next: 'delivered', delay: 20 * 60 * 1000 } // 20 minutes for testing
    };
  }

  // Check and progress orders that are due for status change
  async checkAndProgressOrders() {
    try {
      const now = new Date();
      const ordersToProgress = await Order.find({
        status: { $in: Object.keys(this.statusTransitions) },
        createdAt: { $lt: now }
      });

      for (const order of ordersToProgress) {
        await this.progressOrderStatus(order);
      }

      console.log(`✅ Checked ${ordersToProgress.length} orders for status progression`);
      return { success: true, processed: ordersToProgress.length };
    } catch (error) {
      console.error('❌ Error checking order status progression:', error);
      return { success: false, error: error.message };
    }
  }

  // Progress a single order's status if conditions are met
  async progressOrderStatus(order) {
    try {
      const transition = this.statusTransitions[order.status];
      if (!transition) return;

      // Calculate when the order should transition
      const transitionTime = new Date(order.createdAt.getTime() + transition.delay);
      const now = new Date();

      // If it's time to transition, update the status
      if (now >= transitionTime) {
        order.status = transition.next;
        await order.save();
        console.log(`🔄 Order ${order._id} progressed from ${order.status} to ${transition.next}`);
      }
    } catch (error) {
      console.error(`❌ Error progressing order ${order._id}:`, error);
    }
  }

  // Schedule regular checks
  startAutomation() {
    // Check every minute
    setInterval(() => {
      this.checkAndProgressOrders();
    }, 60 * 1000);
    
    console.log('🔄 Order automation service started');
  }
}

// Create singleton instance
const orderAutomationService = new OrderAutomationService();

export default orderAutomationService;