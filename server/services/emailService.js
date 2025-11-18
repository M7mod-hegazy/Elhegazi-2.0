import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  async init() {
    try {
      // Configure transporter based on environment
      if (process.env.EMAIL_SERVICE === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
          },
        });
      } else {
        // Generic SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
      }

      // Verify connection
      if (this.transporter && process.env.EMAIL_USER) {
        await this.transporter.verify();
        this.isConfigured = true;
        console.log('✅ Email service configured successfully');
      } else {
        console.log('⚠️ Email service not configured - missing credentials');
      }
    } catch (error) {
      console.error('❌ Email service configuration failed:', error.message);
      this.isConfigured = false;
    }
  }

  async loadTemplate(templateName, variables = {}) {
    try {
      const templatePath = path.join(__dirname, '../templates', templateName + '.html');
      let template = await fs.readFile(templatePath, 'utf-8');
      
      // Replace variables in template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp('{{' + key + '}}', 'g');
        template = template.replace(regex, variables[key]);
      });
      
      // Handle conditional blocks (Handlebars-style)
      template = template.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
        return variables[condition] ? content : '';
      });
      
      return template;
    } catch (error) {
      console.error('Failed to load email template ' + templateName + ':', error.message);
      return this.getFallbackTemplate(templateName, variables);
    }
  }

  getFallbackTemplate(templateName, variables) {
    const { customerName = 'عزيزي العميل', orderNumber = 'N/A', orderTotal = '0', orderItems = [], refundAmount = '0' } = variables;
    
    const fallbackTemplates = {
      'order-confirmation': `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">تأكيد الطلب</h1>
            <p style="font-size: 16px; line-height: 1.6;">مرحباً ${customerName}،</p>
            <p style="font-size: 16px; line-height: 1.6;">شكراً لك على طلبك. تم استلام طلبك بنجاح وسيتم معالجته قريباً.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">تفاصيل الطلب</h3>
              <p><strong>رقم الطلب:</strong> ${orderNumber}</p>
              <p><strong>إجمالي المبلغ:</strong> ${orderTotal} ريال</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">سنرسل لك تحديثات عن حالة طلبك عبر البريد الإلكتروني.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                تتبع الطلب
              </a>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              شكراً لاختيارك الحجازي لتجهيز المحلات
            </p>
          </div>
        </div>
      `,
      'order-shipped': `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #059669; text-align: center; margin-bottom: 30px;">تم شحن طلبك! 📦</h1>
            <p style="font-size: 16px; line-height: 1.6;">مرحباً ${customerName}،</p>
            <p style="font-size: 16px; line-height: 1.6;">أخبار رائعة! تم شحن طلبك وهو في طريقه إليك.</p>
            
            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3 style="color: #374151; margin-top: 0;">معلومات الشحن</h3>
              <p><strong>رقم الطلب:</strong> ${orderNumber}</p>
              <p><strong>رقم التتبع:</strong> ${variables.trackingNumber || 'سيتم إرساله قريباً'}</p>
              <p><strong>التوصيل المتوقع:</strong> ${variables.estimatedDelivery || '2-3 أيام عمل'}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}" 
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                تتبع الشحنة
              </a>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              شكراً لاختيارك الحجازي لتجهيز المحلات
            </p>
          </div>
        </div>
      `,
      'order-delivered': `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #7c3aed; text-align: center; margin-bottom: 30px;">تم توصيل طلبك! 🎉</h1>
            <p style="font-size: 16px; line-height: 1.6;">مرحباً ${customerName}،</p>
            <p style="font-size: 16px; line-height: 1.6;">تم توصيل طلبك بنجاح! نأمل أن تكون راضياً عن مشترياتك.</p>
            
            <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
              <h3 style="color: #374151; margin-top: 0;">تفاصيل التوصيل</h3>
              <p><strong>رقم الطلب:</strong> ${orderNumber}</p>
              <p><strong>تاريخ التوصيل:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">إذا كان لديك أي استفسار أو مشكلة مع طلبك، لا تتردد في التواصل معنا.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}/review" 
                 style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                قيم تجربتك
              </a>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              شكراً لاختيارك الحجازي لتجهيز المحلات
            </p>
          </div>
        </div>
      `,
      'order-cancelled': `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #ef4444; text-align: center; margin-bottom: 30px;">تم إلغاء طلبك</h1>
            <p style="font-size: 16px; line-height: 1.6;">مرحباً ${customerName}،</p>
            <p style="font-size: 16px; line-height: 1.6;">نأسف لإبلاغك بأنه تم إلغاء طلبك بنجاح.</p>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <h3 style="color: #b91c1c; margin-top: 0;">تفاصيل الإلغاء</h3>
              <p><strong>رقم الطلب:</strong> ${orderNumber}</p>
              <p><strong>المبلغ المسترد:</strong> ${refundAmount} ريال</p>
              ${variables.cancellationReason ? `<p><strong>سبب الإلغاء:</strong> ${variables.cancellationReason}</p>` : ''}
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">سيتم استرداد المبلغ إلى طريقة الدفع الأصلية خلال 5-7 أيام عمل.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                استمر في التسوق
              </a>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              شكراً لاختيارك الحجازي لتجهيز المحلات
            </p>
          </div>
        </div>
      `
    };
    
    return fallbackTemplates[templateName] || `<p>Email template not found: ${templateName}</p>`;
  }

  async sendOrderConfirmation(orderData) {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping order confirmation email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { customer, order, items = [] } = orderData;
      
      const emailContent = await this.loadTemplate('order-confirmation', {
        customerName: customer.name || customer.email,
        orderNumber: order.orderNumber || order._id,
        orderTotal: order.total,
        orderItems: items,
        orderDate: new Date(order.createdAt).toLocaleDateString('ar-SA'),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      });

      const mailOptions = {
        from: `"الحجازي لتجهيز المحلات" <${process.env.EMAIL_USER}>`,
        to: customer.email,
        subject: `تأكيد الطلب #${order.orderNumber || order._id}`,
        html: emailContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Order confirmation email sent:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send order confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderStatusUpdate(orderData, newStatus) {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping status update email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { customer, order } = orderData;
      let templateName = 'order-status-update';
      let subject = `تحديث حالة الطلب #${order.orderNumber || order._id}`;

      // Use specific templates for certain statuses
      if (newStatus === 'shipped') {
        templateName = 'order-shipped';
        subject = `تم شحن طلبك #${order.orderNumber || order._id}`;
      } else if (newStatus === 'delivered') {
        templateName = 'order-delivered';
        subject = `تم توصيل طلبك #${order.orderNumber || order._id}`;
      } else if (newStatus === 'cancelled') {
        templateName = 'order-cancelled';
        subject = `تم إلغاء طلبك #${order.orderNumber || order._id}`;
      }

      // Prepare variables based on status
      const variables = {
        customerName: customer.name || customer.email,
        orderNumber: order.orderNumber || order._id,
        orderStatus: this.getStatusInArabic(newStatus),
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      // Add status-specific variables
      if (newStatus === 'shipped') {
        variables.shippingDate = new Date().toLocaleDateString('ar-SA');
        variables.carrier = order.carrier || 'الشركة العامة للنقل';
        variables.trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order.orderNumber || order._id}/track`;
      } else if (newStatus === 'cancelled') {
        variables.cancellationDate = new Date().toLocaleDateString('ar-SA');
        variables.refundAmount = order.total || '0';
        variables.cancellationReason = order.cancellationReason || 'لم يتم تحديد سبب الإلغاء';
      }

      const emailContent = await this.loadTemplate(templateName, variables);

      const mailOptions = {
        from: `"الحجازي لتجهيز المحلات" <${process.env.EMAIL_USER}>`,
        to: customer.email,
        subject: subject,
        html: emailContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Order status update email sent (${newStatus}):`, result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send order status update email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderCancelled(orderData) {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping order cancelled email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { customer, order } = orderData;
      
      const emailContent = await this.loadTemplate('order-cancelled', {
        customerName: customer.name || customer.email,
        orderNumber: order.orderNumber || order._id,
        refundAmount: order.total || '0',
        cancellationDate: new Date().toLocaleDateString('ar-SA'),
        cancellationReason: order.cancellationReason || 'لم يتم تحديد سبب الإلغاء',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      });

      const mailOptions = {
        from: `"الحجازي لتجهيز المحلات" <${process.env.EMAIL_USER}>`,
        to: customer.email,
        subject: `تم إلغاء طلبك #${order.orderNumber || order._id}`,
        html: emailContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Order cancelled email sent:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send order cancelled email:', error);
      return { success: false, error: error.message };
    }
  }

  getStatusInArabic(status) {
    const statusMap = {
      'pending': 'قيد الانتظار',
      'confirmed': 'مؤكد',
      'processing': 'قيد المعالجة',
      'shipped': 'تم الشحن',
      'delivered': 'تم التوصيل',
      'cancelled': 'ملغي'
    };
    return statusMap[status] || status;
  }

  async sendTestEmail(toEmail) {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: `"الحجازي لتجهيز المحلات" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'اختبار خدمة البريد الإلكتروني',
        html: `
          <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px;">
            <h2>اختبار خدمة البريد الإلكتروني</h2>
            <p>هذه رسالة اختبار للتأكد من عمل خدمة البريد الإلكتروني بشكل صحيح.</p>
            <p>التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}</p>
          </div>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;