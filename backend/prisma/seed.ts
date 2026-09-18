import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin.';

  // Sistema de un único administrador: cualquier otro usuario residual se elimina.
  await prisma.user.deleteMany({ where: { username: { not: username } } });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
  console.log(`Usuario admin listo: ${username}`);

  await prisma.monitorConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
