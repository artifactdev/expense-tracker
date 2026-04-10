import type { EnhancedCategory } from '@/types';

// Keyword → [Parent, Child?] mapping for quick CSV categorization
const categoryKeywordsMapping: Record<string, { parentName: string; keywords: string[] }> = {
  // Wohnen
  Miete: { parentName: 'Wohnen', keywords: ['miete', 'kaltmiete', 'warmmiete'] },
  Nebenkosten: {
    parentName: 'Wohnen',
    keywords: ['nebenkosten', 'strom', 'heizung', 'stadtwerke', 'gas abschlag'],
  },

  // Lebensmittel
  Supermarkt: {
    parentName: 'Lebensmittel',
    keywords: [
      'rewe',
      'edeka',
      'aldi',
      'lidl',
      'penny',
      'netto',
      'kaufland',
      'dm-drogerie',
      'rossmann',
      'carrefour',
      'gadis',
      'eroski',
      'alcampo',
      'mercadona',
      'ikea',
    ],
  },
  Tierfutter: { parentName: 'Lebensmittel', keywords: ['fressnapf', 'zooplus', 'zooroyal'] },

  // Gastronomie
  Restaurants: {
    parentName: 'Gastronomie',
    keywords: ['restaurant', 'restaurante', 'goiko', 'mcdonalds', 'burger king', 'subway'],
  },
  Lieferdienste: {
    parentName: 'Gastronomie',
    keywords: ['lieferando', 'uber eats', 'dominos', 'telepizza', 'glovoapp', 'glovo'],
  },
  Cafés: { parentName: 'Gastronomie', keywords: ['starbucks', 'cafe', 'kaffee'] },

  // Mobilität
  Tanken: {
    parentName: 'Mobilität',
    keywords: ['tankstelle', 'aral', 'shell', 'esso', 'total', 'jet ', 'carbugal'],
  },
  'Öffentliche Verkehrsmittel': {
    parentName: 'Mobilität',
    keywords: [
      'db bahn',
      'deutsche bahn',
      'flixbus',
      'oeffentl',
      'nahverkehr',
      'hvv',
      'mvg',
      'bvg',
      'kvb',
    ],
  },

  // Telefonie & Internet
  'Streaming-Dienste': {
    parentName: 'Telefonie & Internet',
    keywords: ['netflix', 'spotify', 'disney+', 'prime video', 'youtube premium', 'dazn'],
  },
  'Cloud & Hosting': {
    parentName: 'Telefonie & Internet',
    keywords: ['icloud', 'dropbox', 'ionos', 'hetzner', 'aws '],
  },
  'Software & Apps': {
    parentName: 'Telefonie & Internet',
    keywords: ['github', 'chatgpt', 'openai', 'microsoft 365', 'adobe'],
  },
  Hardware: {
    parentName: 'Telefonie & Internet',
    keywords: ['media markt', 'saturn', 'coolmod', 'pccomponentes', 'cyberport', 'alternate'],
  },

  // Einkaufen
  Kleidung: {
    parentName: 'Einkaufen',
    keywords: [
      'zalando',
      'h&m',
      'primark',
      'zara',
      'about you',
      'pull and bear',
      'nike',
      'adidas',
      'puma',
      'skechers',
    ],
  },
  Elektronik: {
    parentName: 'Einkaufen',
    keywords: ['amazon', 'amzn', 'amz*', 'ebay', 'aliexpress'],
  },
  Geschenke: { parentName: 'Einkaufen', keywords: ['geschenk', 'gift'] },

  // Gesundheit
  Medikamente: { parentName: 'Gesundheit', keywords: ['apotheke', 'farmacia', 'pharma'] },
  'Arzt & Zahnarzt': {
    parentName: 'Gesundheit',
    keywords: ['arzt', 'praxis', 'dental', 'dentist', 'zahnarzt'],
  },
  Physiotherapie: { parentName: 'Gesundheit', keywords: ['physiotherapie', 'physio', 'massage'] },

  // Versicherungen
  Haftpflicht: { parentName: 'Versicherungen', keywords: ['haftpflicht'] },
  Krankenversicherung: {
    parentName: 'Versicherungen',
    keywords: ['krankenversicherung', 'krankenkasse', 'aok', 'tk versicherung', 'barmer'],
  },

  // Finanzen
  Bankgebühren: {
    parentName: 'Finanzen',
    keywords: ['kontoführung', 'kontogebühr', 'comision', 'servicio de mantenimiento'],
  },
  Sparen: { parentName: 'Finanzen', keywords: ['sparbetrag', 'sparplan', 'tagesgeld'] },
  Geldtransfers: { parentName: 'Finanzen', keywords: ['paypal', 'bizum'] },

  // Freizeit & Unterhaltung
  'Reisen & Urlaub': {
    parentName: 'Freizeit & Unterhaltung',
    keywords: ['booking.com', 'airbnb', 'hotel', 'flug'],
  },
  'Hobby & Sport': {
    parentName: 'Freizeit & Unterhaltung',
    keywords: ['decathlon', 'fitnessstudio', 'sportverein'],
  },

  // Spenden & Wohltätigkeit
  Spenden: {
    parentName: 'Spenden & Wohltätigkeit',
    keywords: ['spende', 'grundeinkommen', 'donation'],
  },

  // Einnahmen
  Gehalt: { parentName: 'Einnahmen', keywords: ['lohn', 'gehalt', 'entgelt', 'gehaltseingang'] },
  Verkauf: { parentName: 'Einnahmen', keywords: ['verkauf', 'erstattung', 'rückerstattung'] },
};

// Checking into the values of the map, if there is a match, getting that
export const getTransactionsCategories = (concept: string) => {
  const conceptLower = concept.toLowerCase();
  const categories: EnhancedCategory[] = [];

  for (const [childName, { parentName, keywords }] of Object.entries(categoryKeywordsMapping)) {
    const keywordFound = keywords.some(kw => conceptLower.includes(kw));
    if (keywordFound) {
      // Add parent + child
      if (!categories.some(c => c.name === parentName)) {
        categories.push({
          id: parentName.toLowerCase().replace(/\s+/g, '-'),
          name: parentName,
          newEntry: true,
        });
      }
      if (!categories.some(c => c.name === childName)) {
        categories.push({
          id: childName.toLowerCase().replace(/\s+/g, '-'),
          name: childName,
          newEntry: true,
        });
      }
      // Max 2 categories (parent + child), first match wins
      return categories.slice(0, 2);
    }
  }

  return categories.length > 0 ? categories : undefined;
};
