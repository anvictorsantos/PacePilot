import { z } from 'zod'

import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/modules/auth/domain/password-policy.ts'

export const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(EMAIL_MAX_LENGTH).email('A valid email is required'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
})

export type Credentials = z.infer<typeof credentialsSchema>

const emailField = z.string().trim().min(3).max(EMAIL_MAX_LENGTH).email('A valid email is required')

const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)

export const emailSchema = z.object({ email: emailField })

export const emailTokenSchema = z.object({
  token: z.string().trim().min(20).max(512),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(512),
  password: passwordField,
})
