# Supabase Email Template Setup Guide

## Overview
This guide covers setting up and customizing email templates in Supabase for OTP login and password reset functionality.

---

## 🔧 Supabase Dashboard Setup

### Step 1: Access Email Templates
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** → **Email Templates**

### Step 2: Configure SMTP (Optional but Recommended)
By default, Supabase uses their email service, but for production, you should use your own SMTP:

1. Go to **Project Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Enable **Custom SMTP**
4. Configure your SMTP provider:
   - **Host**: smtp.gmail.com (or your provider)
   - **Port**: 587 (TLS) or 465 (SSL)
   - **Username**: your-email@domain.com
   - **Password**: your-app-password
   - **Sender Email**: noreply@ezdine.com
   - **Sender Name**: EZDine Pro

**Recommended SMTP Providers**:
- SendGrid (99% deliverability)
- AWS SES (cheap, reliable)
- Mailgun (developer-friendly)
- Gmail (for testing only)

---

## 📧 Email Templates to Configure

### 1. Magic Link (OTP Login)
**Template Name**: `Magic Link`  
**Used For**: OTP login when user clicks "Send OTP"

**Subject**:
```
Your EZDine Pro Login Code
```

**Body** (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EZDine Pro - Login Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px; text-align: center;">
              <div style="background-color: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
                <!-- Add your logo here -->
                <img src="https://yourdomain.com/logo.png" alt="EZDine Logo" style="width: 60px; height: 60px; object-fit: contain;">
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">EZDine Pro</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Restaurant Operating System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 900;">Your Login Code</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 16px; line-height: 1.6;">
                Use this code to sign in to your EZDine Pro account. This code will expire in <strong>60 minutes</strong>.
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
                  Sign In to EZDine Pro
                </a>
              </div>
              
              <!-- Security Notice -->
              <div style="border-left: 4px solid #fbbf24; background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  <strong>Security Notice:</strong> If you didn't request this code, please ignore this email. Never share your login code with anyone.
                </p>
              </div>
              
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Need help? Contact our support team at <a href="mailto:support@ezdine.com" style="color: #ff6b35; text-decoration: none; font-weight: 600;">support@ezdine.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; font-weight: 600;">
                © 2026 EZDine Pro. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1;">
                <a href="https://ezdine.com/privacy" style="color: #64748b; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="https://ezdine.com/terms" style="color: #64748b; text-decoration: none; margin: 0 8px;">Terms of Service</a>
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

### 2. Password Reset (Forgot Password)
**Template Name**: `Reset Password`  
**Used For**: Mobile forgot password (email link method)

**Subject**:
```
Reset Your EZDine Pro Password
```

**Body** (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EZDine Pro - Reset Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px; text-align: center;">
              <div style="background-color: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
                <img src="https://yourdomain.com/logo.png" alt="EZDine Logo" style="width: 60px; height: 60px; object-fit: contain;">
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">EZDine Pro</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Restaurant Operating System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 900;">Reset Your Password</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>60 minutes</strong>.
              </p>
              
              <!-- Reset Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 25px rgba(255, 107, 53, 0.3);">
                  Reset Password
                </a>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #475569; font-size: 13px; font-weight: 600;">Or copy and paste this link:</p>
                <p style="margin: 0; color: #64748b; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">
                  {{ .ConfirmationURL }}
                </p>
              </div>
              
              <!-- Security Notice -->
              <div style="border-left: 4px solid #ef4444; background-color: #fee2e2; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
                  <strong>Security Alert:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will not be changed.
                </p>
              </div>
              
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Need help? Contact our support team at <a href="mailto:support@ezdine.com" style="color: #ff6b35; text-decoration: none; font-weight: 600;">support@ezdine.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; font-weight: 600;">
                © 2026 EZDine Pro. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1;">
                <a href="https://ezdine.com/privacy" style="color: #64748b; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="https://ezdine.com/terms" style="color: #64748b; text-decoration: none; margin: 0 8px;">Terms of Service</a>
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

### 3. Confirm Signup (Optional)
**Template Name**: `Confirm Signup`  
**Used For**: Email verification for new accounts (if enabled)

**Subject**:
```
Welcome to EZDine Pro - Verify Your Email
```

**Body**: Similar structure to above, with welcome message and verification button.

---

## 🔑 Available Template Variables

Supabase provides these variables you can use in templates:

- `{{ .Email }}` - User's email address
- `{{ .Token }}` - 6-digit OTP code
- `{{ .TokenHash }}` - Hashed token
- `{{ .ConfirmationURL }}` - Magic link URL
- `{{ .SiteURL }}` - Your site URL (configured in settings)
- `{{ .RedirectTo }}` - Redirect URL after confirmation

---

## ⚙️ Authentication Settings

### Step 3: Configure Auth Settings
Go to **Authentication** → **Settings**:

#### Email Auth
- ✅ **Enable Email Provider**: ON
- ✅ **Enable Email Confirmations**: OFF (for faster onboarding)
- ✅ **Secure Email Change**: ON
- ✅ **Double Confirm Email Changes**: ON

#### Email Rate Limits
- **Max emails per hour**: 10 (per user)
- **OTP expiry**: 3600 seconds (60 minutes)
- **OTP length**: 6 digits

#### Site URL
- **Site URL**: https://yourdomain.com
- **Redirect URLs**: 
  - https://yourdomain.com/auth/callback
  - https://yourdomain.com/dashboard
  - ezdine://auth/callback (for mobile deep linking)

---

## 📱 Mobile Deep Linking (Optional)

For mobile app to handle password reset links:

### iOS (Info.plist)
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ezdine</string>
    </array>
  </dict>
</array>
```

### Android (AndroidManifest.xml)
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="ezdine" />
</intent-filter>
```

---

## 🧪 Testing Email Templates

### Test OTP Login
1. Go to your app login screen
2. Click "OTP" tab
3. Enter your email
4. Click "Send OTP"
5. Check your inbox for the email
6. Verify the template looks correct
7. Copy the 6-digit code
8. Paste in app and verify

### Test Password Reset
1. Go to login screen
2. Click "Forgot Password?"
3. Enter your email
4. Click "Send Reset Link"
5. Check your inbox
6. Click the reset link
7. Verify it opens correctly
8. Set new password

---

## 🎨 Customization Tips

### Branding
1. Replace logo URL with your hosted logo
2. Update colors to match your brand
3. Customize footer links
4. Add social media links

### Content
1. Adjust tone to match your brand voice
2. Add helpful tips or FAQs
3. Include support contact info
4. Add unsubscribe link (if required)

### Design
1. Test on multiple email clients (Gmail, Outlook, Apple Mail)
2. Ensure mobile responsiveness
3. Use web-safe fonts
4. Keep file size under 100KB

---

## 🚨 Common Issues & Solutions

### Issue: Emails going to spam
**Solutions**:
- Set up SPF, DKIM, and DMARC records
- Use custom SMTP with verified domain
- Avoid spam trigger words
- Include unsubscribe link
- Warm up your sending domain

### Issue: OTP not received
**Solutions**:
- Check Supabase logs for errors
- Verify SMTP settings
- Check rate limits
- Test with different email providers
- Check spam folder

### Issue: Template not updating
**Solutions**:
- Clear browser cache
- Wait 5 minutes for changes to propagate
- Check for HTML syntax errors
- Test in incognito mode

### Issue: Links not working
**Solutions**:
- Verify Site URL in settings
- Check redirect URLs whitelist
- Test URL encoding
- Verify deep linking setup (mobile)

---

## 📊 Email Deliverability Best Practices

### Technical Setup
- ✅ Configure SPF record
- ✅ Configure DKIM signing
- ✅ Configure DMARC policy
- ✅ Use verified sending domain
- ✅ Monitor bounce rates

### Content Best Practices
- ✅ Clear subject lines
- ✅ Personalized content
- ✅ Mobile-responsive design
- ✅ Plain text alternative
- ✅ Unsubscribe option

### Monitoring
- Track open rates
- Monitor bounce rates
- Check spam complaints
- Review delivery logs
- Test regularly

---

## 🔐 Security Considerations

### OTP Security
- 6-digit codes (1 million combinations)
- 60-minute expiration
- Rate limiting (10 per hour)
- One-time use only
- Secure transmission (HTTPS)

### Password Reset Security
- Unique token per request
- 60-minute expiration
- Invalidate after use
- Require re-authentication
- Log all reset attempts

---

## 📝 Quick Setup Checklist

- [ ] Access Supabase Dashboard
- [ ] Configure SMTP settings (optional)
- [ ] Update "Magic Link" template
- [ ] Update "Reset Password" template
- [ ] Set Site URL and Redirect URLs
- [ ] Configure rate limits
- [ ] Test OTP login flow
- [ ] Test password reset flow
- [ ] Verify emails not in spam
- [ ] Check mobile deep linking (if applicable)
- [ ] Monitor delivery rates
- [ ] Set up SPF/DKIM/DMARC (production)

---

## 🎯 Production Readiness

### Before Launch
1. ✅ Custom SMTP configured
2. ✅ Domain verified
3. ✅ SPF/DKIM/DMARC set up
4. ✅ Templates customized
5. ✅ All flows tested
6. ✅ Monitoring enabled
7. ✅ Support email configured
8. ✅ Legal links added

### After Launch
1. Monitor delivery rates
2. Check spam reports
3. Review user feedback
4. Optimize templates
5. A/B test subject lines
6. Track conversion rates

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **Email Templates**: https://supabase.com/docs/guides/auth/auth-email-templates
- **SMTP Setup**: https://supabase.com/docs/guides/auth/auth-smtp
- **Deep Linking**: https://supabase.com/docs/guides/auth/auth-deep-linking

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026  
**Status**: Ready for Implementation  
**Estimated Setup Time**: 30-60 minutes
