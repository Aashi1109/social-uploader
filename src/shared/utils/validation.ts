import { z } from 'zod';

export const PublishRequestSchema = z.object({
	projectId: z.string().min(1),
	mediaUrl: z.string().url(),
	idempotencyKey: z.string().min(1).optional(),
	title: z.string().max(200).optional(),
	description: z.string().max(2000).optional(),
	platforms: z.array(z.enum(['instagram', 'youtube'])).optional(),
});

export type PublishRequest = z.infer<typeof PublishRequestSchema>;


