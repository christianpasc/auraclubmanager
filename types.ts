
export enum Status {
  Active = 'Ativo',
  Inactive = 'Inativo',
  Pending = 'Pendente',
  Injured = 'Lesionado'
}

export interface Athlete {
  id: string;
  name: string;
  email: string;
  cpf: string;
  category: string;
  position: string;
  status: Status;
  registrationDate: string;
  avatar: string;
}

export interface Club {
  id: string;
  name: string;
  cnpj: string;
  foundation: string;
  city: string;
  state: string;
  type: string;
  logo: string;
}

export interface Competition {
  id: string;
  name: string;
  season: string;
  category: string;
  format: string;
  period: string;
  status: 'Em andamento' | 'Próxima' | 'Finalizada';
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  date: string;
  amount: number;
  status: 'Conciliado' | 'Pendente';
}

export interface Enrollment {
  id: string;
  athleteName: string;
  category: string;
  startDate: string;
  expiryDate: string;
  status: 'Ativa' | 'Expirando' | 'Expirada' | 'Pendente';
  plan: string;
}

export interface MonthlyFee {
  id: string;
  athleteName: string;
  month: string;
  amount: number;
  dueDate: string;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  category: string;
}
