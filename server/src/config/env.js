import dotenv from 'dotenv'
dotenv.config()

function requireEnv(name, fallback) {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Missing env: ${name}`)
  return v
}

const nodeEnv = process.env.NODE_ENV || 'development'

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Missing env: JWT_SECRET (required in production)')
}
if (nodeEnv === 'production' && !process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error('Missing env: TOKEN_ENCRYPTION_KEY (required in production)')
}
if (!process.env.JWT_SECRET) {
  console.warn('[env] JWT_SECRET missing — using dev fallback. Set JWT_SECRET before deploying.')
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pacepilot',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  stravaClientId: process.env.STRAVA_CLIENT_ID || '',
  stravaClientSecret: process.env.STRAVA_CLIENT_SECRET || '',
  stravaRedirectUri: process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv,
}
