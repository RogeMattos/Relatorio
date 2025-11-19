import { Trip, Expense } from "../types";

const TRIPS_KEY = "voyage_trips";
const EXPENSES_KEY = "voyage_expenses";

export const getTrips = (): Trip[] => {
  const data = localStorage.getItem(TRIPS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTrip = (trip: Trip) => {
  const trips = getTrips();
  const existingIndex = trips.findIndex(t => t.id === trip.id);
  if (existingIndex >= 0) {
    trips[existingIndex] = trip;
  } else {
    trips.push(trip);
  }
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
};

export const getExpenses = (tripId: string): Expense[] => {
  const data = localStorage.getItem(EXPENSES_KEY);
  const allExpenses: Expense[] = data ? JSON.parse(data) : [];
  return allExpenses.filter(e => e.tripId === tripId);
};

export const saveExpense = (expense: Expense) => {
  const data = localStorage.getItem(EXPENSES_KEY);
  const allExpenses: Expense[] = data ? JSON.parse(data) : [];
  
  const existingIndex = allExpenses.findIndex(e => e.id === expense.id);
  if (existingIndex >= 0) {
    allExpenses[existingIndex] = expense;
  } else {
    allExpenses.push(expense);
  }
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(allExpenses));
};

export const deleteExpense = (expenseId: string) => {
    const data = localStorage.getItem(EXPENSES_KEY);
    if (!data) return;
    const allExpenses: Expense[] = JSON.parse(data);
    const filtered = allExpenses.filter(e => e.id !== expenseId);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
}

export const formatMoney = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};