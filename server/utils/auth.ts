// Get the authenticated user's email from Cloudflare Access header.
// Falls back to DEV_USER_EMAIL in local development.

export function getUserEmail(event: any): string {
  // Cloudflare Access sets this header after authentication
  const cfEmail = getHeader(event, 'cf-access-authenticated-user-email')
  if (cfEmail) return cfEmail.toLowerCase()

  // Local dev fallback
  const config = useRuntimeConfig()
  const devEmail = config.devUserEmail
  if (devEmail) return devEmail.toLowerCase()

  throw createError({
    statusCode: 401,
    message: 'Not authenticated',
  })
}
