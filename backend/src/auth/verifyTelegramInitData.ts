import crypto from 'node:crypto'

type TelegramUser = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
}

export type VerifiedTelegramInitData = {
  user: TelegramUser
  authDate: number
  queryId?: string
}

export function verifyTelegramInitData(initData: string, maxAgeSeconds = 60 * 60): VerifiedTelegramInitData {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set')
  }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')

  if  (!hash) {
    throw new Error('Missing hash')
  }

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  const hashBuffer = Buffer.from(hash, 'hex')
  const computedBuffer = Buffer.from(computedHash, 'hex')

  if (
    hashBuffer.length !== computedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, computedBuffer)
  ) {
    throw new Error('Invalid initData signature')
  }

  const authDateRaw = params.get('auth_date')
  if (!authDateRaw) {
    throw new Error('Missing auth_date')
  }

  const authDate = Number(authDateRaw)
  if (!Number.isFinite(authDate)) {
    throw new Error('Invalid auth_date')
  }

  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > maxAgeSeconds) {
    throw new Error('initData is too old')
  }

  const userRaw = params.get('user')
  if (!userRaw) {
    throw new Error('Missing user')
  }

  const user = JSON.parse(userRaw) as TelegramUser
  if (!user.id) {
    throw new Error('Invalid user payload')
  }

  const queryId = params.get('query_id') ?? undefined
  
  const result: VerifiedTelegramInitData = {
    user,
    authDate,
  }

  if (queryId) {
    result.queryId = queryId
  }
  
  return result
}