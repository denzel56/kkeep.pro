import Fastify  from "fastify";
import { prisma } from "./db/prisma.js";
import { ensureUserAndVault } from "./vault/ensureUserAndVault.js";
import { verifyTelegramInitData } from "./auth/verifyTelegramInitData.js";

const app = Fastify({ logger: true });

app.decorateRequest('userId', '');

app.addHook('preHandler', async (request) => {
  const userId = process.env.TEMP_USER_ID

  if (!userId) {
    throw new Error('TEMP_USER_ID is not set')
  }

  request.userId = userId
})

app.get("/health", async () => (
  {ok: true}
))

app.get("/whoami", async (request) => {
  return {userId: request.userId}
})

app.listen({port: 3000}).catch((err) => {
  app.log.error(err)
  process.exit(1)
})

app.get("/db-ping", async () => {
  await prisma.$queryRaw`SELECT 1`
  return {ok: true}
})

app.post<{
  Body: { initData: string }
}>("/auth/telegram", async (request, reply) => {
  const initData = request.body?.initData

  if (typeof initData !== 'string' || initData.length === 0) {
    return reply.code(400).send({ error: 'initData must be a non-empty string' })
  }
  
  try {
    const verified = verifyTelegramInitData(initData)

    return {
      ok: true,
      userId: verified.queryId,
      authDate: verified.authDate,
      queryId: verified.queryId,
    }
  } catch (err) {
    request.log.warn({err}, 'telegram initData verification failed')
    return reply.code(400).send({error: 'Invalid initData'})
  }
})

app.get("/vault", async (request) => {
  const vault = await ensureUserAndVault(request.userId)

  return {
    userId: vault.userId,
    blob: vault.blob,
    updatedAt: vault.updatedAt.toISOString()
  }
})

app.put<{
  Body: {
    blob: string
  }
}>("/vault", async (request, reply) => {
  const { blob } = request.body ?? {} as any

  if (typeof blob !== 'string') {
    return reply.code(400).send({error: 'blob is not a string'})
  }

  await ensureUserAndVault(request.userId)

  const vault = await prisma.vault.update({
    where: { 
      userId: request.userId
    },
    data: { blob },
    select: {
      userId: true,
      blob: true,
      updatedAt: true,
    }
  })

  return {
    userId: vault.userId,
    blob: vault.blob,
    updatedAt: vault.updatedAt.toISOString()
  }
})