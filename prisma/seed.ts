import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The fixed single-user ID – matches LOCAL_USER_ID in utils/const.ts
const LOCAL_USER_ID = 'local_user_default';

interface CategoryDef {
  name: string;
  slug: string;
  children?: { name: string; slug: string }[];
}

const CATEGORY_TREE: CategoryDef[] = [
  // ── Ausgaben ──
  {
    name: 'Wohnen',
    slug: 'wohnen',
    children: [
      { name: 'Miete', slug: 'miete' },
      { name: 'Nebenkosten', slug: 'nebenkosten' },
      { name: 'Hausservice', slug: 'hausservice' },
      { name: 'Möbel & Einrichtung', slug: 'moebel-einrichtung' },
      { name: 'Immobilien-Steuer', slug: 'immobilien-steuer' },
      { name: 'Garten & Außenbereich', slug: 'garten-aussenbereich' },
    ],
  },
  {
    name: 'Lebensmittel',
    slug: 'lebensmittel',
    children: [
      { name: 'Supermarkt', slug: 'supermarkt' },
      { name: 'Spezialität', slug: 'spezialitaet' },
      { name: 'Frische Lebensmittel', slug: 'frische-lebensmittel' },
      { name: 'Getränke', slug: 'getraenke' },
      { name: 'Snacks & Süßigkeiten', slug: 'snacks-suessigkeiten' },
      { name: 'Tierfutter', slug: 'tierfutter' },
    ],
  },
  {
    name: 'Gastronomie',
    slug: 'gastronomie',
    children: [
      { name: 'Restaurants', slug: 'restaurants' },
      { name: 'Cafés', slug: 'cafes' },
      { name: 'Fast Food', slug: 'fast-food' },
      { name: 'Lieferdienste', slug: 'lieferdienste' },
      { name: 'Bar & Clubs', slug: 'bar-clubs' },
      { name: 'Gutscheine', slug: 'gutscheine-gastronomie' },
    ],
  },
  {
    name: 'Mobilität',
    slug: 'mobilitaet',
    children: [
      { name: 'Tanken', slug: 'tanken' },
      { name: 'Öffentliche Verkehrsmittel', slug: 'oepnv' },
      { name: 'Taxi & Ride-Sharing', slug: 'taxi-ride-sharing' },
      { name: 'Parken', slug: 'parken' },
      { name: 'Fahrzeugunterhalt', slug: 'fahrzeugunterhalt' },
      { name: 'Fahrzeugschein', slug: 'fahrzeugschein' },
    ],
  },
  {
    name: 'Telefonie & Internet',
    slug: 'telefonie-internet',
    children: [
      { name: 'Handy', slug: 'handy' },
      { name: 'Festnetz', slug: 'festnetz' },
      { name: 'Streaming-Dienste', slug: 'streaming-dienste' },
      { name: 'Cloud & Hosting', slug: 'cloud-hosting' },
      { name: 'Software & Apps', slug: 'software-apps' },
      { name: 'Hardware', slug: 'hardware' },
    ],
  },
  {
    name: 'Bildung & Weiterbildung',
    slug: 'bildung-weiterbildung',
    children: [
      { name: 'Schule & Uni', slug: 'schule-uni' },
      { name: 'Kurse & Workshops', slug: 'kurse-workshops' },
      { name: 'Bücher & Zeitschriften', slug: 'buecher-zeitschriften' },
      { name: 'E-Learning', slug: 'e-learning' },
      { name: 'Nachhilfe', slug: 'nachhilfe' },
    ],
  },
  {
    name: 'Einkaufen',
    slug: 'einkaufen',
    children: [
      { name: 'Kleidung', slug: 'kleidung' },
      { name: 'Elektronik', slug: 'elektronik' },
      { name: 'Spielzeug & Hobby', slug: 'spielzeug-hobby' },
      { name: 'Geschenke', slug: 'geschenke' },
      { name: 'Mode & Beauty', slug: 'mode-beauty' },
      { name: 'Sport & Freizeit', slug: 'sport-freizeit' },
    ],
  },
  {
    name: 'Gesundheit',
    slug: 'gesundheit',
    children: [
      { name: 'Arzt & Zahnarzt', slug: 'arzt-zahnarzt' },
      { name: 'Medikamente', slug: 'medikamente' },
      { name: 'Zahnbehandlung', slug: 'zahnbehandlung' },
      { name: 'Physiotherapie', slug: 'physiotherapie' },
      { name: 'Fitness & Sport', slug: 'fitness-sport' },
      { name: 'Gesundheitsprodukte', slug: 'gesundheitsprodukte' },
    ],
  },
  {
    name: 'Versicherungen',
    slug: 'versicherungen',
    children: [
      { name: 'Haftpflicht', slug: 'haftpflicht' },
      { name: 'Krankenversicherung', slug: 'krankenversicherung' },
      { name: 'Lebensversicherung', slug: 'lebensversicherung' },
      { name: 'Reiseversicherung', slug: 'reiseversicherung' },
      { name: 'Hausrat', slug: 'hausrat' },
      { name: 'Rechtsschutz', slug: 'rechtsschutz' },
    ],
  },
  {
    name: 'Finanzen',
    slug: 'finanzen',
    children: [
      { name: 'Bankgebühren', slug: 'bankgebuehren' },
      { name: 'Kreditzinsen', slug: 'kreditzinsen' },
      { name: 'Investitionen', slug: 'investitionen' },
      { name: 'Sparen', slug: 'sparen' },
      { name: 'Steuer', slug: 'steuer' },
      { name: 'Geldtransfers', slug: 'geldtransfers' },
    ],
  },
  {
    name: 'Freizeit & Unterhaltung',
    slug: 'freizeit-unterhaltung',
    children: [
      { name: 'Kino & Theater', slug: 'kino-theater' },
      { name: 'Kultur & Museen', slug: 'kultur-museen' },
      { name: 'Konzerte & Events', slug: 'konzerte-events' },
      { name: 'Hobby & Sport', slug: 'hobby-sport' },
      { name: 'Reisen & Urlaub', slug: 'reisen-urlaub' },
      { name: 'Freizeitaktivitäten', slug: 'freizeitaktivitaeten' },
    ],
  },
  {
    name: 'Spenden & Wohltätigkeit',
    slug: 'spenden-wohltaetigkeit',
    children: [
      { name: 'Spenden', slug: 'spenden' },
      { name: 'Vereine', slug: 'vereine' },
      { name: 'Gemeinnützige Organisationen', slug: 'gemeinnuetzige-organisationen' },
      { name: 'Familie & Freunde', slug: 'familie-freunde-spenden' },
    ],
  },
  {
    name: 'Haus & Garten',
    slug: 'haus-garten',
    children: [
      { name: 'Reinigung', slug: 'reinigung' },
      { name: 'Gartenarbeit', slug: 'gartenarbeit' },
      { name: 'Hauswartung', slug: 'hauswartung' },
    ],
  },
  {
    name: 'Sonstige Ausgaben',
    slug: 'sonstige-ausgaben',
    children: [
      { name: 'Einzelne Käufe', slug: 'einzelne-kaeufe' },
      { name: 'Geldverlust', slug: 'geldverlust' },
      { name: 'Sonstige', slug: 'sonstige' },
    ],
  },

  // ── Einnahmen ──
  {
    name: 'Einnahmen',
    slug: 'einnahmen',
    children: [
      { name: 'Gehalt', slug: 'gehalt' },
      { name: 'Bonus & Prämie', slug: 'bonus-praemie' },
      { name: 'Nebenjob', slug: 'nebenjob' },
      { name: 'Investments', slug: 'investments' },
      { name: 'Verkauf', slug: 'verkauf' },
      { name: 'Spenden & Zuwendungen', slug: 'spenden-zuwendungen' },
    ],
  },
  {
    name: 'Geschenke & Zuwendungen',
    slug: 'geschenke-zuwendungen',
    children: [
      { name: 'Familie & Freunde', slug: 'familie-freunde-geschenke' },
      { name: 'Geschenke', slug: 'geschenke-erbe' },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  const allCategoryRecords = [];

  for (const parent of CATEGORY_TREE) {
    // Upsert parent category
    const parentRecord = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, common: true },
      create: { name: parent.name, slug: parent.slug, common: true },
    });
    allCategoryRecords.push(parentRecord);

    // Upsert children
    if (parent.children) {
      for (const child of parent.children) {
        const childRecord = await prisma.category.upsert({
          where: { slug: child.slug },
          update: { name: child.name, common: true, parentId: parentRecord.id },
          create: {
            name: child.name,
            slug: child.slug,
            common: true,
            parentId: parentRecord.id,
          },
        });
        allCategoryRecords.push(childRecord);
      }
    }
  }

  console.log(
    `Seeded ${allCategoryRecords.length} categories (${CATEGORY_TREE.length} parents + children)`
  );

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

  // Assign all categories to the user (upsert to avoid duplicates)
  await Promise.all(
    allCategoryRecords.map(cat =>
      prisma.userCategory.upsert({
        where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: cat.id } },
        update: {},
        create: { userId: LOCAL_USER_ID, categoryId: cat.id },
      })
    )
  );

  console.log(`Assigned ${allCategoryRecords.length} categories to user`);
  console.log('Seeding complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
