# Clerk Webhook Integration with Novu Notifications

## Introduction

This guide walks you through integrating **Clerk webhooks** with **Novu notifications** in a **Next.js** application. 

You’ll learn how to automatically trigger notification workflows when **any Clerk event** occurs, such as **user creation, email events, or password changes**.

---

## Overview

When specific events happen in Clerk (e.g., user signup, password changes, email verification), this integration will:
1. Receive the webhook event from Clerk.
2. Verify the webhook signature.
3. Process the event data.
4. Trigger the corresponding **Novu notification workflow**.

---

## Prerequisites

Before proceeding, ensure you have:

* A **Clerk + Next.js app** ([Set up Clerk](https://clerk.com/docs/quickstarts/nextjs)).
* A **ngrok account** ([Sign up here](https://dashboard.ngrok.com/signup)).
* A **Novu account** ([Sign up here](https://novu.com/signup)).

### 📌 Tip:

To simplify the setup, keep two browser tabs open:
* **Clerk Webhooks**: [Dashboard Link](https://dashboard.clerk.com/last-active?path=webhooks).
* **ngrok Dashboard**: [Dashboard Link](https://dashboard.ngrok.com/).

---

## Step 1: Install Dependencies

Run the following command to install the required packages:

```bash
npm install svix @novu/api @clerk/nextjs
```

--- 

## Step 2: Configure Environment Variables

Add the following variables to your `.env.local` file:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
SIGNING_SECRET=whsec_...
NOVU_SECRET_KEY=novu_secret_...
```

---

## Step 3: Set Up ngrok

To test webhooks locally, expose your **local server** using ngrok.
1. Create an account at [ngrok dashboard](https://dashboard.ngrok.com/).
2. Follow the [setup guide](https://dashboard.ngrok.com/get-started/setup).
3. Run the command (assuming your server runs on port `3000`):

```bash
ngrok http 3000
```

4. Copy and save the **Forwarding URL** (e.g., `https://your-ngrok-url.ngrok.io`).

---

## Step 4: Set Up Clerk Webhook Endpoint

1. Go to the **Clerk Webhooks** page ([link](https://dashboard.clerk.com/last-active?path=webhooks)).
2. Click **Add Endpoint**.
3. Set the **Endpoint URL** as:
   

```text
   https://your-ngrok-url.ngrok.io/api/webhooks/clerk
   ```

4. Subscribe to the **relevant Clerk events** (e.g.,  `user.created`,  `email.created` etc.).
5. Click **Create** and keep the settings page open.

---

## Step 5: Add Signing Secret to Environment Variables

1. Copy the **Signing Secret** from Clerk's **Webhook Endpoint Settings**.
2. Add it to your `.env.local` file:
   

```env
   SIGNING_SECRET=your_signing_secret_here
   ```

---

## Step 6: Make Webhook Route Public

Ensure the webhook route is public by updating `middleware.ts` :

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server';
export default clerkMiddleware({
  publicRoutes: ['/api/webhooks'],
});
```

---

## Step 7: Create Webhook Endpoint for Clerk in Next.js

Create `app/api/webhooks/clerk/route.ts` :

```typescript
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { triggerWorkflow } from '../../notifications/route'

export async function POST(req: Request) {
    const SIGNING_SECRET = process.env.SIGNING_SECRET

    if (!SIGNING_SECRET) {
        throw new Error('Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local')
    }

    // Create new Svix instance with secret
    const wh = new Webhook(SIGNING_SECRET)

    // Get headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing Svix headers', {
            status: 400,
        })
    }

    // Get body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    let evt: WebhookEvent

    // Verify payload with headers
    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as WebhookEvent
    } catch (err) {
        console.error('Error: Could not verify webhook:', err)
        return new Response('Error: Verification error', {
            status: 400,
        })
    }

    // Event handling

    if (evt.type === 'user.created') {
        console.log('userId:', evt.data.id, 'event:', evt.type)
        const data = evt.data;
        console.log('Clerk webhook data:', data);
        const subscriber = {
            subscriberId: 'clerk_' + (data.email_addresses[0].email_address || ''),
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            email: data.email_addresses[0].email_address || '',
            phone: data.phone_numbers?.[0]?.phone_number || '',
            locale: `en_US`, //default locale
            avatar: data.image_url || '',
            data: {
                clerkCreatedAt: data.created_at || '',
                lastSignInAt: data.last_sign_in_at || '',
                clerkUpdatedAt: data.updated_at || '',
                username: data.username || '',
                clerkUserId: data.id || '',
            }
        };
        const payload = {};
        try {
            await triggerWorkflow('clerk-user-created', subscriber as any, payload as any);
            console.log('Novu trigger successful');
        } catch (error) {
            console.error('Failed to trigger Novu workflow:', error);
        }
    }

    if (evt.type === 'user.updated') {
        console.log('userId:', evt.data.id)
    }

    if (evt.type === 'user.deleted') {
        console.log('userId:', evt.data.id)
    }
    
    // Email events (verification_code, password_changed, magic_link_sign_in, reset_password_code, organization_invitation, invitation)

    if (evt.type === 'email.created') {
        const data = evt.data;
        const subscriber = {
            subscriberId: 'clerk_' + (data.to_email_address || ''),
            email: data.to_email_address || '',
        };

        if (data.slug === 'verification_code' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        otp_code: data.data.otp_code || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-verification-code', subscriber as any, payload as any);
        }
        if (data.slug === 'password_changed' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        greeting_name: data.data.greeting_name || '',
                        primary_email_address: data.data.primary_email_address || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-password-changed', subscriber as any, payload as any);
        }
        if (data.slug === 'magic_link_sign_in' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        magic_link: data.data.magic_link || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        ttl_minutes: data.data.ttl_minutes || '',
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-magic-link-sign-in', subscriber as any, payload as any);
        }
        if (data.slug === 'reset_password_code' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        otp_code: data.data.otp_code || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-reset-password-code', subscriber as any, payload as any);
        }
        if (data.slug === 'organization_invitation' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        inviter_name: data.data.inviter_name || '',
                        org_name: data.data.org.name || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        action_url: data.data.action_url || '',
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-organization-invitation', subscriber as any, payload as any);
        }
        if (data.slug === 'invitation' && data.data) {
            const payload = {
                body: {
                    data: {
                        subject: data.subject || '',
                        otp_code: data.data.otp_code || '',
                        app: {
                            name: data.data.app.name || ''
                        },
                        requested_by: data.data.requested_by || '',
                        requested_from: data.data.requested_from || '',
                        requested_at: data.data.requested_at || '',
                        device: data.data.requested_by || ''
                    }
                }
            };
            await triggerWorkflow('clerk-invitation', subscriber as any, payload as any);
        }
    }

    return new Response('Webhook received', { status: 200 })
}
```

---

## Step 8: Add Novu Workflow Notification Trigger Function

Create `app/api/notifications/route.ts` :

```typescript
import { Novu } from '@novu/api';
const novu = new Novu(process.env.NOVU_SECRET_KEY);

export async function triggerWorkflow(workflowId: string, subscriber: object, payload: object) {
    try {
        await novu.trigger({
            workflowId,
            to: subscriber,
            payload
        });
        return new Response('Notification triggered', { status: 200 });
    } catch (error) {
        return new Response('Error triggering notification', { status: 500 });
    }
}
```

---

## Step 9: Add or create Novu workflows in your Novu dashboard

Each workflow should be triggered by a specific event.

For example, you can create a workflow to trigger when a user is created.

---

## Step 10: Test the Webhook

1. Start your Next.js server.
2. Go to **Clerk Webhooks → Testing**.
3. Select an event (e.g., `user.created`, `email.created`).
4. Click **Send Example**.
5. Verify logs in **your terminal**.

---

## Conclusion

You’ve successfully integrated Clerk webhooks with Novu to automate notifications for **any Clerk event**. Now, every time a **user is created, an email is sent, or a password is changed**, Novu will send notifications automatically!

Happy coding! 🚀
