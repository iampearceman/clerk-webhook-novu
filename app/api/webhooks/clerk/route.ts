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