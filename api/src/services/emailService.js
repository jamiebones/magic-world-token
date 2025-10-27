const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email service for sending low balance alerts
 * Uses Gmail SMTP (free tier)
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.enabled = process.env.EMAIL_ALERTS_ENABLED === 'true';
        this.from = process.env.EMAIL_FROM || 'alerts@magicworld.com';
        this.initialized = false;
    }

    /**
     * Initialize Gmail transporter
     */
    async initialize() {
        if (!this.enabled) {
            logger.info('📧 Email alerts disabled (EMAIL_ALERTS_ENABLED=false)');
            this.initialized = false;
            return;
        }

        // Check required configuration
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            logger.warn('📧 Email service not configured (missing GMAIL_USER or GMAIL_APP_PASSWORD)');
            logger.info('📧 To enable email alerts:');
            logger.info('   1. Set EMAIL_ALERTS_ENABLED=true');
            logger.info('   2. Set GMAIL_USER=your-email@gmail.com');
            logger.info('   3. Set GMAIL_APP_PASSWORD=your-16-char-app-password');
            logger.info('   4. Set EMAIL_TO=recipient@example.com');
            this.initialized = false;
            return;
        }

        try {
            logger.info(`📧 Attempting to connect to Gmail with user: ${process.env.GMAIL_USER}`);

            // Gmail configuration
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER, // Your Gmail address
                    pass: process.env.GMAIL_APP_PASSWORD, // Gmail app password (not regular password)
                },
            });

            // Verify connection
            logger.info('📧 Testing SMTP connection...');
            await this.transporter.verify();
            this.initialized = true;
            logger.info('📧 Email service initialized successfully (Gmail)');
            logger.info(`📧 Configured recipients: ${this.getRecipients().join(', ')}`);
        } catch (error) {
            logger.error('❌ Failed to initialize email service');
            logger.error(`   Error Type: ${error.name}`);
            logger.error(`   Error Message: ${error.message}`);
            logger.error(`   Error Code: ${error.code || 'N/A'}`);
            if (error.response) {
                logger.error(`   SMTP Response: ${error.response}`);
            }
            logger.error(`   Full Error: ${JSON.stringify(error, null, 2)}`);
            logger.warn('📧 Email alerts will be disabled until configuration is fixed');
            logger.info('📧 Common issues:');
            logger.info('   - Using regular Gmail password instead of App Password');
            logger.info('   - 2FA not enabled on Gmail account');
            logger.info('   - Invalid Gmail credentials');
            logger.info('   - Incorrect Gmail address (check GMAIL_USER)');
            this.initialized = false;
        }
    }

    /**
     * Send low balance alert email
     */
    async sendLowBalanceAlert({ walletName, walletAddress, balance, threshold, network, explorerLink }) {
        if (!this.enabled) {
            logger.warn('📧 Email alerts disabled, skipping email send');
            return { success: false, message: 'Email alerts disabled' };
        }

        if (!this.initialized) {
            await this.initialize();
            if (!this.initialized) {
                return { success: false, message: 'Email service not initialized' };
            }
        }

        const recipients = this.getRecipients();
        if (recipients.length === 0) {
            return { success: false, message: 'No email recipients configured' };
        }

        const subject = `⚠️ Low Wallet Balance Alert - ${walletName}`;
        const html = this.generateLowBalanceEmail({
            walletName,
            walletAddress,
            balance,
            threshold,
            network,
            explorerLink,
        });

        try {
            const info = await this.transporter.sendMail({
                from: `Magic World Alerts <${this.from}>`,
                to: recipients.join(', '),
                subject,
                html,
            });

            logger.info(`📧 Low balance alert email sent to ${recipients.join(', ')}`, {
                messageId: info.messageId,
                wallet: walletName,
            });

            return {
                success: true,
                messageId: info.messageId,
                recipients,
            };
        } catch (error) {
            logger.error('❌ Failed to send email:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Generate HTML email content
     */
    generateLowBalanceEmail({ walletName, walletAddress, balance, threshold, network, explorerLink }) {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .alert-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-table {
            width: 100%;
            background: white;
            border-radius: 5px;
            overflow: hidden;
            margin: 20px 0;
          }
          .info-table tr {
            border-bottom: 1px solid #dee2e6;
          }
          .info-table tr:last-child {
            border-bottom: none;
          }
          .info-table td {
            padding: 12px 15px;
          }
          .info-table td:first-child {
            font-weight: bold;
            color: #6c757d;
            width: 40%;
          }
          .info-table td:last-child {
            color: #212529;
          }
          .balance-critical {
            color: #dc3545;
            font-weight: bold;
            font-size: 18px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            color: #6c757d;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
          }
          .emoji {
            font-size: 24px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1><span class="emoji">⚠️</span> Low Wallet Balance Alert</h1>
        </div>
        <div class="content">
          <div class="alert-box">
            <p><strong>Action Required:</strong> The <strong>${walletName}</strong> wallet has fallen below the minimum balance threshold.</p>
          </div>

          <table class="info-table">
            <tr>
              <td>Wallet Name</td>
              <td><strong>${walletName}</strong></td>
            </tr>
            <tr>
              <td>Wallet Address</td>
              <td><code>${walletAddress}</code></td>
            </tr>
            <tr>
              <td>Current Balance</td>
              <td class="balance-critical">${balance} BNB</td>
            </tr>
            <tr>
              <td>Minimum Threshold</td>
              <td>${threshold} BNB</td>
            </tr>
            <tr>
              <td>Network</td>
              <td>${network}</td>
            </tr>
            <tr>
              <td>Alert Time</td>
              <td>${new Date().toLocaleString()}</td>
            </tr>
          </table>

          <p style="margin: 20px 0;">
            <strong>⚡ Impact:</strong> This wallet is used for game operations and reward distributions. 
            Low balance may prevent transactions from being executed.
          </p>

          <p style="margin: 20px 0;">
            <strong>✅ Recommended Action:</strong> Top up the wallet with at least ${parseFloat(threshold) * 2} BNB to ensure uninterrupted operations.
          </p>

          <center>
            <a href="${explorerLink}" class="button">View on BscScan</a>
          </center>

          <div class="footer">
            <p>This is an automated alert from Magic World Token monitoring system.</p>
            <p>If you believe this is an error, please check your wallet balance monitoring configuration.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Get email recipients from environment
     */
    getRecipients() {
        const recipientsStr = process.env.EMAIL_TO || '';
        return recipientsStr
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);
    }

    /**
     * Test email configuration
     */
    async testEmail() {
        if (!this.enabled) {
            return { success: false, message: 'Email alerts disabled' };
        }

        if (!this.initialized) {
            await this.initialize();
        }

        const recipients = this.getRecipients();
        if (recipients.length === 0) {
            return { success: false, message: 'No email recipients configured' };
        }

        try {
            const info = await this.transporter.sendMail({
                from: `Magic World Alerts <${this.from}>`,
                to: recipients.join(', '),
                subject: '✅ Test Email - Magic World Monitoring',
                html: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email from Magic World Token monitoring system.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        `,
            });

            logger.info('📧 Test email sent successfully', { messageId: info.messageId });
            return { success: true, messageId: info.messageId, recipients };
        } catch (error) {
            logger.error('❌ Test email failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
