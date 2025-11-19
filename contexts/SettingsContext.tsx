import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'pt';
export type Theme = 'light' | 'dark';

interface SettingsContextType {
  language: Language;
  theme: Theme;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    myTrips: "My Trips",
    manageExpenses: "Manage your travel expenses",
    noTrips: "No trips yet",
    startNewTrip: "Start New Trip",
    budget: "Budget",
    spent: "Spent",
    available: "Available",
    newTrip: "New Trip",
    travelerName: "Traveler Name",
    tripName: "Trip Name",
    destination: "Destination Country",
    startDate: "Start Date",
    baseCurrency: "Base Currency",
    advance: "Advance",
    detectingCurrency: "Detecting local currency...",
    detectedCurrency: "Detected Local Currency",
    initialExchange: "Initial Currency Exchange",
    manualOverride: "Manual Override",
    autoDetected: "Auto-detected",
    totalIn: "Total in",
    rate: "Rate",
    saveExpense: "Save Expense",
    editExpense: "Edit Expense",
    newExpense: "New Expense",
    scanReceipt: "Scan Receipt with AI",
    orUpload: "or upload from gallery",
    aiAnalyzing: "AI is analyzing receipt...",
    retake: "Retake Photo",
    merchant: "Merchant / Establishment",
    amount: "Amount",
    currency: "Currency",
    date: "Date",
    category: "Category",
    paymentMethod: "Payment Method",
    conversion: "Conversion",
    updateRate: "Update Rate",
    transactions: "Transactions",
    noExpensesYet: "No expenses yet. Tap + to start.",
    report: "Expense Report",
    generated: "Generated",
    expensesByCategory: "Expenses by Category",
    settings: "Settings",
    darkMode: "Dark Mode",
    language: "Language",
    selectLanguage: "Select Language",
    close: "Close",
    exportCSV: "Export CSV",
    printPDF: "Print / PDF",
    deleteConfirm: "Are you sure you want to delete this expense?",
    unknownMerchant: "Unknown Merchant",
    trip: "Trip",
    traveler: "Traveler",
    dates: "Dates",
    total: "TOTAL",
    receipt: "Receipt",
    // Trip Status
    active: "Active",
    closed: "Closed",
    closeTrip: "Close Trip",
    reopenTrip: "Reopen Trip",
    confirmClose: "Finalize Trip",
    closeTripDesc: "This will finalize the budget calculations. You can reopen it later if needed.",
    settlement: "Settlement",
    toReturn: "To Return to Company",
    toReimburse: "To be Reimbursed",
    balanced: "Balanced",
    // Categories
    Meal: "Meal",
    Transport: "Transport",
    Lodging: "Lodging",
    Flight: "Flight",
    Supplies: "Supplies",
    Entertainment: "Entertainment",
    Other: "Other",
    // Payment Methods
    "Cash/Advance": "Cash/Advance",
    "Personal Card": "Personal Card",
    "Corporate Card": "Corporate Card"
  },
  pt: {
    myTrips: "Minhas Viagens",
    manageExpenses: "Gerencie suas despesas de viagem",
    noTrips: "Nenhuma viagem ainda",
    startNewTrip: "Iniciar Nova Viagem",
    budget: "Orçamento",
    spent: "Gasto",
    available: "Disponível",
    newTrip: "Nova Viagem",
    travelerName: "Nome do Viajante",
    tripName: "Nome da Viagem",
    destination: "País de Destino",
    startDate: "Data de Início",
    baseCurrency: "Moeda Base",
    advance: "Adiantamento",
    detectingCurrency: "Detectando moeda local...",
    detectedCurrency: "Moeda Local Detectada",
    initialExchange: "Câmbio Inicial",
    manualOverride: "Ajuste Manual",
    autoDetected: "Automático",
    totalIn: "Total em",
    rate: "Taxa",
    saveExpense: "Salvar Despesa",
    editExpense: "Editar Despesa",
    newExpense: "Nova Despesa",
    scanReceipt: "Escanear Recibo com IA",
    orUpload: "ou carregar da galeria",
    aiAnalyzing: "IA analisando recibo...",
    retake: "Tirar Outra",
    merchant: "Estabelecimento",
    amount: "Valor",
    currency: "Moeda",
    date: "Data",
    category: "Categoria",
    paymentMethod: "Método Pagamento",
    conversion: "Conversão",
    updateRate: "Atualizar Taxa",
    transactions: "Transações",
    noExpensesYet: "Sem despesas. Toque em + para iniciar.",
    report: "Relatório de Despesas",
    generated: "Gerado em",
    expensesByCategory: "Despesas por Categoria",
    settings: "Configurações",
    darkMode: "Modo Escuro",
    language: "Idioma",
    selectLanguage: "Selecionar Idioma",
    close: "Fechar",
    exportCSV: "Exportar CSV",
    printPDF: "Imprimir / PDF",
    deleteConfirm: "Tem certeza que deseja excluir esta despesa?",
    unknownMerchant: "Estabelecimento Desconhecido",
    trip: "Viagem",
    traveler: "Viajante",
    dates: "Datas",
    total: "TOTAL",
    receipt: "Comprovante",
    // Trip Status
    active: "Ativa",
    closed: "Fechada",
    closeTrip: "Fechar Viagem",
    reopenTrip: "Reabrir Viagem",
    confirmClose: "Finalizar Viagem",
    closeTripDesc: "Isso finalizará os cálculos do orçamento. Você pode reabrir mais tarde se necessário.",
    settlement: "Liquidação",
    toReturn: "A Devolver para Empresa",
    toReimburse: "A Reembolsar ao Viajante",
    balanced: "Conta Zerada",
    // Categories
    Meal: "Refeição",
    Transport: "Transporte",
    Lodging: "Hospedagem",
    Flight: "Voo",
    Supplies: "Suprimentos",
    Entertainment: "Entretenimento",
    Other: "Outros",
    // Payment Methods
    "Cash/Advance": "Dinheiro (Adiantamento)",
    "Personal Card": "Cartão Pessoal",
    "Corporate Card": "Cartão Corporativo"
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Defaults: Portuguese ('pt') and Dark Mode ('dark')
  const [language, setLanguageState] = useState<Language>('pt');
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const storedLang = localStorage.getItem('voyage_lang') as Language;
    const storedTheme = localStorage.getItem('voyage_theme') as Theme;
    
    // Load stored language if exists, otherwise keep 'pt' default
    if (storedLang) setLanguageState(storedLang);
    
    // Load stored theme or default to dark
    if (storedTheme) {
      setThemeState(storedTheme);
      if (storedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // No preference stored: Force Dark Mode
      setThemeState('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('voyage_lang', lang);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    localStorage.setItem('voyage_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const t = (key: string) => {
    // @ts-ignore
    return translations[language][key] || key;
  };

  return (
    <SettingsContext.Provider value={{ language, theme, toggleTheme, setLanguage, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};