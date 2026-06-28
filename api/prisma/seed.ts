import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'products.read',
  'products.write',
  'orders.read',
  'orders.write',
  'customers.read',
  'customers.write',
  'coupons.write',
  'reports.read',
  'settings.write',
];

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('Seed: iniciando...');

  // Permissões
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@loja.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: adminEmail,
      password: passwordHash,
      role: 'ADMIN',
      status: 'ATIVO',
      emailVerifiedAt: new Date(),
    },
  });

  // Vincula todas as permissões ao admin
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: admin.id, permissionId: permission.id } },
      update: {},
      create: { userId: admin.id, permissionId: permission.id },
    });
  }

  // Cliente de teste
  await prisma.user.upsert({
    where: { email: 'cliente@loja.com' },
    update: {},
    create: {
      name: 'Cliente Teste',
      email: 'cliente@loja.com',
      password: await bcrypt.hash('Cliente@123', 10),
      role: 'CLIENTE',
      status: 'ATIVO',
      emailVerifiedAt: new Date(),
      customer: { create: { newsletter: true } },
    },
  });

  // Marcas
  const brandsData = ['Acme', 'Nimbus', 'Vertex'];
  const brands = [] as { id: string }[];
  for (const name of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brands.push(brand);
  }

  // Categorias
  const categoriesData = ['Eletrônicos', 'Moda', 'Casa & Decoração', 'Esportes'];
  const categories = [] as { id: string }[];
  for (const name of categoriesData) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categories.push(category);
  }

  // Produtos de exemplo
  const sampleProducts = [
    { name: 'Fone de Ouvido Bluetooth', price: 299.9, promoPrice: 249.9, stock: 50 },
    { name: 'Camiseta Premium Algodão', price: 89.9, stock: 120 },
    { name: 'Luminária de Mesa LED', price: 159.9, stock: 30 },
    { name: 'Tênis de Corrida Pro', price: 459.9, promoPrice: 399.9, stock: 25 },
    { name: 'Mochila Antifurto', price: 219.9, stock: 0 },
  ];

  for (let i = 0; i < sampleProducts.length; i++) {
    const p = sampleProducts[i];
    const sku = `SKU-${String(i + 1).padStart(4, '0')}`;
    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        name: p.name,
        slug: slugify(p.name),
        sku,
        description: `Descrição detalhada de ${p.name}.`,
        shortDescription: `${p.name} de alta qualidade.`,
        price: new Prisma.Decimal(p.price),
        promoPrice: p.promoPrice ? new Prisma.Decimal(p.promoPrice) : null,
        stock: p.stock,
        status: 'PUBLICADO',
        featured: i < 3,
        brandId: brands[i % brands.length].id,
        categories: {
          create: { categoryId: categories[i % categories.length].id },
        },
        images: {
          create: {
            url: `/placeholder.svg?height=600&width=600&query=${encodeURIComponent(p.name)}`,
            alt: p.name,
            isCover: true,
          },
        },
      },
    });
  }

  // Cupom de exemplo
  await prisma.coupon.upsert({
    where: { code: 'BEMVINDO10' },
    update: {},
    create: {
      code: 'BEMVINDO10',
      description: '10% de desconto para novos clientes',
      type: 'PERCENTUAL',
      value: new Prisma.Decimal(10),
      minPurchase: new Prisma.Decimal(50),
      active: true,
    },
  });

  console.log('Seed: concluído com sucesso.');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
