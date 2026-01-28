import { z } from 'zod';

// Auth Schemas
export const loginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Please enter a valid email'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email'),
});

export const resetPasswordSchema = z.object({
    newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

// Stream Schemas
export const streamCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
    description: z.string().max(500, 'Description must be at most 500 characters').optional(),
    category: z.string().optional(),
    isPublic: z.boolean().default(true),
    isMonetized: z.boolean().default(false),
});

// Tip Schemas
export const tipSchema = z.object({
    amount: z.number()
        .min(1, 'Minimum tip is $1')
        .max(500, 'Maximum tip is $500'),
    message: z.string().max(200, 'Message must be at most 200 characters').optional(),
});

// Report Schema
export const reportSchema = z.object({
    reason: z.enum(['spam', 'harassment', 'inappropriate', 'copyright', 'other']),
    description: z.string().max(500, 'Description must be at most 500 characters').optional(),
});

// Contact Schema
export const contactSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Please enter a valid email'),
    subject: z.string().min(1, 'Subject is required'),
    message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message must be at most 1000 characters'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type StreamCreateInput = z.infer<typeof streamCreateSchema>;
export type TipInput = z.infer<typeof tipSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ContactInput = z.infer<typeof contactSchema>;

// Helper for validation
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    for (const err of result.error.issues) {
        const path = err.path.map(String).join('.');
        if (!errors[path]) {
            errors[path] = err.message;
        }
    }

    return { success: false, errors };
}
