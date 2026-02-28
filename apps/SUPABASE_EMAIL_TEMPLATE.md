# Supabase Email Template - Ready to Use

## 📧 Single Template for All OTP Scenarios

Since both login and forgot password now use OTP, you only need to configure ONE template in Supabase.

---

## 🔧 Setup Instructions

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Click on **"Magic Link"** template
3. Copy and paste the template below
4. Click **Save**

---

## 📨 Magic Link Template (Handles Login OTP + Forgot Password OTP)

**Template Name**: Magic Link  
**Used For**: 
- OTP Login (when user clicks "Send OTP")
- Forgot Password OTP (when user clicks "Forgot Password")

### Subject Line:
```
Your EZDine Pro Verification Code
```

### Email Body (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900;">EZDine Pro</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Restaurant Operating System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 900;">Your Verification Code</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 16px; line-height: 1.6;">
                Use this code to complete your request. This code will expire in <strong>60 minutes</strong>.
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%); border-radius: 16px; padding: 32px; text-align: center; margin: 32px 0;">
                <p style="margin: 0 0 12px; color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Your 6-Digit Code</p>
                <div style="background-color: rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 20px; backdrop-filter: blur(10px);">
                  <p style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 900; letter-spacing: 8px; font-family: 'Courier New', monospace;">{{ .Token }}</p>
                </div>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px; font-weight: 600;">Or click the button below:</p>
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #1e293b; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  Verify Now
                </a>
              </div>
              
              <!-- Security Notice -->
              <div style="border-left: 4px solid #fbbf24; background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  <strong>Security Notice:</strong> If you didn't request this code, please ignore this email. Never share your verification code with anyone.
                </p>
              </div>
              
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Need help? Contact our support team at <a href="mailto:support@ezdine.com" style="color: #ff6b35; text-decoration: none; font-weight: 600;">support@ezdine.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px;">© 2026 EZDine Pro. All rights reserved.</p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1;">
                <a href="https://ezdine.com/privacy" style="color: #64748b; text-decoration: none; margin: 0 8px;">Privacy</a>
                <span>•</span>
                <a href="https://ezdine.com/terms" style="color: #64748b; text-decoration: none; margin: 0 8px;">Terms</a>
              </p>
              <p style="margin: 16px 0 0; font-size: 9px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">
                Powered by EZBillify
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## ✅ What This Template Handles

This single template is used for:

1. **Login OTP** - When user selects "OTP" tab and clicks "Send Code"
2. **Forgot Password OTP** - When user clicks "Forgot Password?" and enters email

The same 6-digit code format works for both scenarios!

---

## 🎯 Quick Setup Steps

### Step 1: Go to Supabase
```
https://app.supabase.com
→ Select your project
→ Authentication
→ Email Templates
→ Magic Link
```

### Step 2: Update Subject
```
Your EZDine Pro Verification Code
```

### Step 3: Paste HTML Body
Copy the entire HTML template above and paste it into the "Body" field.

### Step 4: Save
Click "Save" button at the bottom.

### Step 5: Test
1. Open your app
2. Try OTP login → Check email
3. Try forgot password → Check email
4. Verify both use the same template

---

## 📱 How It Works

### OTP Login Flow
```
User clicks "OTP" tab
→ Enters email
→ Clicks "Send Code"
→ Supabase sends email using Magic Link template
→ User receives 6-digit code
→ User enters code in app
→ User is logged in
```

### Forgot Password Flow
```
User clicks "Forgot Password?"
→ Enters email
→ Clicks "Send OTP"
→ Supabase sends email using Magic Link template
→ User receives 6-digit code
→ User enters code in app
→ User sets new password
→ Password updated
```

---

## 🎨 Template Features

✅ **Professional Design** - Modern gradient header with EZDine branding  
✅ **Large OTP Display** - 42px font size with letter spacing for easy reading  
✅ **Alternative Link** - Backup button if user prefers clicking  
✅ **Security Notice** - Yellow warning box for user awareness  
✅ **Mobile Responsive** - Works on all email clients  
✅ **Legal Links** - Privacy Policy and Terms of Service  
✅ **Branding** - "Powered by EZBillify" footer  

---

## 🔐 Security Settings

Make sure these are configured in Supabase:

### Authentication Settings
Go to **Authentication** → **Settings**:

- ✅ **Enable Email Provider**: ON
- ✅ **OTP Expiry**: 3600 seconds (60 minutes)
- ✅ **OTP Length**: 6 digits
- ✅ **Max Emails Per Hour**: 10 (per user)

### Site URL
Go to **Authentication** → **URL Configuration**:

- **Site URL**: `https://yourdomain.com`
- **Redirect URLs**: 
  - `https://yourdomain.com/auth/callback`
  - `https://yourdomain.com/dashboard`
  - `ezdine://auth/callback` (for mobile deep linking)

---

## 🧪 Testing Checklist

### Test OTP Login
- [ ] Open app/website
- [ ] Click "OTP" tab
- [ ] Enter email
- [ ] Click "Send Code"
- [ ] Check email inbox
- [ ] Verify template looks correct
- [ ] Copy 6-digit code
- [ ] Paste in app
- [ ] Verify login works

### Test Forgot Password
- [ ] Open app/website
- [ ] Click "Forgot Password?"
- [ ] Enter email
- [ ] Click "Send OTP"
- [ ] Check email inbox
- [ ] Verify same template is used
- [ ] Copy 6-digit code
- [ ] Paste in app
- [ ] Set new password
- [ ] Verify password updated

---

## 🚨 Common Issues

### Issue: Email not received
**Solutions**:
- Check spam folder
- Verify email address is correct
- Check Supabase logs for errors
- Verify SMTP settings (if using custom SMTP)

### Issue: OTP expired
**Solution**: 
- OTP expires after 60 minutes
- Request a new OTP

### Issue: Invalid OTP
**Solutions**:
- Ensure all 6 digits are entered
- Check for typos
- Request a new OTP
- Verify email address matches

### Issue: Template not updating
**Solutions**:
- Clear browser cache
- Wait 5 minutes for changes to propagate
- Check for HTML syntax errors
- Test in incognito mode

---

## 📊 Email Deliverability

### For Production
Consider setting up:

1. **Custom SMTP** (SendGrid, AWS SES, Mailgun)
2. **SPF Record** for your domain
3. **DKIM Signing** for authentication
4. **DMARC Policy** for security

### SMTP Configuration (Optional)
Go to **Project Settings** → **Authentication** → **SMTP Settings**:

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: YOUR_SENDGRID_API_KEY
Sender Email: noreply@ezdine.com
Sender Name: EZDine Pro
```

---

## 🎯 Summary

**Template Needed**: 1 (Magic Link only)  
**Handles**: Login OTP + Forgot Password OTP  
**Setup Time**: 5 minutes  
**Testing Time**: 5 minutes  
**Status**: ✅ Ready to Use  

---

**Copy the template above and paste it into Supabase now!**

**Version**: 2.0.0  
**Last Updated**: February 27, 2026  
**Status**: ✅ Production Ready
