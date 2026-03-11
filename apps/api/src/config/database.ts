const { PrismaClient } =
    process.env.NODE_ENV === 'test'
        ? require('../test/client')
        : require('@prisma/client');

export const prisma = new PrismaClient();
