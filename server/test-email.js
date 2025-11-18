import emailService from './services/emailService.js';

// Test the email service
async function testEmailService() {
  console.log('Testing email service...');
  
  if (!emailService.isConfigured) {
    console.log('❌ Email service is not configured properly');
    console.log('Please check your .env file and ensure EMAIL_USER and EMAIL_PASSWORD are set correctly');
    return;
  }
  
  console.log('✅ Email service is configured');
  
  // Send a test email
  try {
    const result = await emailService.sendTestEmail('test@example.com');
    if (result.success) {
      console.log('✅ Test email sent successfully');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ Failed to send test email:', result.error);
    }
  } catch (error) {
    console.log('❌ Error sending test email:', error.message);
  }
}

testEmailService();