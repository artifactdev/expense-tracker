import type { NavItemWithOptionalChildren } from '@/types';

// Single local user ID – created by prisma/seed.ts
export const LOCAL_USER_ID = 'local_user_default';

export const errorMessages = {
  authorizedResource: 'Not Authorized for this resource',
  createUser: 'Error creating the user',
  generic: 'Something went wrong. Try again later',
  methodAllowed: 'Method Not Allowed',
  missingData: 'There is missing data in the request',
  gettingCategories: 'Error getting the categories',
  addingTransaction: 'Error adding the transaction to database',
  addingSubscription: 'Error adding the subscription to database',
  fileParsing: 'File processing failed. Try again later',
  fileType: 'Wrong file type. Only CSV is allowed',
  dateFormatCSV: 'Please, select the correct date format used on your CSV file',
  csvNoColumns: 'Columns not found on the CSV',
  incorrectTransactionsData: 'The transactions provided are not correct. Try again later',
  incorrectSubscriptionData: 'The subscription data provided is not correct. Try again later',
  deletingTransactions: `Couldn't delete the selected transactions. Try again later`,
  deletingSubscriptions: `Couldn't delete the selected subscriptions. Try again later`,
  retrieveCategories: 'There was an error retrieving the categories',
  updateTransaction: 'There was an error updating the transaction',
  updateSubscription: 'There was an error updating the subscription',
  createTransaction: 'There was an error creating the transaction',
  retrieveSubscriptions: 'There was an error retrieving the subscriptions',
  incorrectData: 'There was an error with the data provided. Try again later',
  changeName: 'There was an error changing the name. Try again later',
  updatingPreferences: 'There was an error updating the preferences on database. Try again later',
  updatingAISettings: 'There was an error updating the AI settings. Try again later',
  aiNotConfigured: 'AI is not configured or disabled',
  aiRequestFailed: 'The AI request failed. Check your endpoint and API key.',
} as const;

export const dateFormat = {
  ISO: 'yyyy-MM-dd',
  US: 'MM/dd/yyyy',
  EU: 'dd/MM/yyyy',
  monthYear: 'yyyy-MM',
  shortMonth: 'MMM',
  shortMonthWithYear: 'MMM yy',
} as const;

export const shortDateFormat = {
  ISO: 'yy-MM-dd',
  US: 'MM/dd/yy',
  EU: 'dd/MM/yy',
} as const;

export const getEllipsed = 'overflow-hidden text-ellipsis whitespace-nowrap';

export const monthOrder = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
} as const;

export const DEFAULT_CALLBACK_URL = '/dashboard';
export const URL_POST_TRANSACTION = `/api/transactions/filtered`;
export const URL_UPDATE_USER_TRANS_DATES = `/api/user/update-trans-dates`;
export const URL_UPLOAD_TRANSACTION_FILE = `/api/transactions/upload`;
export const URL_GET_CSV_HEADERS = `/api/transactions/get-csv-headers`;
export const URL_UPLOAD_BULK_TRANSACTION = `/api/transactions/add/bulk`;
export const URL_DELETE_TRANSACTIONS = `/api/transactions/delete`;
export const URL_USER_CATEGORIES = `/api/user/categories`;
export const URL_UPDATE_CATEGORY = `/api/transactions/update`;
export const URL_CREATE_TRANSACTION = `/api/transactions/add/single`;
export const URL_ADD_SUBSCRIPTION = `/api/user/subscriptions/add`;
export const URL_GET_SUBSCRIPTION = `/api/user/subscriptions`;
export const URL_UPDATE_SUBSCRIPTION = `/api/user/subscriptions/update`;
export const URL_DELETE_SUBSCRIPTION = `/api/user/subscriptions/delete`;
export const URL_CHANGE_NAME = `/api/user/change-name`;
export const URL_CHANGE_PREFERENCES = `/api/user/change-preferences`;
export const URL_AI_SETTINGS = `/api/user/ai-settings`;
export const URL_AI_SUGGEST_CATEGORIES = `/api/ai/suggest-categories`;
export const URL_AI_MODELS = `/api/ai/models`;
export const URL_AI_TEST_CONNECTION = `/api/ai/test-connection`;
export const URL_AI_CATEGORIZE_EXISTING = `/api/ai/categorize-existing`;
export const URL_DETECT_SUBSCRIPTIONS = `/api/user/subscriptions/detect`;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export const DATES_CSV_FORMAT_OPTIONS = [
  'dd-MM-yyyy',
  'dd-MMM-yyyy',
  'MM-dd-yyyy',
  'MMM-dd-yyyy',
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'dd/MMM/yyyy',
  'MM/dd/yyyy',
  'MMM/dd/yyyy',
  'yyyy/MM/dd',
];

export const FIELDS_FROM_CSV = [
  'Date',
  'Concept',
  'Amount',
  'CreditDebit',
  'Counterparty',
  'Account',
  'PaymentType',
  'Notes',
];

// Fields that allow mapping multiple CSV columns (values get concatenated)
export const MULTI_COLUMN_FIELDS = new Set(['Concept', 'Counterparty']);

// Keywords für Auto-Detect: Spaltenname (lowercase) → Feld
export const CSV_COLUMN_AUTODETECT: Record<string, string> = {
  // Date
  bookgdt: 'Date',
  valdt: 'Date',
  txdt: 'Date',
  date: 'Date',
  datum: 'Date',
  buchungsdatum: 'Date',
  wertstellungsdatum: 'Date',
  // Concept / Betreff
  rmtinf: 'Concept',
  bookingtxt: 'Concept',
  booktxt: 'Concept',
  concept: 'Concept',
  description: 'Concept',
  memo: 'Concept',
  betreff: 'Concept',
  verwendungszweck: 'Concept',
  buchungstext: 'Concept',
  // Amount
  amt: 'Amount',
  amount: 'Amount',
  betrag: 'Amount',
  // CreditDebit
  cdtdbtind: 'CreditDebit',
  creditdebit: 'CreditDebit',
  cdtdbt: 'CreditDebit',
  type: 'CreditDebit',
  'soll/haben': 'CreditDebit',
  // Counterparty
  rmtdnm: 'Counterparty',
  rmtdultmtnm: 'Counterparty',
  counterparty: 'Counterparty',
  gegenseite: 'Counterparty',
  auftraggeber: 'Counterparty',
  empfaenger: 'Counterparty',
  beguenstigter: 'Counterparty',
  'name zahlungsbeteiligter': 'Counterparty',
  // Account
  owneracctiban: 'Account',
  owneracctno: 'Account',
  account: 'Account',
  konto: 'Account',
  iban: 'Account',
  kontonummer: 'Account',
  auftragskonto: 'Account',
  // PaymentType
  paymenttype: 'PaymentType',
  zahlungsart: 'PaymentType',
  buchungsart: 'PaymentType',
  transaktionstyp: 'PaymentType',
  // Notes
  notes: 'Notes',
  notizen: 'Notes',
  category: 'Notes',
  kundenreferenz: 'Notes',
};

export const formatterUSTwoDecimals = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
export const formatterUSNoDecimals = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export const availableCurrency = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
} as const;

export const availableDateFormatTypes = {
  EU: dateFormat.EU,
  US: dateFormat.US,
  ISO: dateFormat.ISO,
} as const;

export const themeOptions = [
  { key: 'light', name: 'Light' },
  { key: 'dark', name: 'Dark' },
  { key: 'system', name: 'System' },
] as const;

export const navItems: NavItemWithOptionalChildren[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    label: 'Dashboard',
  },
  {
    title: 'Profile',
    href: '/dashboard/profile',
    icon: 'profile',
    label: 'profile',
  },
  {
    title: 'Subscriptions',
    href: '/dashboard/subscriptions',
    icon: 'subscription',
    label: 'subscription',
  },
  {
    title: 'Categories',
    href: '/dashboard/categories',
    icon: 'categories',
    label: 'categories',
  },
  {
    title: 'Transactions',
    href: '/dashboard/transactions',
    icon: 'wallet',
    label: 'transactions',
    subItems: [
      {
        title: 'List',
        href: '/dashboard/transactions/list',
        icon: 'listTransaction',
        label: 'list',
      },
      {
        title: 'Add',
        href: '/dashboard/transactions/add',
        icon: 'addTransaction',
        label: 'add',
        subItems: [
          {
            title: 'Multiple',
            href: '/dashboard/transactions/add/multiple',
            icon: 'multipleTrans',
            label: 'multiple',
          },
          {
            title: 'Single',
            href: '/dashboard/transactions/add/single',
            icon: 'singleTrans',
            label: 'single',
          },
        ],
      },
    ],
  },
  {
    title: 'AI Settings',
    href: '/dashboard/settings/ai',
    icon: 'ai',
    label: 'ai-settings',
  },
];
