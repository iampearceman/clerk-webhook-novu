import { Novu } from '@novu/api';

const novu = new Novu({
    secretKey: process.env['NOVU_SECRET_KEY']
});

export async function triggerWorkflow(workflow: string, subscriber: object, payload: object) {
    try {
        await novu.trigger({
            workflowId: workflow,
            to: subscriber as any,
            payload: payload as any
        });
        return new Response(JSON.stringify({ message: 'Notification triggered successfully' }), { status: 200 });
    } catch (error) {
        console.error('Error triggering notification:', error);
        return new Response(JSON.stringify({ message: 'Failed to trigger notification' }), { status: 500 });
    }
}



