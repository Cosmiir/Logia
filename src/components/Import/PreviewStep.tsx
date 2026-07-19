import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { Pagination } from '@/components/Pagination';

interface PreviewStepProps {
  csvPreview: any;
  columnMapping: Record<string, string>;
  onBack: () => void;
  onImport: () => void;
}

const ROWS_PER_PAGE = 10;

const StatCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
}> = ({ icon, iconBg, value, label }) => (
  <div className="glass-card rounded-xl p-4 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-white/45 mt-0.5">{label}</div>
    </div>
  </div>
);

const PreviewStep: React.FC<PreviewStepProps> = ({
  csvPreview, columnMapping, onBack, onImport,
}) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const allRows: string[][] = csvPreview?.all_rows || [];
  const columns: string[] = csvPreview?.columns || [];
  const totalRows = csvPreview?.row_count || allRows.length;
  const mappedCount = Object.values(columnMapping).filter(Boolean).length;

  // pagination on all rows
  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const pageRows = allRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const pageStart = (page - 1) * ROWS_PER_PAGE + 1;
  const pageEnd = Math.min(page * ROWS_PER_PAGE, allRows.length);

  const mappingEntries = Object.entries(columnMapping).filter(([, v]) => v);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">{t('import.previewTitle')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          {t('import.dataPreview')}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Database className="w-5 h-5 text-blue-400" />}
          iconBg="bg-blue-500/15"
          value={totalRows}
          label={t('import.mediasToImport')}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          iconBg="bg-emerald-500/15"
          value={mappedCount}
          label={t('import.mappedColumns')}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          iconBg="bg-amber-500/15"
          value={0}
          label={t('import.warnings')}
        />
      </div>

      {/* Mapping badges */}
      <div className="glass-card rounded-2xl p-5">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{t('import.columnMapping')}</p>
        <div className="flex flex-wrap gap-2">
          {mappingEntries.map(([field, columnId]) => (
            <div
              key={field}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs"
            >
              <span className="text-white/50">{field}</span>
              <ChevronRight className="w-3 h-3 text-white/25" />
              <span className="text-white font-medium">{columnId.replace(/-\d+$/, '')}</span>
            </div>
          ))}
          {mappingEntries.length === 0 && (
            <span className="text-xs text-white/30">{t('import.noColumnMapped')}</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-center py-3 px-4 text-xs font-semibold text-white/35 uppercase tracking-wider w-12">#</th>
                {columns.map((col, i) => (
                  <th key={i} className="text-center py-3 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center text-white/30 text-sm">
                    Aucune donnée disponible
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => {
                  const globalIndex = (page - 1) * ROWS_PER_PAGE + rowIndex + 1;
                  return (
                    <tr
                      key={rowIndex}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors group"
                    >
                      <td className="py-3 px-4 text-white/25 text-xs tabular-nums text-center">{globalIndex}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="py-3 px-4 text-white/60 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis text-center">
                          {cell ? (
                            <span className="group-hover:text-white/80 transition-colors">{cell}</span>
                          ) : (
                            <span className="text-white/20 italic text-xs">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={allRows.length}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onPageChange={setPage}
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button onClick={onBack} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer">
          Retour
        </button>
        <button
          onClick={onImport}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-all cursor-pointer shadow-lg shadow-primary/25 flex items-center gap-2"
        >
          Lancer l'import <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PreviewStep;
