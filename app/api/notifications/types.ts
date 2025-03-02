import { z } from "zod";

export const SubscriberSchema = z.object({
  subscriberId: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  locale: z.string().optional(),
  avatar: z.string().optional(),
  data: z.object({
    username: z.string().optional(),
  }).optional(),
});

export const PayloadSchema = z.object({
  payload: z.any(),
});

export const WorkflowSchema = z.string();



