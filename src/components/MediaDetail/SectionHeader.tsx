import React from 'react';

interface SectionHeaderProps {
  title: string;
  extra?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, extra }) => (
  <div className="flex items-center gap-2.5 mb-5">
    <h3 className="text-sm font-bold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>{title}</h3>
    {extra && <div className="ml-auto">{extra}</div>}
  </div>
);

export default SectionHeader;
