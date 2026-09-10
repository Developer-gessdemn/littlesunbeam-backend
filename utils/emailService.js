const nodemailer = require("nodemailer");

/**
 * Little Sunbeam Order Tracking & Milestone Email Service
 */

// Cache the nodemailer transporter instance
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Development fallback: mock transporter that logs preview to console
    transporter = {
      sendMail: async (mailOptions) => {
        console.log("--------------------------------------------------");
        console.log(`📧 [EMAIL SERVICE] (Simulated Send to ${mailOptions.to})`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`From: ${mailOptions.from}`);
        console.log("--------------------------------------------------");
        return {
          messageId: `simulated_${Date.now()}`,
          response: "250 Message queued for simulation",
        };
      },
    };
  }

  return transporter;
};

// Helper: Format Indian Rupee currency
const formatINR = (val) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

// Helper: Format readable date
const formatDate = (dateVal) => {
  if (!dateVal) return "To be updated soon";
  try {
    return new Date(dateVal).toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateVal);
  }
};

/**
 * Generate rich HTML template for order milestone updates
 */
const generateOrderHtml = (order, type, customMessage = "") => {
  const orderNumber = order.orderNumber || "ORD-LSB";
  const customerName = order.shippingAddress?.name || "Valued Customer";
  const courierName = order.courierName || "Courier Partner";
  const trackingNumber = order.trackingNumber || "";
  const trackingUrl = order.trackingUrl || "";
  const expectedDelivery = order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : null;
  const shippingDate = order.shippingDate || order.shippedAt ? formatDate(order.shippingDate || order.shippedAt) : null;

  // Derive tracking link to customer portal
  const frontendBase = (process.env.FRONTEND_URL || "https://littlesunbeam.in")
    .split(",")[0]
    .trim();
  const contactParam = encodeURIComponent(
    order.shippingAddress?.phone || order.shippingAddress?.email || ""
  );
  const directPortalUrl = `${frontendBase}/track-order?orderNumber=${encodeURIComponent(
    orderNumber
  )}&contact=${contactParam}`;

  // Milestone Banner details
  let bannerEmoji = "✨";
  let bannerTitle = "Order Update";
  let bannerSubtitle = "Here is the latest status of your Little Sunbeam purchase.";
  let badgeColor = "#F59E0B";
  let badgeBg = "#FEF3C7";

  switch (type) {
    case "Confirmed":
      bannerEmoji = "🎉";
      bannerTitle = "Order Confirmed & Received!";
      bannerSubtitle = "Thank you for shopping with Little Sunbeam. We've received your order and are preparing it with utmost care.";
      badgeColor = "#059669";
      badgeBg = "#D1FAE5";
      break;
    case "Packed":
      bannerEmoji = "🎁";
      bannerTitle = "Your Order is Carefully Packed!";
      bannerSubtitle = "Our Tirupur workshop has freshly quality-checked, steam-ironed, and packed your organic baby essentials.";
      badgeColor = "#0284C7";
      badgeBg = "#E0F2FE";
      break;
    case "Shipped":
      bannerEmoji = "🚚";
      bannerTitle = "Your Order is on the Way!";
      bannerSubtitle = `Great news! Your package has been dispatched via ${courierName}. You can track the shipment live below.`;
      badgeColor = "#2563EB";
      badgeBg = "#DBEAFE";
      break;
    case "Out for Delivery":
      bannerEmoji = "🏡";
      bannerTitle = "Out for Delivery Today!";
      bannerSubtitle = "The delivery executive is nearby with your Little Sunbeam package. Please keep your phone accessible.";
      badgeColor = "#7C3AED";
      badgeBg = "#EDE9FE";
      break;
    case "Delivered":
      bannerEmoji = "🌟";
      bannerTitle = "Order Successfully Delivered!";
      bannerSubtitle = "Your Little Sunbeam parcel has been safely delivered. We hope your little one adores their new comfort wear!";
      badgeColor = "#059669";
      badgeBg = "#D1FAE5";
      break;
    default:
      bannerTitle = `Order Status: ${type}`;
      bannerSubtitle = customMessage || "Your order status has been updated.";
  }

  // Items table HTML
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="64" style="vertical-align: middle; padding-right: 14px;">
                <img src="${item.image || 'https://littlesunbeam.in/favicon.png'}" alt="${item.name}" width="60" height="60" style="border-radius: 12px; object-fit: cover; border: 1px solid #E5E7EB; display: block;" />
              </td>
              <td style="vertical-align: middle;">
                <p style="margin: 0; font-weight: 700; color: #111827; font-size: 14px;">${item.name}</p>
                <p style="margin: 3px 0 0 0; color: #6B7280; font-size: 12px;">
                  Qty: <strong style="color: #374151;">${item.quantity || 1}</strong>
                  ${item.selectedSize ? ` · Size: ${item.selectedSize}` : item.size ? ` · Size: ${item.size}` : ''}
                  ${item.selectedColor ? ` · Color: ${item.selectedColor}` : item.color ? ` · Color: ${item.color}` : ''}
                </p>
              </td>
              <td align="right" style="vertical-align: middle; white-space: nowrap;">
                <strong style="color: #111827; font-size: 14px;">${formatINR((item.price || 0) * (item.quantity || 1))}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bannerTitle} - Little Sunbeam</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F2937;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF5EE; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02); overflow: hidden; border: 1px solid #F3EDE2;">
          
          <!-- Header Bar with Logo -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); padding: 28px 20px; border-bottom: 2px dashed #FDE68A;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 32px; line-height: 1; margin-bottom: 6px;">☀️</div>
                    <span style="font-size: 22px; font-weight: 900; color: #78350F; letter-spacing: -0.5px; text-transform: uppercase;">
                      Little <span style="color: #D97706;">Sunbeam</span>
                    </span>
                    <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #92400E; letter-spacing: 1px; text-transform: uppercase;">
                      100% Organic Cotton Babywear · Tiruppur
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Milestone Hero Banner -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center;">
              <div style="display: inline-block; padding: 6px 16px; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                ${bannerEmoji} ${type.toUpperCase()}
              </div>
              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 900; color: #111827; letter-spacing: -0.5px;">
                ${bannerTitle}
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
                Hello <strong style="color: #111827;">${customerName}</strong>, ${bannerSubtitle}
              </p>
              ${customMessage ? `<div style="margin-top: 14px; padding: 12px 16px; background-color: #F8FAFC; border-radius: 12px; font-size: 13px; color: #334155; border-left: 4px solid #F59E0B; text-align: left;"><strong>Admin Note:</strong> ${customMessage}</div>` : ''}
            </td>
          </tr>

          <!-- Courier & Tracking Information Box (Highlighted for Shipped / Out for Delivery) -->
          ${
            courierName || trackingNumber || expectedDelivery
              ? `
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border: 1px solid #BBF7D0; border-radius: 18px; padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-bottom: 12px; border-bottom: 1px dashed #86EFAC;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td>
                            <span style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">📦 Courier Partner</span>
                            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #14532D;">${courierName || "Express Courier"}</p>
                          </td>
                          ${
                            trackingNumber
                              ? `
                          <td align="right">
                            <span style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">AWB / Tracking ID</span>
                            <p style="margin: 2px 0 0 0; font-family: monospace; font-size: 15px; font-weight: 800; color: #14532D; letter-spacing: 0.5px;">${trackingNumber}</p>
                          </td>
                          `
                              : ''
                          }
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 12px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          ${
                            shippingDate
                              ? `
                          <td>
                            <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Shipping Date</span>
                            <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #15803D;">${shippingDate}</p>
                          </td>
                          `
                              : ''
                          }
                          ${
                            expectedDelivery
                              ? `
                          <td align="${shippingDate ? 'right' : 'left'}">
                            <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Expected Delivery</span>
                            <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 800; color: #15803D;">🗓️ ${expectedDelivery}</p>
                          </td>
                          `
                              : ''
                          }
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Track Button CTA -->
          <tr>
            <td align="center" style="padding: 10px 30px 30px 30px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 9999px; background: #D97706; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);">
                    <a href="${directPortalUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 900; color: #FFFFFF; text-decoration: none; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      🔍 Live Track Your Order &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ${
                trackingUrl
                  ? `
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #6B7280;">
                Or track directly on courier website: <a href="${trackingUrl}" target="_blank" style="color: #2563EB; font-weight: 700; text-decoration: underline;">Open ${courierName} Portal</a>
              </p>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Order Summary Section -->
          <tr>
            <td style="padding: 24px 30px; background-color: #FAFAFA; border-top: 1px solid #F3F4F6; border-bottom: 1px solid #F3F4F6;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td>
                    <span style="font-size: 12px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</span>
                    <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 900; color: #111827;">${orderNumber}</p>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Total</span>
                    <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 900; color: #D97706;">${formatINR(order.totalAmount)}</p>
                  </td>
                </tr>
              </table>

              <!-- Purchased Items List -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>

              <!-- Cost breakdown -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; font-size: 13px; color: #4B5563;">
                <tr>
                  <td style="padding: 3px 0;">Subtotal</td>
                  <td align="right" style="padding: 3px 0; font-weight: 600; color: #111827;">${formatINR(order.subtotal)}</td>
                </tr>
                ${
                  order.discount > 0
                    ? `
                <tr>
                  <td style="padding: 3px 0; color: #059669;">Discount ${order.couponCode ? `(${order.couponCode})` : ''}</td>
                  <td align="right" style="padding: 3px 0; font-weight: 600; color: #059669;">-${formatINR(order.discount)}</td>
                </tr>
                `
                    : ''
                }
                <tr>
                  <td style="padding: 3px 0;">Shipping Fee</td>
                  <td align="right" style="padding: 3px 0; font-weight: 600; color: #111827;">${order.shippingCharge > 0 ? formatINR(order.shippingCharge) : 'FREE'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 0 0; font-weight: 800; color: #111827; font-size: 15px; border-top: 1px solid #E5E7EB;">Grand Total</td>
                  <td align="right" style="padding: 8px 0 0 0; font-weight: 900; color: #D97706; font-size: 16px; border-top: 1px solid #E5E7EB;">${formatINR(order.totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Destination Address -->
          <tr>
            <td style="padding: 24px 30px;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
                📍 Delivery Destination
              </h4>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #374151;">
                <strong>${order.shippingAddress?.name || customerName}</strong><br />
                ${order.shippingAddress?.address || ''}<br />
                ${order.shippingAddress?.city || ''}${order.shippingAddress?.state ? `, ${order.shippingAddress.state}` : ''} - ${order.shippingAddress?.pincode || ''}<br />
                📞 ${order.shippingAddress?.phone || 'Not provided'}
              </p>
            </td>
          </tr>

          <!-- Footer Help & Info -->
          <tr>
            <td align="center" style="background-color: #FFFDF9; padding: 24px 30px; border-top: 1px solid #F3EDE2; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #4B5563;">
                Have questions or need assistance with your shipment?
              </p>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #6B7280;">
                WhatsApp: <strong style="color: #111827;">+91 90255 59837</strong> &nbsp;·&nbsp; Email: <strong style="color: #111827;">littlesunbeamkidswear@gmail.com</strong>
              </p>
              <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
                &copy; ${new Date().getFullYear()} Little Sunbeam Babywear, Tiruppur, Tamil Nadu. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Send milestone email notification
 * @param {Object} options
 * @param {Object} options.order - The order document
 * @param {string} options.type - "Confirmed" | "Packed" | "Shipped" | "Out for Delivery" | "Delivered"
 * @param {string} [options.customMessage] - Optional custom admin note
 */
const sendOrderMilestoneEmail = async ({ order, type, customMessage = "" }) => {
  try {
    if (!order) return { success: false, message: "Order data missing" };

    const recipientEmail =
      order.shippingAddress?.email ||
      order.user?.email ||
      (typeof order.user === "string" ? null : order.user?.email);

    if (!recipientEmail || !recipientEmail.includes("@")) {
      console.warn(`[emailService] No valid recipient email found for order ${order.orderNumber}`);
      return { success: false, message: "No recipient email found" };
    }

    const orderNumber = order.orderNumber || "ORD-LSB";

    // Subjects mapped by milestone
    const subjects = {
      Confirmed: `🎉 Order Confirmed #${orderNumber} - Little Sunbeam`,
      Packed: `🎁 Order Packed #${orderNumber} - Ready for dispatch!`,
      Shipped: `🚚 Order Shipped #${orderNumber} via ${order.courierName || 'Courier'} - Track Live`,
      "Out for Delivery": `🏡 Arriving Today! Order #${orderNumber} is Out for Delivery`,
      Delivered: `✨ Delivered! Your Little Sunbeam order #${orderNumber} has arrived`,
    };

    const subject = subjects[type] || `📦 Order Update #${orderNumber} - Little Sunbeam`;
    const htmlContent = generateOrderHtml(order, type, customMessage);

    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || '"Little Sunbeam" <orders@littlesunbeam.in>';

    const info = await mailer.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[emailService] Milestone email "${type}" sent to ${recipientEmail} for order ${orderNumber}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[emailService] Failed to send milestone email:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderMilestoneEmail,
  generateOrderHtml,
};
