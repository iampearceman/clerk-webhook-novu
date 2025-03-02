import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { triggerWorkflow } from '../../notifications/route'

export async function POST(request: Request) {
    try {
        const SIGNING_SECRET = process.env.SIGNING_SECRET
        if (!SIGNING_SECRET) {
            throw new Error('Please add SIGNING_SECRET from Clerk Dashboard to .env')
        }

        const webhook = new Webhook(SIGNING_SECRET)
        const headerPayload = await headers()
        const validatedHeaders = validateHeaders(headerPayload)

        const payload = await request.json()
        const body = JSON.stringify(payload)

        const event = await verifyWebhook(webhook, body, {
            'svix-id': validatedHeaders.svix_id,
            'svix-timestamp': validatedHeaders.svix_timestamp,
            'svix-signature': validatedHeaders.svix_signature,
        })

        await handleWebhookEvent(event)

        return new Response('Webhook received', { status: 200 })
    } catch (error) {
        console.error('Webhook processing error:', error)
        return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 400 })
    }
}

const handleWebhookEvent = async (event: WebhookEvent) => {
    if (event.type !== "user.created" && event.type !== "email.created") {
        return
    }

    const workflow = await workflowBuilder(event)
    const subscriber = await subscriberBuilder(event)
    const payload = await payloadBuilder(event)

    console.log("Triggering workflow:", workflow, "Subscriber:", subscriber, "Payload:", payload)
    await triggerWorkflow(workflow, subscriber, payload)
}

async function workflowBuilder(event: WebhookEvent) {
    let workflow = "";
    if (event.type === "user.created") {
        workflow = "user-created";
    } else if (event.type === "email.created") {
        workflow = `${event.data.slug?.replace(/_/g, '-') || ''}`;
    }
    return workflow;
}

async function subscriberBuilder(response: any) {

    // Rely only on webhook event data
    const webhookData = response.data;

    // Get the user from Clerk (Optional)
    // const user = await clerkClient.users.getUser(data.id);

    // Build the subscriber data
    return {
        subscriberId: webhookData.id, // Required field
        firstName: webhookData.first_name || '',
        lastName: webhookData.last_name || '',
        email: webhookData.email_addresses[0]?.email_address || '',
        phone: webhookData.phone_numbers?.[0]?.phone_number || '',
        locale: 'en_US', // Default locale
        avatar: webhookData.image_url || '',
        data: {
            username: webhookData.username || '',
            clerkUserId: webhookData.id || '',
        },
    }
}

async function payloadBuilder(response: any) {
    const webhookData = JSON.parse(response);
    return webhookData;
}

const validateHeaders = (headerPayload: Headers) => {
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new Error('Missing Svix headers')
    }

    return { svix_id, svix_timestamp, svix_signature }
}

const verifyWebhook = async (webhook: Webhook, body: string, headers: any): Promise<WebhookEvent> => {
    try {
        return webhook.verify(body, headers) as WebhookEvent
    } catch (err) {
        console.error('Error: Could not verify webhook:', err)
        throw new Error('Verification error')
    }
}

