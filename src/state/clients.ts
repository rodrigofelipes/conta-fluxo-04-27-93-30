export interface Client { id: string; name: string; cnpj: string; city?: string }

export const clientsSeed: Client[] = [
  { id: "c1", name: "João Silva", cnpj: "12.345.678/0001-90", city: "São Paulo" },
  { id: "c2", name: "Maria Souza", cnpj: "45.987.123/0001-01", city: "Rio de Janeiro" },
  { id: "c3", name: "ACME Ltda.", cnpj: "78.654.321/0001-22", city: "Belo Horizonte" },
  { id: "c4", name: "TechNova S.A.", cnpj: "11.222.333/0001-44", city: "Curitiba" },
  { id: "c5", name: "Mercado Bom Preço ME", cnpj: "55.666.777/0001-88", city: "Porto Alegre" },
  { id: "c6", name: "Clínica Vida Plena", cnpj: "20.345.678/0001-12", city: "Campinas" },
  { id: "c7", name: "Escola Horizonte", cnpj: "90.123.456/0001-34", city: "Salvador" },
  { id: "c8", name: "Construtora Alfa", cnpj: "33.444.555/0001-56", city: "Recife" },
  { id: "c9", name: "AgroVale Agronegócios", cnpj: "66.777.888/0001-78", city: "Goiânia" },
  { id: "c10", name: "Studio Criativo Pixel", cnpj: "21.432.109/0001-09", city: "Florianópolis" },
  { id: "c11", name: "Transportadora Rápida", cnpj: "14.258.369/0001-74", city: "Fortaleza" },
  { id: "c12", name: "Hotel Paraíso", cnpj: "98.765.432/0001-10", city: "Brasília" },
];
