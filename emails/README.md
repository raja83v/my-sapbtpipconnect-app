# Email Templates

This directory contains all email templates for the application using React Email.

**Branding Configuration:** All branding (app name, colors, URLs, support email, etc.) is centralized in `lib/config.ts`. Update `siteConfig.email` to customize for your application.

## Directory Structure

```
emails/
├── templates/
│   ├── components/
│   │   └── email-layout.tsx    # Reusable email layout with branding from siteConfig
│   ├── welcome-email.tsx        # Welcome email for new users
│   ├── workspace-invitation.tsx # Workspace invitation email
│   ├── email-verification.tsx   # Email address verification
│   └── password-reset.tsx       # Password reset email
└── index.ts                     # Template registry (type-safe)
```

## Available Templates

### 1. Welcome Email
Sent when a new user signs up.

**Template ID:** `EmailTemplateId.WORKSPACE_WELCOME`

**Data:**
- `firstName`: User's first name
- `dashboardUrl`: URL to complete setup

### 2. Workspace Invitation
Sent when inviting a user to join a workspace.

**Template ID:** `EmailTemplateId.WORKSPACE_INVITATION`

**Data:**
- `inviterName`: Name of person sending invitation
- `workspaceName`: Name of workspace
- `inviteeEmail`: Email of invited user
- `acceptUrl`: URL to accept invitation
- `declineUrl`: URL to decline invitation (optional)

### 3. Email Verification
Sent to verify a user's email address.

**Template ID:** `EmailTemplateId.EMAIL_VERIFICATION`

**Data:**
- `firstName`: User's first name
- `verificationUrl`: URL to verify email

### 4. Password Reset
Sent when a user requests to reset their password.

**Template ID:** `EmailTemplateId.PASSWORD_RESET`

**Data:**
- `firstName`: User's first name
- `resetUrl`: URL to reset password
- `expiresInMinutes`: How long the link is valid (typically 60)

## Development

### Preview Templates

Run the React Email dev server to preview and develop templates:

```bash
pnpm email
```

This will start a preview server at `http://localhost:3001` where you can:
- View all email templates
- See how they render in different email clients
- Test with different data using PreviewProps
- Hot reload as you make changes

### Sending Emails

Use the server actions from `app/actions/email.ts`:

```typescript
import { sendWelcomeEmail } from "@/app/actions/email";

// Send a welcome email
const result = await sendWelcomeEmail(
  {
    firstName: "John",
    dashboardUrl: "https://yourdomain.com/dashboard"
  },
  "john@example.com"
);

if (result.success) {
  console.log("Email sent with ID:", result.data.emailId);
} else {
  console.error("Failed to send email:", result.error);
}
```

### Using Template Registry

For type-safe email rendering:

```typescript
import { getEmailTemplate } from "@/emails";
import { EmailTemplateId } from "@/lib/notifications/types";

const template = getEmailTemplate(EmailTemplateId.WORKSPACE_WELCOME);
const { subject, previewText, component } = template.render({
  firstName: "John",
  dashboardUrl: "https://yourdomain.com/dashboard"
});
```

### Utility Functions

Use helper functions from `lib/notifications/utils.ts`:

```typescript
import {
  buildWelcomeEmailData,
  buildWorkspaceInvitationData,
  extractFirstName
} from "@/lib/notifications/utils";

// Build email data with proper URLs
const data = buildWelcomeEmailData("John", "/dashboard");

// Extract first name from full name
const firstName = extractFirstName("John Doe"); // "John"
```

## Environment Setup

### Required Environment Variables

```env
RESEND_API_KEY=your-resend-api-key
```

Get your API key from: https://resend.com/api-keys

### Optional Environment Variables

```env
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name
SUPPORT_EMAIL=support@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

If not set, these will fallback to values from `siteConfig.email` in `lib/config.ts`.

## Email Service

The email sending service (`lib/notifications/email-service.ts`) provides:

- `sendTemplateEmail()` - Send any template with type safety
- `sendCustomEmail()` - Send custom HTML emails
- `sendBatchEmails()` - Send to multiple recipients
- `isValidEmail()` - Validate email addresses

## Customization

### Branding Configuration

Edit `lib/config.ts` to customize your email branding:

```typescript
export const siteConfig = {
  name: "Your App Name",
  // ... other config
  email: {
    brandName: "Your App Name",
    tagline: "Your app description for email footers",
    supportEmail: "support@yourdomain.com",
    fromEmail: "noreply@yourdomain.com",
    fromName: "Your App Name",
  },
};
```

### Visual Styling

Edit `emails/templates/components/email-layout.tsx` to customize:
- Brand colors (currently using purple: #9B99FE)
- Typography and fonts
- Button styles
- Layout spacing

### Adding New Templates

1. Define the template ID in `lib/notifications/types.ts`:

```typescript
export enum EmailTemplateId {
  // ... existing templates
  MY_NEW_TEMPLATE = "my-new-template",
}
```

2. Add template data type:

```typescript
export type EmailTemplateData = {
  // ... existing types
  [EmailTemplateId.MY_NEW_TEMPLATE]: {
    // your data fields
  };
};
```

3. Create template file in `emails/templates/my-new-template.tsx`

4. Add to registry in `emails/index.ts`:

```typescript
import { myNewTemplate } from "./templates/my-new-template";

export const emailTemplates: EmailTemplateRegistry = {
  // ... existing templates
  [EmailTemplateId.MY_NEW_TEMPLATE]: myNewTemplate,
};
```

5. (Optional) Add server action in `app/actions/email.ts`

## Testing

Test emails in development:

```typescript
// Check if email sending is enabled
import { isEmailEnabled } from "@/lib/notifications/utils";

if (isEmailEnabled()) {
  // Send email
} else {
  console.log("Email sending disabled (no RESEND_API_KEY)");
}
```

## Best Practices

1. **Always use server actions** - Never call email service directly from client
2. **Validate email addresses** - Use `isValidEmail()` before sending
3. **Use utility builders** - Use `buildWelcomeEmailData()` etc. for consistent URLs
4. **Handle errors gracefully** - Check `result.success` before assuming email sent
5. **Log email events** - Use `logEmailEvent()` for debugging in development
6. **Preview before deploying** - Use `pnpm email` to preview templates
7. **Centralize branding** - Always use `siteConfig` instead of hardcoded values

## Resources

- [React Email Documentation](https://react.email/docs/introduction)
- [Resend Documentation](https://resend.com/docs)
- [Email Client Support](https://www.caniemail.com/)
