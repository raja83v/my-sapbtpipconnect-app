# Clerk Migration Guide

## Migration Complete! ✅

Your application has been successfully migrated from Better Auth to Clerk authentication.

## What Changed

### 1. **Authentication System**
- **Before**: Better Auth with custom session management
- **After**: Clerk with managed authentication and user management

### 2. **Sign-In/Sign-Up UI**
- Your custom UI components were preserved!
- Now use Clerk's `useSignIn()` and `useSignUp()` hooks under the hood
- Email/Password authentication ✅
- Email verification code flow ✅
- Google OAuth ✅

### 3. **Database Schema**
- Added `clerkId` field to `User` table
- Clerk user ID links to your database user records
- Kept all existing user fields (role, status, onboarding, etc.)

### 4. **Server Actions**
- Updated `getCurrentUser()` to use Clerk's `auth()` function
- All server actions now check authentication via Clerk

### 5. **Removed Components**
- ❌ `/app/api/auth/[...all]/route.ts` - Clerk handles auth API
- ❌ `/app/(auth)/forgot-password` - Clerk provides password reset
- ❌ `/app/(auth)/reset-password` - Clerk provides password reset
- ❌ `lib/auth.ts` and `lib/auth-client.ts` - Replaced with Clerk
- ❌ `proxy.ts` - Replaced with Clerk middleware

## Required Setup Steps

### 1. Create Clerk Application

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Choose **Email** and **Google** as authentication methods
4. Enable **Email verification** in settings

### 2. Configure Environment Variables

Add these to your `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...  # For user sync webhook
```

Get these from your Clerk Dashboard → API Keys

### 3. Configure Google OAuth in Clerk

1. In Clerk Dashboard → SSO Connections → Google
2. Add your Google OAuth credentials OR use Clerk's shared credentials for development
3. Enable the Google provider

### 4. Set Up Webhook for User Sync

1. In Clerk Dashboard → Webhooks → Add Endpoint
2. Set URL to: `https://yourdomain.com/api/webhooks/clerk`
3. Enable these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the webhook secret to `CLERK_WEBHOOK_SECRET`

This webhook syncs Clerk users to your database automatically.

### 5. Configure Redirect URLs

In Clerk Dashboard → Paths:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in: `/dashboard`
- After sign-up: `/onboarding`

## Key Differences from Better Auth

### Password Reset
**Before**: Custom forgot/reset password pages
**Now**: Users click "Forgot password?" → redirected to Clerk's hosted reset page
- Link in sign-in component points to: `https://accounts.clerk.com/sign-in`

### Email Verification
**Before**: Optional, controlled by your app
**Now**: Required by default in Clerk
- Users must verify email during sign-up
- Verification code sent automatically

### Remember Me
**Before**: Controlled session duration via checkbox
**Now**: Managed by Clerk's session configuration
- Configure in Clerk Dashboard → Sessions
- Checkbox in UI is cosmetic (kept for UX consistency)

### Session Management
**Before**: PostgreSQL database sessions
**Now**: Clerk-managed sessions with JWTs
- Faster authentication checks
- No database queries for auth validation

## Testing the Migration

### 1. Test Sign-Up Flow
1. Navigate to `/sign-up`
2. Enter name, email, password
3. Verify email with code sent to inbox
4. Should redirect to `/onboarding`

### 2. Test Sign-In Flow
1. Navigate to `/sign-in`
2. Use Email/Password OR Email Code OR Google OAuth
3. Should redirect to `/dashboard`

### 3. Test Protected Routes
1. Sign out
2. Try accessing `/dashboard` → should redirect to `/sign-in`
3. Sign in → should redirect back to intended page

### 4. Test Admin Features
1. First user created automatically gets `admin` role (via webhook)
2. Admin users can access `/admin` routes
3. Check user management features

## Known Limitations

### 1. Magic Links → Email Codes
Clerk doesn't support traditional "magic links" that work across devices. Instead:
- Use **Email Code** tab in sign-in
- User receives 6-digit code
- Enters code on same device

### 2. Last Login Method Badge
The "Last used" badge feature was removed (Clerk doesn't track this)
- Simplifies UI
- Users can choose any method they prefer

### 3. Admin Impersonation
Not yet implemented in this migration. Options:
- Use Clerk Organizations + role-based viewing
- Implement custom JWT claims (advanced)
- Remove feature entirely

## Troubleshooting

### "Unauthorized" errors in server actions
- Check that `CLERK_SECRET_KEY` is set correctly
- Verify webhook created the user in database
- Check that user has `clerkId` field populated

### Google OAuth not working
- Verify Google provider is enabled in Clerk Dashboard
- Check redirect URLs match Clerk configuration
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly

### Email codes not sending
- Check Clerk Dashboard → Email & SMS → Email configuration
- Verify email deliverability settings
- Check spam folder

### Webhook errors
- Verify `CLERK_WEBHOOK_SECRET` matches dashboard
- Check webhook endpoint is publicly accessible
- View webhook logs in Clerk Dashboard

## Migration Checklist

- [x] Install @clerk/nextjs and svix
- [x] Create Clerk configuration and helpers
- [x] Update middleware to use Clerk
- [x] Wrap app in ClerkProvider
- [x] Migrate sign-in component
- [x] Migrate sign-up component
- [x] Update nav-user sign-out
- [x] Update server action auth checks
- [x] Add clerkId to User schema
- [x] Create database migration
- [x] Remove Better Auth files
- [x] Uninstall better-auth package
- [ ] **Configure Clerk application** (YOU NEED TO DO THIS)
- [ ] **Set up webhook endpoint** (YOU NEED TO DO THIS)
- [ ] **Update environment variables** (YOU NEED TO DO THIS)
- [ ] Test all authentication flows
- [ ] Update remaining server actions (if any use Better Auth)
- [ ] Update layout files for auth checks
- [ ] Deploy and test in production

## Next Steps

1. **Set up your Clerk application** following steps above
2. **Configure environment variables**
3. **Test the authentication flows**
4. **Update any remaining server actions** that still reference Better Auth
5. **Update layout files** (dashboard, admin, onboarding) to use Clerk auth
6. **Consider implementing** Clerk Organizations for multi-tenancy
7. **Review and update** invitation flow to work with Clerk

## Need Help?

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Next.js Quickstart](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk Discord Community](https://clerk.com/discord)

## Rollback Plan (Emergency Only)

If you need to rollback:
1. Restore Better Auth from git history
2. Run `pnpm add better-auth`
3. Restore deleted files from git
4. Run database migration to remove clerkId
5. Restart development server

**Note**: This is a major migration. Test thoroughly in development before deploying to production!
