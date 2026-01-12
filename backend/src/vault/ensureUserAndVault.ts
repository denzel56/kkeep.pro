import { prisma } from "../db/prisma.js";

export async function ensureUserAndVault(userId: string) {
  await prisma.user.upsert({
    where: {id: userId},
    update: {},
    create: {id: userId},
  })

  const vault =  await prisma.vault.upsert({
    where: {userId},
    update: {},
    create: {
      userId,
      blob: '',
    },
    select: {
      userId: true,
      blob: true,
      updatedAt: true,
    }
  })

  return vault
}