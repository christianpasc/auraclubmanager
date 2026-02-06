
import React from 'react';
import { TrendingUp, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  subValue: string;
  icon: LucideIcon;
  iconColor: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  iconColor, 
  trend 
}) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <p className="text-2xl font-bold mt-2">{value}</p>
    <div className="flex items-center gap-1 mt-1">
      {trend && (
        <span className="text-xs text-green-600 font-bold flex items-center">
          <TrendingUp className="w-3 h-3" /> {trend}
        </span>
      )}
      <p className="text-xs text-slate-400 font-medium">{subValue}</p>
    </div>
  </div>
);

export default StatCard;
