import { Building, Play, Clock, CheckCircle } from "lucide-react";

interface Project {
  id: string;
  status: string;
  contracted_hours: number;
  executed_hours: number;
}

interface ProjectsOverviewProps {
  projects: Project[];
}

export function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter(p => p.status === 'em_andamento').length;
  const completedProjects = projects.filter(p => p.status === 'concluído').length;
  const totalHours = projects.reduce((acc, p) => acc + (p.contracted_hours || 0), 0);

  const stats = [
    {
      title: "Total",
      value: totalProjects,
      icon: Building,
      bgClass: "from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30",
      borderClass: "border-blue-200 dark:border-blue-800",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      textColor: "text-blue-700 dark:text-blue-300",
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Em Andamento",
      value: inProgressProjects,
      icon: Play,
      bgClass: "from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30",
      borderClass: "border-green-200 dark:border-green-800",
      iconBg: "bg-green-100 dark:bg-green-900/40",
      iconColor: "text-green-600 dark:text-green-400",
      textColor: "text-green-700 dark:text-green-300",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "Horas Totais",
      value: `${totalHours}h`,
      icon: Clock,
      bgClass: "from-orange-50/80 to-amber-50/80 dark:from-orange-950/30 dark:to-amber-950/30",
      borderClass: "border-orange-200 dark:border-orange-800",
      iconBg: "bg-orange-100 dark:bg-orange-900/40",
      iconColor: "text-orange-600 dark:text-orange-400",
      textColor: "text-orange-700 dark:text-orange-300",
      valueColor: "text-orange-800 dark:text-orange-200"
    },
    {
      title: "Concluídos",
      value: completedProjects,
      icon: CheckCircle,
      bgClass: "from-purple-50/80 to-violet-50/80 dark:from-purple-950/30 dark:to-violet-950/30",
      borderClass: "border-purple-200 dark:border-purple-800",
      iconBg: "bg-purple-100 dark:bg-purple-900/40",
      iconColor: "text-purple-600 dark:text-purple-400",
      textColor: "text-purple-700 dark:text-purple-300",
      valueColor: "text-purple-800 dark:text-purple-200"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div 
            key={index}
            className={`bg-gradient-to-br ${stat.bgClass} border ${stat.borderClass} rounded-xl p-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 ${stat.iconBg} rounded-full`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${stat.textColor}`}>
                  {stat.title}
                </p>
                <p className={`text-xl font-bold ${stat.valueColor}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}