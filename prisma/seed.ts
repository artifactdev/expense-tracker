import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The fixed single-user ID – matches LOCAL_USER_ID in utils/const.ts
const LOCAL_USER_ID = 'local_user_default';

const CATEGORIES = [
  { name: 'Generic', slug: 'generic', common: true },
  { name: 'Market', slug: 'market', common: true },
  { name: 'Electronics', slug: 'electronics', common: true },
  { name: 'Amazon', slug: 'amazon', common: true },
  { name: 'PayPal', slug: 'paypal', common: true },
  { name: 'Pharmacy', slug: 'pharmacy', common: true },
  { name: 'ATM', slug: 'atm', common: true },
  { name: 'Home Delivery', slug: 'home-delivery', common: true },
  { name: 'Barber', slug: 'barber', common: true },
  { name: 'Paycheck', slug: 'paycheck', common: true },
  { name: 'Restaurants', slug: 'restaurants', common: true },
  { name: 'Sports', slug: 'sports', common: true },
  { name: 'Clothing', slug: 'clothing', common: true },
];

async function main() {
  console.log('Seeding database...');

  // Upsert all common categories
  const categoryRecords = await Promise.all(
    CATEGORIES.map(cat =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      })
    )
  );

  console.log(`Seeded ${categoryRecords.length} categories`);

  // Upsert default local user
  const user = await prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: {
      id: LOCAL_USER_ID,
      name: 'Local User',
      email: 'local@expense-tracker.local',
      currency: 'EUR',
      dateFormat: 'EU',
      theme: 'system',
    },
  });

  console.log(`Seeded user: ${user.name} (${user.id})`);

  // Assign all common categories to the user (upsert to avoid duplicates)
  await Promise.all(
    categoryRecords.map(cat =>
      prisma.userCategory.upsert({
        where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: cat.id } },
        update: {},
        create: { userId: LOCAL_USER_ID, categoryId: cat.id },
      })
    )
  );

  console.log(`Assigned ${categoryRecords.length} categories to user`);
  console.log('Seeding complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
