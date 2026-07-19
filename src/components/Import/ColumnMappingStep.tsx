import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Check, X, Search, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldDefinition {
  key: string;
  labelKey: string;
  required: boolean;
  group: string;
  icon: React.ElementType;
  descKey?: string;
  transform?: (value: string) => string;
}

const FIELD_GROUPS = {
  basic: { labelKey: 'import.fieldGroups.basic', color: '#8b5cf6', icon: 'Info' },
  status: { labelKey: 'import.fieldGroups.status', color: '#0ea5e9', icon: 'Activity' },
  notes: { labelKey: 'import.fieldGroups.notes', color: '#10b981', icon: 'Star' },
  genres: { labelKey: 'import.fieldGroups.genres', color: '#ec4899', icon: 'Tag' },
};

const FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: 'collection', labelKey: 'import.fields.collection.label', required: false, group: 'basic', icon: GripVertical, descKey: 'import.fields.collection.desc' },
  { key: 'title', labelKey: 'import.fields.title.label', required: true, group: 'basic', icon: GripVertical, descKey: 'import.fields.title.desc' },
  { key: 'creator', labelKey: 'import.fields.creator.label', required: false, group: 'basic', icon: GripVertical, descKey: 'import.fields.creator.desc' },
  { key: 'media_status', labelKey: 'import.fields.media_status.label', required: false, group: 'basic', icon: GripVertical, descKey: 'import.fields.media_status.desc' },
  { key: 'release_date', labelKey: 'import.fields.release_date.label', required: false, group: 'basic', icon: GripVertical, descKey: 'import.fields.release_date.desc' },
  { key: 'synopsis', labelKey: 'import.fields.synopsis.label', required: false, group: 'basic', icon: GripVertical, descKey: 'import.fields.synopsis.desc' },
  { key: 'progress_status', labelKey: 'import.fields.progress_status.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.progress_status.desc' },
  { key: 'progress_current', labelKey: 'import.fields.progress_current.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.progress_current.desc' },
  { key: 'progress_total', labelKey: 'import.fields.progress_total.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.progress_total.desc' },
  { key: 'experience_date', labelKey: 'import.fields.experience_date.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.experience_date.desc' },
  { key: 'replay_count', labelKey: 'import.fields.replay_count.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.replay_count.desc' },
  { key: 'experience_dates', labelKey: 'import.fields.experience_dates.label', required: false, group: 'status', icon: GripVertical, descKey: 'import.fields.experience_dates.desc' },
  { key: 'user_rating', labelKey: 'import.fields.user_rating.label', required: false, group: 'notes', icon: GripVertical, descKey: 'import.fields.user_rating.desc' },
  { key: 'positive_points', labelKey: 'import.fields.positive_points.label', required: false, group: 'notes', icon: GripVertical, descKey: 'import.fields.positive_points.desc' },
  { key: 'negative_points', labelKey: 'import.fields.negative_points.label', required: false, group: 'notes', icon: GripVertical, descKey: 'import.fields.negative_points.desc' },
  { key: 'user_review', labelKey: 'import.fields.user_review.label', required: false, group: 'notes', icon: GripVertical, descKey: 'import.fields.user_review.desc' },
  { key: 'genre_ids', labelKey: 'import.fields.genre_ids.label', required: false, group: 'genres', icon: GripVertical, descKey: 'import.fields.genre_ids.desc' },
];

// Auto-detection patterns
const AUTO_DETECT_PATTERNS: Record<string, string[]> = {
  title: ['nom', 'name', 'titre', 'title'],
  collection: ['collection', 'catégorie', 'category'],
  creator: ['créateur', 'creator', 'réalisateur', 'director', 'auteur', 'author'],
  release_date: ['sorti le', 'release', 'date de sortie', 'release date'],
  synopsis: ['synopsis', 'résumé', 'summary', 'description'],
  media_status: ['statut', 'status', 'état', 'statut du média', 'statut media', 'work status'],
  progress_status: ['progression', 'progress', 'statut de progression', 'progress status'],
  progress_current: ['progression actuelle', 'progress current'],
  progress_total: ['progression totale', 'progress total'],
  is_abandoned: ['abandonné', 'abandoned'],
  replay_count: ['reprise', 'replay', 'rejoué'],
  experience_date: ['vu le', 'watched', 'date d\'expérience', 'experience date'],
  experience_dates: ['dates', 'dates d\'expérience'],
  user_rating: ['note', 'rating', 'score'],
  user_review: ['avis', 'review', 'critique'],
  positive_points: ['points positifs', 'pros', 'positive'],
  negative_points: ['points négatifs', 'cons', 'negative'],
  genre_ids: ['genre', 'genres', 'tag', 'tags'],
};

// Utility function to normalize column IDs (strip index suffix)
const normalizeColumnId = (columnId: string): string => {
  return columnId.replace(/-\d+$/, '');
};

interface ColumnMappingStepProps {
  csvColumns: string[];
  sampleRows: string[][];
  columnMapping: Record<string, string>;
  setColumnMapping: (mapping: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DraggableColumn: React.FC<{
  column: string;
  sampleValue: string;
  isMapped: boolean;
  id: string;
}> = ({ column, sampleValue, isMapped, id }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 bg-white/5 border border-white/10 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/10 transition-all ${
        isMapped ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-white/30" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{column}</div>
          <div className="text-xs text-white/40 truncate">{sampleValue || '-'}</div>
        </div>
        {isMapped && <Check className="w-4 h-4 text-emerald-400" />}
      </div>
    </div>
  );
};

const SelectDropdown: React.FC<{
  value: string | null;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Get display name (strip index suffix)
  const displayValue = value ? normalizeColumnId(value) : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 hover:border-white/20 transition-all focus:outline-none focus:border-primary/50"
      >
        <span className={displayValue ? 'text-white' : 'text-white/40'}>
          {displayValue || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-white/30">
                  {t('import.noColumnAvailable')}
                </div>
              ) : (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      value === option.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {value === option.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span className={value === option.id ? 'font-medium' : ''}>{option.name}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DropZone: React.FC<{
  field: FieldDefinition;
  mappedColumn: string | null;
  sampleValue: string;
  onUnmap: () => void;
  onMap: (column: string) => void;
  unmappedColumns: { id: string; name: string; sampleValues: string[] }[];
}> = ({ field, mappedColumn, sampleValue, onUnmap, onMap, unmappedColumns }) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: field.key });

  // Get display name (strip index suffix)
  const displayName = mappedColumn ? normalizeColumnId(mappedColumn) : null;

  return (
    <div
      ref={setNodeRef}
      className={`p-4 bg-white/5 border-2 rounded-lg transition-all ${
        isOver ? 'border-primary bg-primary/10' : 'border-white/10'
      } ${mappedColumn ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${FIELD_GROUPS[field.group as keyof typeof FIELD_GROUPS].color}20` }}>
          <field.icon className="w-4 h-4" style={{ color: FIELD_GROUPS[field.group as keyof typeof FIELD_GROUPS].color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{t(field.labelKey)}</span>
            {field.required && <span className="text-xs text-red-400">*</span>}
          </div>
          {field.descKey && (
            <div className="text-xs text-white/40 mb-2">{t(field.descKey)}</div>
          )}
          
          {mappedColumn ? (
            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">{displayName}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onUnmap(); }}
                className="ml-auto p-1 hover:bg-emerald-500/20 rounded transition-colors"
              >
                <X className="w-3 h-3 text-emerald-400" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-white/30 italic">{t('import.dragOrSelect')}</div>
              <SelectDropdown
                value={null}
                onChange={onMap}
                options={unmappedColumns.map(col => ({ id: col.id, name: col.name }))}
                placeholder={t('import.selectColumn')}
              />
            </div>
          )}
          
          {mappedColumn && sampleValue && (
            <div className="mt-2 text-xs text-white/50">
              <span className="text-white/30">{t('common.preview')}:</span> {sampleValue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ColumnMappingStep: React.FC<ColumnMappingStepProps> = ({
  csvColumns,
  sampleRows,
  columnMapping,
  setColumnMapping,
  onNext,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const { t } = useTranslation();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Prepare CSV columns with sample values
  const csvColumnData = useMemo(() => {
    return csvColumns.map((col, idx) => ({
      id: `${col}-${idx}`,
      name: col,
      displayName: col, // Display name without index
      sampleValues: sampleRows.map(row => row[idx] || ''),
    }));
  }, [csvColumns, sampleRows]);

  // Get all unmapped columns (before filtering)
  const allUnmappedColumns = useMemo(() => {
    const mappedIds = Object.values(columnMapping).filter(Boolean);
    return csvColumnData.filter(col => !mappedIds.includes(col.id));
  }, [csvColumnData, columnMapping]);

  // Get unmapped columns with search filter
  const unmappedColumns = useMemo(() => {
    if (!csvSearchQuery) return allUnmappedColumns;
    
    const query = csvSearchQuery.toLowerCase();
    return allUnmappedColumns.filter(col =>
      col.name.toLowerCase().includes(query) ||
      col.sampleValues.some(v => v.toLowerCase().includes(query))
    );
  }, [allUnmappedColumns, csvSearchQuery]);

  // Filter fields by search
  const filteredFields = useMemo(() => {
    if (!searchQuery) return FIELD_DEFINITIONS;
    const query = searchQuery.toLowerCase();
    return FIELD_DEFINITIONS.filter(f =>
      t(f.labelKey).toLowerCase().includes(query) ||
      (f.descKey && t(f.descKey).toLowerCase().includes(query)) ||
      f.key.toLowerCase().includes(query)
    );
  }, [searchQuery, t]);

  // Group fields
  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldDefinition[]> = {};
    filteredFields.forEach(field => {
      if (!groups[field.group]) groups[field.group] = [];
      groups[field.group].push(field);
    });
    return groups;
  }, [filteredFields]);

  // Auto-detection
  const handleAutoDetect = () => {
    const newMapping: Record<string, string> = {};
    
    csvColumnData.forEach((col) => {
      const lowerCol = col.name.toLowerCase();
      
      for (const [fieldKey, patterns] of Object.entries(AUTO_DETECT_PATTERNS)) {
        if (patterns.some(pattern => lowerCol.includes(pattern))) {
          newMapping[fieldKey] = col.id; // Store the full ID with index
          break;
        }
      }
    });
    
    setColumnMapping(newMapping);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped on a field
    if (FIELD_DEFINITIONS.some(f => f.key === overId)) {
      // Check if this column is already mapped to another field
      const existingMapping = Object.entries(columnMapping).find(([_, col]) => col === activeId);
      if (existingMapping) {
        // Remove old mapping and add new one
        const newMapping = { ...columnMapping };
        delete newMapping[existingMapping[0]];
        newMapping[overId] = activeId;
        setColumnMapping(newMapping);
      } else {
        // Just add new mapping
        setColumnMapping({ ...columnMapping, [overId]: activeId });
      }
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const handleUnmapField = (fieldKey: string) => {
    const newMapping = { ...columnMapping };
    delete newMapping[fieldKey];
    setColumnMapping(newMapping);
  };

  const handleMapField = (fieldKey: string, columnId: string) => {
    setColumnMapping({ ...columnMapping, [fieldKey]: columnId });
  };

  // Check if required fields are mapped
  const hasTitleMapping = columnMapping.title;
  const isFormValid = hasTitleMapping;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('import.mapColumns')}</h2>
          <p className="text-white/60 text-sm">
            {t('import.mapColumnsHint')}
          </p>
        </div>
        <button
          onClick={handleAutoDetect}
          className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {t('common.autoDetect')}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: CSV Columns */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white/70">{t('import.csvColumns')}</h3>
              <span className="text-xs text-white/40">{t('import.available', { count: allUnmappedColumns.length })}</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={csvSearchQuery}
                onChange={(e) => setCsvSearchQuery(e.target.value)}
                placeholder={t('import.searchColumn')}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30"
              />
            </div>

            <SortableContext items={unmappedColumns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                {unmappedColumns.length === 0 ? (
                  <div className="p-8 text-center text-white/40 text-sm">
                    {csvSearchQuery ? t('import.noResults') : t('import.allColumnsMapped')}
                  </div>
                ) : (
                  unmappedColumns.map((col) => (
                    <DraggableColumn
                      key={col.id}
                      id={col.id}
                      column={col.name}
                      sampleValue={col.sampleValues[0]}
                      isMapped={false}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </div>

          {/* Right: Logia Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white/70">{t('import.logiaFields')}</h3>
              <span className="text-xs text-white/40">{t('import.mappedCount', { count: Object.values(columnMapping).filter(Boolean).length })}</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('import.searchField')}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30"
              />
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
              {Object.entries(groupedFields).map(([groupKey, fields]) => {
                const groupInfo = FIELD_GROUPS[groupKey as keyof typeof FIELD_GROUPS];
                if (!fields.length) return null;
                
                return (
                  <div key={groupKey}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: groupInfo.color }} />
                      <span className="text-sm font-semibold text-white/80">{t(groupInfo.labelKey)}</span>
                    </div>
                    <div className="space-y-2">
                      {fields.map((field) => {
                        const mappedColumn = columnMapping[field.key];
                        const sampleValue = mappedColumn
                          ? csvColumnData.find(c => c.name === mappedColumn)?.sampleValues[0]
                          : '';
                        
                        return (
                          <DropZone
                            key={field.key}
                            field={field}
                            mappedColumn={mappedColumn || null}
                            sampleValue={sampleValue || ''}
                            onUnmap={() => handleUnmapField(field.key)}
                            onMap={(col) => handleMapField(field.key, col)}
                            unmappedColumns={unmappedColumns}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <DragOverlay>
          {activeId ? (
            <div className="p-3 bg-primary/20 border border-primary rounded-lg">
              <div className="text-sm font-medium text-white">{normalizeColumnId(activeId)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <div className="flex justify-between items-center pt-6 border-t border-white/10">
        <div className="text-sm text-white/50">
          {t('import.columnsMapped', { count: Object.values(columnMapping).filter(Boolean).length })}
          {!hasTitleMapping && <span className="text-red-400 ml-2">• {t('import.titleRequired')}</span>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            onClick={onNext}
            disabled={!isFormValid}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.next')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingStep;
