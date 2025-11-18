import emailService from './emailService.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

class OrderEmailService {
  
  async sendOrderConfirmation(orderId) {
    try {
      const order = await Order.findById(orderId).populate('items.product');
      if (!order) {
        throw new Error('Order not found');
      }

      const customer = await User.findById(order.userId);
      if (!customer || !customer.email) {
        throw new Error('Customer email not found');
      }

      // Check if confirmation email already sent
      if (order.emailNotifications?.confirmation?.sent) {
        console.log(`Order confirmation email already sent for order ${order.orderNumber}`);
        return { success: true, alreadySent: true };
      }

      const orderData = {
        customer: {
          name: customer.name || customer.email.split('@')[0],
          email: customer.email
        },
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          createdAt: order.createdAt,
          status: order.status
        },
        items: order.items || []
      };

      const result = await emailService.sendOrderConfirmation(orderData);
      
      if (result.success) {
        // Update order with email notification info
        await Order.findByIdAndUpdate(orderId, {
          $set: {
            'emailNotifications.confirmation.sent': true,
            'emailNotifications.confirmation.sentAt': new Date(),
            'emailNotifications.confirmation.messageId': result.messageId
          }
        });
        
        console.log(`✅ Order confirmation email sent for order ${order.orderNumber}`);
      }

      return result;
    } catch (error) {
      console.error('Failed to send order confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderStatusUpdate(orderId, newStatus, additionalData = {}) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const customer = await User.findById(order.userId);
      if (!customer || !customer.email) {
        throw new Error('Customer email not found');
      }

      // Check if this status email was already sent
      const statusKey = this.getStatusEmailKey(newStatus);
      if (statusKey && order.emailNotifications?.[statusKey]?.sent) {
        console.log(`Order ${newStatus} email already sent for order ${order.orderNumber}`);
        return { success: true, alreadySent: true };
      }

      const orderData = {
        customer: {
          name: customer.name || customer.email.split('@')[0],
          email: customer.email
        },
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: newStatus,
          trackingNumber: order.trackingNumber || additionalData.trackingNumber,
          estimatedDelivery: order.estimatedDelivery || additionalData.estimatedDelivery
        }
      };

      const result = await emailService.sendOrderStatusUpdate(orderData, newStatus);
      
      if (result.success && statusKey) {
        // Update order with email notification info
        const updateData = {
          [`emailNotifications.${statusKey}.sent`]: true,
          [`emailNotifications.${statusKey}.sentAt`]: new Date(),
          [`emailNotifications.${statusKey}.messageId`]: result.messageId
        };
        
        await Order.findByIdAndUpdate(orderId, { $set: updateData });
        console.log(`✅ Order ${newStatus} email sent for order ${order.orderNumber}`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to send order ${newStatus} email:`, error);
      return { success: false, error: error.message };
    }
  }

  getStatusEmailKey(status) {
    const statusMap = {
      'shipped': 'shipped',
      'delivered': 'delivered'
    };
    return statusMap[status];
  }

  async sendOrderShipped(orderId, trackingData = {}) {
    const additionalData = {
      trackingNumber: trackingData.trackingNumber,
      carrier: trackingData.carrier || 'شركة الشحن',
      estimatedDelivery: trackingData.estimatedDelivery,
      trackingUrl: trackingData.trackingUrl
    };

    // Update order with tracking info
    if (trackingData.trackingNumber) {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          trackingNumber: trackingData.trackingNumber,
          estimatedDelivery: trackingData.estimatedDelivery
        }
      });
    }

    return this.sendOrderStatusUpdate(orderId, 'shipped', additionalData);
  }

  async sendOrderDelivered(orderId) {
    return this.sendOrderStatusUpdate(orderId, 'delivered');
  }

  async resendOrderEmail(orderId, emailType) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Reset the email notification flag for the specific type
      if (emailType === 'confirmation') {
        await Order.findByIdAndUpdate(orderId, {
          $unset: {
            'emailNotifications.confirmation.sent': 1,
            'emailNotifications.confirmation.sentAt': 1,
            'emailNotifications.confirmation.messageId': 1
          }
        });
        return this.sendOrderConfirmation(orderId);
      } else if (emailType === 'shipped') {
        await Order.findByIdAndUpdate(orderId, {
          $unset: {
            'emailNotifications.shipped.sent': 1,
            'emailNotifications.shipped.sentAt': 1,
            'emailNotifications.shipped.messageId': 1
          }
        });
        return this.sendOrderStatusUpdate(orderId, 'shipped');
      } else if (emailType === 'delivered') {
        await Order.findByIdAndUpdate(orderId, {
          $unset: {
            'emailNotifications.delivered.sent': 1,
            'emailNotifications.delivered.sentAt': 1,
            'emailNotifications.delivered.messageId': 1
          }
        });
        return this.sendOrderStatusUpdate(orderId, 'delivered');
      }

      throw new Error('Invalid email type');
    } catch (error) {
      console.error('Failed to resend order email:', error);
      return { success: false, error: error.message };
    }
  }

  async getOrderEmailStatus(orderId) {
    try {
      const order = await Order.findById(orderId).select('emailNotifications orderNumber');
      if (!order) {
        throw new Error('Order not found');
      }

      return {
        success: true,
        orderNumber: order.orderNumber,
        emailStatus: order.emailNotifications || {}
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Bulk email operations for admin
  async sendBulkOrderEmails(orderIds, emailType) {
    const results = [];
    
    for (const orderId of orderIds) {
      try {
        let result;
        if (emailType === 'confirmation') {
          result = await this.sendOrderConfirmation(orderId);
        } else if (emailType === 'shipped') {
          result = await this.sendOrderStatusUpdate(orderId, 'shipped');
        } else if (emailType === 'delivered') {
          result = await this.sendOrderStatusUpdate(orderId, 'delivered');
        }
        
        results.push({ orderId, ...result });
      } catch (error) {
        results.push({ orderId, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

// Create singleton instance
const orderEmailService = new OrderEmailService();

export default orderEmailService;
