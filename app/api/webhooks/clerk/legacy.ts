import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { triggerWorkflow } from '../../notifications/route';

// Define interfaces for type safety and clarity
interface Subscriber {
  subscriberId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  locale?: string;
  avatar?: string;
  data?: {
    username?: string;
    clerkUserId?: string;
  };
}

interface EmailPayload {
  subject: string;
  [key: string]: any; // Flexible key-value pairs for additional email-specific data
}

// const payload = {
//     verification_code: {
//         workflowId: 'clerk-verification-code',

//         payload: {
//             subject: emailData.subject || '',
//             otp_code: emailData.otp_code || '',
//             app: { name: emailData.app?.name || '' },
//             requested_by: emailData.requested_by || '',
//             requested_from: emailData.requested_from || '',
//             requested_at: emailData.requested_at || '',
//             device: emailData.requested_by || ''
//         }
//     }
// }
// Mapping of email slugs to payload builders for cleaner event handling
const emailPayloadBuilders: Record<string, (emailData: any) => EmailPayload> = {
  verification_code: (emailData) => ({
    subject: emailData.subject || '',
    otp_code: emailData.otp_code || '',
    app: { name: emailData.app?.name || '' },
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
  password_changed: (emailData) => ({
    subject: emailData.subject || '',
    greeting_name: emailData.greeting_name || '',
    primary_email_address: emailData.primary_email_address || '',
    app: { name: emailData.app?.name || '' },
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
  magic_link_sign_in: (emailData) => ({
    subject: emailData.subject || '',
    magic_link: emailData.magic_link || '',
    app: { name: emailData.app?.name || '' },
    ttl_minutes: emailData.ttl_minutes || '',
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
  reset_password_code: (emailData) => ({
    subject: emailData.subject || '',
    otp_code: emailData.otp_code || '',
    app_name: emailData.app?.name || '',
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
  organization_invitation: (emailData) => ({
    subject: emailData.subject || '',
    inviter_name: emailData.inviter_name || '',
    org_name: emailData.org?.name || '',
    app: { name: emailData.app?.name || '' },
    action_url: emailData.action_url || '',
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
  invitation: (emailData) => ({
    subject: emailData.subject || '',
    otp_code: emailData.otp_code || '',
    app: { name: emailData.app?.name || '' },
    requested_by: emailData.requested_by || '',
    requested_from: emailData.requested_from || '',
    requested_at: emailData.requested_at || '',
    device: emailData.requested_by || ''
  }),
};

/**
 * Main handler for incoming Clerk webhook requests.
 * Processes 'user.created' and 'email.created' events and triggers Novu workflows.
 * @param req - The incoming HTTP request containing the webhook payload.
 * @returns A Response object indicating success or failure.
 */
export async function POST(req: Request) {
  let event: WebhookEvent;

  // Verify the Clerk webhook signature
  try {
    event = await verifyClerkWebhook(req);
  } catch (error: any) {
    return new Response(error.message || 'Webhook verification failed', { status: 400 });
  }

  // Handle 'user.created' event
  if (event.type === 'user.created') {
    const data = event.data;
    const subscriber: Subscriber = {
      subscriberId: data.id,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      email: data.email_addresses[0]?.email_address || '',
      phone: data.phone_numbers?.[0]?.phone_number || '',
      locale: 'en_US', // Default locale
      avatar: data.image_url || '',
      data: {
        username: data.username || '',
        clerkUserId: data.id || '',
      },
    };

    try {
      // Log the workflow trigger details for user creation
      console.log('Triggering user.created workflow with:', {
        workflowId: 'clerk-user-created',
        subscriber,
        payload: {}
      });
      // Trigger the Novu workflow for user creation
      await triggerWorkflow('clerk-user-created', subscriber, {});
    } catch (error) {
      console.error('Failed to trigger Novu workflow for user.created:', error);
    }
  }

  // Handle 'email.created' event
  if (event.type === 'email.created') {
    const data = event.data;
    const emailData = data.data;
    const subscriber: Subscriber = {
      subscriberId: `clerk_${data.to_email_address || ''}`,
      email: data.to_email_address || '',
    };

    // Look up the payload builder based on the email slug
    const builder = emailPayloadBuilders[data.slug || ''];
    if (builder && emailData) {
      const payload = builder(emailData);
      const workflowId = `${data.slug?.replace(/_/g, '-') || ''}`; // Convert slug to workflow ID

      try {
        // Log the workflow trigger details for email events
        console.log('Triggering workflow with:', {
          workflowId,
          subscriber,
          payload,
          originalEmailData: emailData
        });
        // Trigger the Novu workflow for the specific email event
        await triggerWorkflow(workflowId, subscriber, payload);
      } catch (error) {
        console.error(`Failed to trigger Novu workflow for ${workflowId}:`, error);
      }
    }
  }

  return new Response('Webhook received', { status: 200 });
}

/**
 * Verifies the Clerk webhook signature to ensure authenticity.
 * @param req - The incoming request containing headers and body.
 * @returns The verified WebhookEvent if successful.
 * @throws Error if verification fails or required data is missing.
 */
async function verifyClerkWebhook(req: Request): Promise<WebhookEvent> {
  const signingSecret = process.env.CLERK_SIGNING_SECRET;

  // Ensure the signing secret is configured
  if (!signingSecret) {
    throw new Error('Error: Please add CLERK_SIGNING_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const webhook = new Webhook(signingSecret);

  // Extract Svix headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix headers');
  }

  // Parse the request body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  try {
    // Verify the webhook signature
    return webhook.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    throw new Error('Webhook verification failed');
  }
}