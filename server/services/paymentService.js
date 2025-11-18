import Order from '../models/Order.js';

/**
 * Payment Service
 * Handles payment processing for different payment methods
 * Supports: COD, Credit Card (placeholder for Stripe/PayPal integration)
 */

class PaymentService {
  constructor() {
    this.supportedMethods = ['cod', 'credit', 'debit', 'wallet'];
  }

  /**
   * Process payment for an order
   * @param {Object} orderData - Order data including payment method
   * @param {Object} paymentDetails - Payment details (card info, wallet, etc.)
   * @returns {Object} Payment result
   */
  async processPayment(orderData, paymentDetails = {}) {
    const { paymentMethod, total, orderId } = orderData;

    if (!this.supportedMethods.includes(paymentMethod)) {
      return {
        success: false,
        error: `Payment method ${paymentMethod} is not supported`
      };
    }

    try {
      switch (paymentMethod) {
        case 'cod':
          return await this.processCOD(orderData);
        
        case 'credit':
        case 'debit':
          return await this.processCreditCard(orderData, paymentDetails);
        
        case 'wallet':
          return await this.processWallet(orderData, paymentDetails);
        
        default:
          return {
            success: false,
            error: 'Invalid payment method'
          };
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message || 'Payment processing failed'
      };
    }
  }

  /**
   * Process Cash on Delivery (COD) payment
   */
  async processCOD(orderData) {
    // COD doesn't require immediate payment processing
    // Payment will be collected upon delivery
    return {
      success: true,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      message: 'Order placed successfully. Payment will be collected on delivery.',
      transactionId: null
    };
  }

  /**
   * Process Credit/Debit Card payment
   * TODO: Integrate with Stripe, PayPal, or local payment gateway
   */
  async processCreditCard(orderData, paymentDetails) {
    const { total, orderId } = orderData;
    const { cardNumber, cardHolder, expiryDate, cvv } = paymentDetails;

    // Validate card details
    if (!cardNumber || !cardHolder || !expiryDate || !cvv) {
      return {
        success: false,
        error: 'Incomplete card details'
      };
    }

    // TODO: Integrate with payment gateway (Stripe, PayPal, etc.)
    // For now, simulate payment processing
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate success (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update order payment status
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: 'paid',
          'paymentDetails.transactionId': transactionId,
          'paymentDetails.paidAt': new Date()
        });
      }

      return {
        success: true,
        paymentMethod: 'credit',
        paymentStatus: 'paid',
        transactionId,
        message: 'Payment processed successfully',
        paidAt: new Date()
      };
    } else {
      return {
        success: false,
        error: 'Payment declined. Please check your card details and try again.'
      };
    }
  }

  /**
   * Process Wallet payment (Apple Pay, Google Pay, etc.)
   * TODO: Integrate with wallet payment providers
   */
  async processWallet(orderData, paymentDetails) {
    const { total, orderId } = orderData;
    const { walletType, token } = paymentDetails;

    if (!walletType || !token) {
      return {
        success: false,
        error: 'Invalid wallet payment details'
      };
    }

    // TODO: Integrate with wallet payment providers
    // For now, simulate payment processing
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const transactionId = `WALLET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update order payment status
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
        'paymentDetails.transactionId': transactionId,
        'paymentDetails.walletType': walletType,
        'paymentDetails.paidAt': new Date()
      });
    }

    return {
      success: true,
      paymentMethod: 'wallet',
      paymentStatus: 'paid',
      transactionId,
      walletType,
      message: 'Wallet payment processed successfully',
      paidAt: new Date()
    };
  }

  /**
   * Process refund for an order
   * @param {String} orderId - Order ID
   * @param {Number} amount - Refund amount
   * @param {String} reason - Refund reason
   */
  async processRefund(orderId, amount, reason = '') {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return {
          success: false,
          error: 'Order not found'
        };
      }

      if (order.paymentStatus === 'refunded') {
        return {
          success: false,
          error: 'Order already refunded'
        };
      }

      // TODO: Process actual refund through payment gateway
      // For now, simulate refund processing
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const refundId = `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update order
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'refunded',
        'refundDetails.refundId': refundId,
        'refundDetails.refundAmount': amount,
        'refundDetails.refundReason': reason,
        'refundDetails.refundedAt': new Date()
      });

      return {
        success: true,
        refundId,
        refundAmount: amount,
        message: 'Refund processed successfully',
        refundedAt: new Date()
      };
    } catch (error) {
      console.error('Refund processing error:', error);
      return {
        success: false,
        error: error.message || 'Refund processing failed'
      };
    }
  }

  /**
   * Verify payment status
   * @param {String} transactionId - Transaction ID
   */
  async verifyPayment(transactionId) {
    try {
      // TODO: Verify with payment gateway
      // For now, return mock verification
      
      return {
        success: true,
        verified: true,
        transactionId,
        status: 'completed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  /**
   * Get supported payment methods
   */
  getSupportedMethods() {
    return {
      methods: this.supportedMethods.map(method => ({
        id: method,
        name: this.getMethodName(method),
        enabled: true
      }))
    };
  }

  /**
   * Get payment method display name
   */
  getMethodName(method) {
    const names = {
      cod: 'الدفع عند الاستلام',
      credit: 'بطاقة ائتمان',
      debit: 'بطاقة خصم',
      wallet: 'محفظة إلكترونية'
    };
    return names[method] || method;
  }
}

// Create singleton instance
const paymentService = new PaymentService();

export default paymentService;
