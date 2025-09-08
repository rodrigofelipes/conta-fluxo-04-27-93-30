import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, DollarSign } from "lucide-react";

interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  status: string;
  transaction_date: string;
  transaction_type: string;
}

interface FinancialWidgetProps {
  transactions: FinancialTransaction[];
  loading?: boolean;
}

export function FinancialWidget({ transactions, loading }: FinancialWidgetProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': 
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'income' ? (
      <TrendingUp className="size-4 text-green-600" />
    ) : (
      <AlertTriangle className="size-4 text-red-600" />
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            Financeiro Importante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center responsive-gap-sm">
          <DollarSign className="size-4 sm:size-5 flex-shrink-0" />
          <span className="responsive-text-lg">Financeiro Importante</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="responsive-padding-sm">
        {transactions.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-start responsive-gap-sm p-2 sm:p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex-shrink-0">
                  {getTypeIcon(transaction.transaction_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs sm:text-sm font-medium truncate">
                      {transaction.description}
                    </p>
                    <span className={`text-xs sm:text-sm font-semibold flex-shrink-0 ml-2 ${
                      transaction.transaction_type === 'income' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </span>
                  </div>
                  <div className="flex items-center responsive-gap-sm mb-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transaction.transaction_date)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(transaction.status)}`}
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
            Nenhuma transação importante
          </p>
        )}
      </CardContent>
    </Card>
  );
}