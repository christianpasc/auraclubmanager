
import { Athlete, Status, Club, Competition, Transaction, Enrollment, MonthlyFee } from './types';

export const MOCK_ATHLETES: Athlete[] = [
  {
    id: '1',
    name: 'Gabriel Souza Silva',
    email: 'gabriel.silva@email.com',
    cpf: '123.456.789-00',
    category: 'Sub-17',
    position: 'Atacante',
    status: Status.Active,
    registrationDate: '12/10/2023',
    avatar: 'https://picsum.photos/seed/gabriel/200/200'
  },
  {
    id: '2',
    name: 'Lucas Oliveira Santos',
    email: 'lucas.santos@email.com',
    cpf: '987.654.321-11',
    category: 'Sub-15',
    position: 'Goleiro',
    status: Status.Active,
    registrationDate: '11/10/2023',
    avatar: 'https://picsum.photos/seed/lucas/200/200'
  },
  {
    id: '3',
    name: 'Matheus Fernandes',
    email: 'matheus.f@email.com',
    cpf: '456.123.789-22',
    category: 'Sub-20',
    position: 'Meio-campista',
    status: Status.Inactive,
    registrationDate: '10/10/2023',
    avatar: 'https://picsum.photos/seed/matheus/200/200'
  },
  {
    id: '4',
    name: 'Felipe Mendes Braga',
    email: 'felipe.braga@email.com',
    cpf: '321.654.987-33',
    category: 'Sub-17',
    position: 'Defensor',
    status: Status.Active,
    registrationDate: '09/10/2023',
    avatar: 'https://picsum.photos/seed/felipe/200/200'
  }
];

export const MOCK_CLUBS: Club[] = [
  {
    id: '1',
    name: 'Aura Futebol Clube',
    cnpj: '33.649.575/0001-99',
    foundation: '17/11/2020',
    city: 'São Paulo',
    state: 'SP',
    type: 'Profissional',
    logo: 'https://picsum.photos/seed/auraclub/100/100'
  }
];

export const MOCK_COMPETITIONS: Competition[] = [
  {
    id: '1',
    name: 'Copa Verão 2024',
    season: '2024',
    category: 'Sub-15',
    format: 'Eliminatórias',
    period: '10/01 - 20/02',
    status: 'Em andamento'
  },
  {
    id: '2',
    name: 'Campeonato Regional',
    season: '2024',
    category: 'Sub-17',
    format: 'Pontos Corridos',
    period: '05/03 - 15/06',
    status: 'Próxima'
  },
  {
    id: '3',
    name: 'Torneio de Inverno',
    season: '2023',
    category: 'Sub-20',
    format: 'Grupos',
    period: '12/06 - 15/08',
    status: 'Finalizada'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'income',
    description: 'Mensalidades Outubro',
    category: 'Mensalidades',
    date: '10/10/2023',
    amount: 12450.00,
    status: 'Conciliado'
  },
  {
    id: '2',
    type: 'expense',
    description: 'Aluguel do Campo',
    category: 'Infraestrutura',
    date: '12/10/2023',
    amount: 2500.00,
    status: 'Conciliado'
  },
  {
    id: '3',
    type: 'income',
    description: 'Patrocínio Master',
    category: 'Marketing',
    date: '15/10/2023',
    amount: 5000.00,
    status: 'Conciliado'
  },
  {
    id: '4',
    type: 'expense',
    description: 'Material Esportivo',
    category: 'Equipamentos',
    date: '18/10/2023',
    amount: 3200.00,
    status: 'Pendente'
  }
];

export const MOCK_TRAININGS = [
  { id: '1', time: '08:30', category: 'Sub-15', focus: 'Tático / Posicionamento', location: 'Campo A', status: 'Concluído' },
  { id: '2', time: '10:00', category: 'Sub-17', focus: 'Físico / Resistência', location: 'Academia', status: 'Em andamento' },
  { id: '3', time: '14:30', category: 'Sub-20', focus: 'Finalização', location: 'Campo B', status: 'Agendado' },
  { id: '4', time: '16:00', category: 'Profissional', focus: 'Coletivo', location: 'Campo A', status: 'Agendado' },
];

export const MOCK_ENROLLMENTS: Enrollment[] = [
  { id: '1', athleteName: 'Gabriel Souza Silva', category: 'Sub-17', plan: 'Anual', startDate: '10/01/2023', expiryDate: '10/01/2024', status: 'Ativa' },
  { id: '2', athleteName: 'Lucas Oliveira Santos', category: 'Sub-15', plan: 'Semestral', startDate: '15/06/2023', expiryDate: '15/12/2023', status: 'Ativa' },
  { id: '3', athleteName: 'Matheus Fernandes', category: 'Sub-20', plan: 'Mensal', startDate: '01/10/2023', expiryDate: '01/11/2023', status: 'Expirando' },
  { id: '4', athleteName: 'Felipe Mendes Braga', category: 'Sub-17', plan: 'Anual', startDate: '05/01/2022', expiryDate: '05/01/2023', status: 'Expirada' },
];

export const MOCK_MONTHLY_FEES: MonthlyFee[] = [
  { id: '1', athleteName: 'Gabriel Souza Silva', month: 'Outubro', amount: 150.00, dueDate: '10/10/2023', status: 'Pago', category: 'Sub-17' },
  { id: '2', athleteName: 'Lucas Oliveira Santos', month: 'Outubro', amount: 150.00, dueDate: '10/10/2023', status: 'Pago', category: 'Sub-15' },
  { id: '3', athleteName: 'Matheus Fernandes', month: 'Outubro', amount: 150.00, dueDate: '10/10/2023', status: 'Pendente', category: 'Sub-20' },
  { id: '4', athleteName: 'Felipe Mendes Braga', month: 'Outubro', amount: 150.00, dueDate: '10/10/2023', status: 'Atrasado', category: 'Sub-17' },
];
