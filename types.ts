export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  BRL = 'BRL',
  JPY = 'JPY',
  GBP = 'GBP',
  CAD = 'CAD',
  AUD = 'AUD'
}

export enum ExpenseCategory {
  MEAL = 'Meal',
  TRANSPORT = 'Transport',
  LODGING = 'Lodging',
  FLIGHT = 'Flight',
  SUPPLIES = 'Supplies',
  ENTERTAINMENT = 'Entertainment',
  OTHER = 'Other'
}

export enum PaymentMethod {
  CASH = 'Cash/Advance',
  PERSONAL_CARD = 'Personal Card',
  CORPORATE_CARD = 'Corporate Card'
}

export interface Expense {
  id: string;
  tripId: string;
  date: string; // ISO string
  category: ExpenseCategory;
  merchant: string;
  amountOriginal: number;
  currencyOriginal: Currency | string;
  exchangeRate: number;
  amountBase: number;
  paymentMethod: PaymentMethod;
  receiptImage?: string; // Base64
  notes?: string;
  isVerified: boolean; // If OCR was used and verified
}

export interface Trip {
  id: string;
  travelerName: string;
  tripName: string;
  destinationCountry: string;
  localCurrencySuggestion: Currency | string;
  baseCurrency: Currency;
  advanceAmount: number;
  initialExchangeRate: number;
  startDate: string;
  status: 'active' | 'closed';
}

export interface OCRResult {
  date?: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  category?: ExpenseCategory;
}