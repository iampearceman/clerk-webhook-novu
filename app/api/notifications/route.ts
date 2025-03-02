import { Novu } from '@novu/api';
const novu = new Novu({
    secretKey: process.env['NOVU_SECRET_KEY']
});

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