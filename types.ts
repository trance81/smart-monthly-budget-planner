
export type Operator = '+' | '-';

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  operator: Operator;
}

export interface CalculationResult {
  baseAmount: number;
  items: BudgetItem[];
  total: number;
}
