import { PrismaClient } from '@prisma/client';

const g = globalThis as { prisma?: PrismaClient };
export const db = (g.prisma ??= new PrismaClient());
