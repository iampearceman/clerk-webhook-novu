import Stripe from "stripe";
import { NextResponse, NextRequest } from "next/server";
import { triggerWorkflow } from "../../notifications/route";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const webhookPayload = await request.text();
  const response = JSON.parse(webhookPayload);

  const signature = request.headers.get("Stripe-Signature");

  try {
    let event = stripe.webhooks.constructEvent(
      webhookPayload,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (supportedEvents.includes(event.type)) {
      const workflow = event.type.replaceAll(".", "-");
      const subscriber = await buildSubscriberData(response);
      const payload = await payloadBuilder(response);
      console.log(
        "Triggering workflow:", workflow,
        "Subscriber:", subscriber,
        "Payload:", payload
      );
      return await triggerWorkflow(workflow, subscriber, payload);
    }

    return NextResponse.json({ status: "sucess", event: event.type, response: response });
  } catch (error) {
    return NextResponse.json({ status: "Failed", error });
  }
}

const supportedEvents = [
  "customer.subscription.created",
  "customer.subscription.updated",
];

async function buildSubscriberData(response: any) {
  const customer = await stripe.customers.retrieve(response.data.object.customer);
  console.log("Customer", customer);
  
  if ('deleted' in customer) {
    throw new Error('Customer has been deleted');
  }
  
  // Split the full name into first and last name
  const [firstName = '', lastName = ''] = (customer.name || '').split(' ');
  
  return {
    subscriberId: customer.id,
    email: customer.email || 'test2@test.com',
    firstName: firstName || '',
    lastName: lastName || '',
    phone: customer?.phone || '',
    locale: customer?.preferred_locales?.[0] || 'en', // Use first preferred locale or default to 'en'
    avatar: '', // Stripe customer doesn't have avatar
    data: {
      stripeCustomerId: customer.id,
    },
  };
}

async function payloadBuilder(response: any) {
  const webhookData = JSON.parse(response);
  return webhookData;
}

