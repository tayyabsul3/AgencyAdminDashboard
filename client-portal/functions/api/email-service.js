const nodemailer = require('nodemailer');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Create email transporter
function createTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email service not configured: set SMTP_* env vars');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

// Send transaction confirmation email
async function sendTransactionConfirmationEmail({ 
  customerEmail, 
  customerName, 
  transactionDetails 
}) {
  const transporter = createTransporter();
  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const {
    transactionId,
    amount,
    currency,
    planName,
    billingCycle,
    transactionType,
    date,
    nextBillingDate,
    credits
  } = transactionDetails;

  // Format amount for display
  const formattedAmount = `${currency.toUpperCase()} $${(amount / 100).toFixed(2)}`;

  const textContent = `
Transaction Confirmation - QueryFuel

Hi ${customerName},

Thank you for your payment! Here are your transaction details:

Transaction ID: ${transactionId}
Amount: ${formattedAmount}
Plan: ${planName} (${billingCycle})
Transaction Type: ${transactionType}
Date: ${date}
${nextBillingDate ? `Next Billing Date: ${nextBillingDate}` : ''}
${credits ? `Credits Included: ${credits} per month` : ''}

Your subscription is now active and you can start using QueryFuel immediately.

If you have any questions, please contact our support team at support@queryfuel.io.

Best regards,
The QueryFuel Team
  `.trim();

  const htmlContent = `
    <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#627FFF 0%,#23D2EE 100%);padding:24px 20px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:bold">Transaction Confirmed</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px">Thank you for choosing QueryFuel!</p>
      </div>
      
      <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px 0;font-size:16px">Hi ${escapeHtml(customerName)},</p>
        
        <p style="margin:0 0 16px 0;font-size:16px">Your payment has been successfully processed! Here are your transaction details:</p>
        
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px;width:40%;word-wrap:break-word">Transaction ID:</td>
              <td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px;word-wrap:break-word;overflow-wrap:break-word">${escapeHtml(transactionId.length > 20 ? transactionId.substring(0, 20) + '...' : transactionId)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Amount:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;font-size:14px">${escapeHtml(formattedAmount)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Plan:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px">${escapeHtml(planName)} (${escapeHtml(billingCycle)})</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Type:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(transactionType)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Date:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(date)}</td>
            </tr>
            ${nextBillingDate ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Next Billing:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(nextBillingDate)}</td>
            </tr>
            ` : ''}
            ${credits ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Monthly Credits:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#2563eb;font-size:14px">${escapeHtml(credits.toString())}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:8px;padding:12px;margin:16px 0">
          <p style="margin:0;color:#065f46;font-weight:500;font-size:14px">🎉 Your subscription is now active!</p>
          <p style="margin:6px 0 0 0;color:#047857;font-size:14px">You can start creating AI-optimized articles immediately.</p>
        </div>
        
        <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280">
          If you have any questions, please contact our support team at 
          <a href="mailto:support@queryfuel.io" style="color:#2563eb;word-wrap:break-word">support@queryfuel.io</a>.
        </p>
        
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">Best regards,<br>The QueryFuel Team</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: {
      name: 'QueryFuel',
      address: fromAddress,
    },
    to: customerEmail,
    subject: `Payment Confirmed - ${planName} Subscription`,
    text: textContent,
    html: htmlContent,
  });

  console.log(`✅ Transaction confirmation email sent to ${customerEmail}`);
}

// Send plan change confirmation email
async function sendPlanChangeConfirmationEmail({ 
  customerEmail, 
  customerName, 
  planChangeDetails 
}) {
  const transporter = createTransporter();
  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const {
    transactionId,
    amount,
    currency,
    fromPlan,
    toPlan,
    billingCycle,
    date,
    nextBillingDate,
    newCredits,
    prorationCredit,
    isUpgrade
  } = planChangeDetails;

  const formattedAmount = `${currency.toUpperCase()} $${(amount / 100).toFixed(2)}`;
  const formattedProration = prorationCredit > 0 ? `${currency.toUpperCase()} $${(prorationCredit / 100).toFixed(2)}` : null;

  const textContent = `
Plan Change Confirmation - QueryFuel

Hi ${customerName},

Your plan has been successfully ${isUpgrade ? 'upgraded' : 'changed'}! Here are the details:

Transaction ID: ${transactionId}
Plan Change: ${fromPlan} → ${toPlan}
Billing Cycle: ${billingCycle}
Amount Charged: ${formattedAmount}
${formattedProration ? `Proration Credit Applied: ${formattedProration}` : ''}
Date: ${date}
${nextBillingDate ? `Next Billing Date: ${nextBillingDate}` : ''}
New Monthly Credits: ${newCredits}

${isUpgrade ? 'Congratulations on upgrading! You now have access to more features and credits.' : 'Your plan change is now active.'}

If you have any questions, please contact our support team at support@queryfuel.io.

Best regards,
The QueryFuel Team
  `.trim();

  const htmlContent = `
    <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,${isUpgrade ? '#059669 0%,#10b981 100%' : '#627FFF 0%,#23D2EE 100%'});padding:24px 20px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:bold">Plan ${isUpgrade ? 'Upgraded' : 'Changed'}!</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px">${isUpgrade ? 'Welcome to your new plan!' : 'Your plan change is confirmed'}</p>
      </div>
      
      <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px 0;font-size:16px">Hi ${escapeHtml(customerName)},</p>
        
        <p style="margin:0 0 16px 0;font-size:16px">Your plan has been successfully ${isUpgrade ? 'upgraded' : 'changed'}! Here are the details:</p>
        
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;overflow:hidden">
          <div style="text-align:center;margin-bottom:12px">
            <span style="background:#e5e7eb;color:#374151;padding:6px 12px;border-radius:16px;font-weight:500;font-size:13px">${escapeHtml(fromPlan)}</span>
            <span style="margin:0 8px;color:#6b7280;font-size:14px">→</span>
            <span style="background:${isUpgrade ? '#dcfce7' : '#dbeafe'};color:${isUpgrade ? '#166534' : '#1e40af'};padding:6px 12px;border-radius:16px;font-weight:600;font-size:13px">${escapeHtml(toPlan)}</span>
          </div>
          
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px;width:40%;word-wrap:break-word">Transaction ID:</td>
              <td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px;word-wrap:break-word;overflow-wrap:break-word">${escapeHtml(transactionId.length > 20 ? transactionId.substring(0, 20) + '...' : transactionId)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Amount Charged:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;font-size:14px">${escapeHtml(formattedAmount)}</td>
            </tr>
            ${formattedProration ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Proration Credit:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#dc2626;font-size:14px">-${escapeHtml(formattedProration)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Billing Cycle:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(billingCycle)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Date:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(date)}</td>
            </tr>
            ${nextBillingDate ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Next Billing:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(nextBillingDate)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">New Monthly Credits:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#2563eb;font-size:14px">${escapeHtml(newCredits.toString())}</td>
            </tr>
          </table>
        </div>
        
        <div style="background:${isUpgrade ? '#ecfdf5' : '#eff6ff'};border:1px solid ${isUpgrade ? '#d1fae5' : '#bfdbfe'};border-radius:8px;padding:12px;margin:16px 0">
          <p style="margin:0;color:${isUpgrade ? '#065f46' : '#1e40af'};font-weight:500;font-size:14px">${isUpgrade ? '🎉 Congratulations on upgrading!' : '✅ Plan change complete!'}</p>
          <p style="margin:6px 0 0 0;color:${isUpgrade ? '#047857' : '#1d4ed8'};font-size:14px">${isUpgrade ? 'You now have access to more features and credits.' : 'Your new plan is now active.'}</p>
        </div>
        
        <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280">
          If you have any questions, please contact our support team at 
          <a href="mailto:support@queryfuel.io" style="color:#2563eb;word-wrap:break-word">support@queryfuel.io</a>.
        </p>
        
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">Best regards,<br>The QueryFuel Team</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: {
      name: 'QueryFuel',
      address: fromAddress,
    },
    to: customerEmail,
    subject: `Plan ${isUpgrade ? 'Upgraded' : 'Changed'} - ${toPlan} Subscription`,
    text: textContent,
    html: htmlContent,
  });

  console.log(`✅ Plan change confirmation email sent to ${customerEmail}`);
}

// Send subscription cancellation email
async function sendSubscriptionCancellationEmail({ 
  customerEmail, 
  customerName, 
  cancellationDetails 
}) {
  const transporter = createTransporter();
  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const {
    planName,
    billingCycle,
    cancellationDate,
    accessUntilDate,
    remainingCredits,
    cancellationReason
  } = cancellationDetails;

  const textContent = `
Subscription Cancelled - QueryFuel

Hi ${customerName},

We're sorry to see you go! Your subscription has been successfully cancelled.

Cancellation Details:
Plan: ${planName} (${billingCycle})
Cancellation Date: ${cancellationDate}
Access Until: ${accessUntilDate}
${remainingCredits ? `Remaining Credits: ${remainingCredits}` : ''}
${cancellationReason ? `Reason: ${cancellationReason}` : ''}

Important Information:
- Your account will remain active until ${accessUntilDate}
- You can continue using QueryFuel until your current billing period ends
- No further charges will be made to your payment method
- You can reactivate your subscription anytime from your dashboard

We'd love to have you back! If you have any feedback or questions, please don't hesitate to reach out to our support team at support@queryfuel.io.

Best regards,
The QueryFuel Team
  `.trim();

  const htmlContent = `
    <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);padding:24px 20px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:bold">Subscription Cancelled</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px">We're sorry to see you go</p>
      </div>
      
      <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px 0;font-size:16px">Hi ${escapeHtml(customerName)},</p>
        
        <p style="margin:0 0 16px 0;font-size:16px">We're sorry to see you go! Your subscription has been successfully cancelled.</p>
        
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;overflow:hidden">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#374151">Cancellation Details</h3>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px;width:40%">Plan:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px">${escapeHtml(planName)} (${escapeHtml(billingCycle)})</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Cancelled On:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(cancellationDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Access Until:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#dc2626;font-size:14px">${escapeHtml(accessUntilDate)}</td>
            </tr>
            ${remainingCredits ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Remaining Credits:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#2563eb;font-size:14px">${escapeHtml(remainingCredits.toString())}</td>
            </tr>
            ` : ''}
            ${cancellationReason ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Reason:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(cancellationReason)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px;margin:16px 0">
          <p style="margin:0;color:#92400e;font-weight:500;font-size:14px">⚠️ Important Information</p>
          <ul style="margin:6px 0 0 0;padding-left:16px;color:#a16207;font-size:14px">
            <li>Your account remains active until ${escapeHtml(accessUntilDate)}</li>
            <li>You can continue using QueryFuel until your current billing period ends</li>
            <li>No further charges will be made to your payment method</li>
            <li>You can reactivate your subscription anytime from your dashboard</li>
          </ul>
        </div>
        
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:16px 0">
          <p style="margin:0;color:#1e40af;font-weight:500;font-size:14px">💙 We'd love to have you back!</p>
          <p style="margin:6px 0 0 0;color:#1d4ed8;font-size:14px">If you change your mind, you can easily reactivate your subscription from your dashboard.</p>
        </div>
        
        <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280">
          If you have any feedback or questions, please contact our support team at 
          <a href="mailto:support@queryfuel.io" style="color:#2563eb;word-wrap:break-word">support@queryfuel.io</a>.
        </p>
        
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">Best regards,<br>The QueryFuel Team</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: {
      name: 'QueryFuel',
      address: fromAddress,
    },
    to: customerEmail,
    subject: `Subscription Cancelled - We're Sorry to See You Go`,
    text: textContent,
    html: htmlContent,
  });

  console.log(`✅ Subscription cancellation email sent to ${customerEmail}`);
}

// Send subscription update email
async function sendSubscriptionUpdateEmail({ 
  customerEmail, 
  customerName, 
  updateDetails 
}) {
  const transporter = createTransporter();
  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const {
    planName,
    billingCycle,
    updateDate,
    updateType,
    changes,
    nextBillingDate,
    credits
  } = updateDetails;

  const textContent = `
Subscription Updated - QueryFuel

Hi ${customerName},

Your subscription has been successfully updated!

Update Details:
Plan: ${planName} (${billingCycle})
Update Type: ${updateType}
Update Date: ${updateDate}
${nextBillingDate ? `Next Billing Date: ${nextBillingDate}` : ''}
${credits ? `Monthly Credits: ${credits}` : ''}

Changes Made:
${changes.map(change => `- ${change}`).join('\n')}

Your updated subscription is now active and all changes have been applied to your account.

If you have any questions about these changes, please contact our support team at support@queryfuel.io.

Best regards,
The QueryFuel Team
  `.trim();

  const htmlContent = `
    <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:24px 20px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:bold">Subscription Updated</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px">Your changes have been applied</p>
      </div>
      
      <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px 0;font-size:16px">Hi ${escapeHtml(customerName)},</p>
        
        <p style="margin:0 0 16px 0;font-size:16px">Your subscription has been successfully updated!</p>
        
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;overflow:hidden">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#374151">Update Details</h3>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px;width:40%">Plan:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px">${escapeHtml(planName)} (${escapeHtml(billingCycle)})</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Update Type:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(updateType)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Update Date:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(updateDate)}</td>
            </tr>
            ${nextBillingDate ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Next Billing:</td>
              <td style="padding:6px 0;text-align:right;font-size:14px">${escapeHtml(nextBillingDate)}</td>
            </tr>
            ` : ''}
            ${credits ? `
            <tr>
              <td style="padding:6px 8px 6px 0;color:#6b7280;font-weight:500;font-size:14px">Monthly Credits:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#2563eb;font-size:14px">${escapeHtml(credits.toString())}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
          <h4 style="margin:0 0 8px 0;color:#0c4a6e;font-weight:500;font-size:14px">Changes Made:</h4>
          <ul style="margin:0;padding-left:16px;color:#0369a1;font-size:14px">
            ${changes.map(change => `<li style="margin:4px 0">${escapeHtml(change)}</li>`).join('')}
          </ul>
        </div>
        
        <div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:8px;padding:12px;margin:16px 0">
          <p style="margin:0;color:#065f46;font-weight:500;font-size:14px">✅ Update Complete!</p>
          <p style="margin:6px 0 0 0;color:#047857;font-size:14px">Your updated subscription is now active and all changes have been applied.</p>
        </div>
        
        <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280">
          If you have any questions about these changes, please contact our support team at 
          <a href="mailto:support@queryfuel.io" style="color:#2563eb;word-wrap:break-word">support@queryfuel.io</a>.
        </p>
        
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">Best regards,<br>The QueryFuel Team</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: {
      name: 'QueryFuel',
      address: fromAddress,
    },
    to: customerEmail,
    subject: `Subscription Updated - ${updateType}`,
    text: textContent,
    html: htmlContent,
  });

  console.log(`✅ Subscription update email sent to ${customerEmail}`);
}

module.exports = {
  sendTransactionConfirmationEmail,
  sendPlanChangeConfirmationEmail,
  sendSubscriptionCancellationEmail,
  sendSubscriptionUpdateEmail
};