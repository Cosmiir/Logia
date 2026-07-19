import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileText,
  Trash2,
  Plus,
  Search,
  X,
  Edit3,
  Save,
  Loader2,
} from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import ColorPicker from '@/components/ColorPicker';
import GravityMarkdownEditor, { type GravityMarkdownEditorHandle } from '@/components/MarkdownEditor/GravityMarkdownEditor';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
  useReviewTemplates,
  useCreateReviewTemplate,
  useUpdateReviewTemplate,
  useDeleteReviewTemplate,
} from '@/hooks/useReviewTemplates';
import { COLLECTION_COLORS, COLLECTION_ICONS, getIconById } from '@/lib/collection-icons';
import type { ReviewTemplate } from '@/types/review-template';
import type { LucideIcon } from 'lucide-react';

// Truncate content for preview
const truncate = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen).trim() + '...';
};

// Section label component
const SectionLabel: React.FC<{ icon: LucideIcon; label: string; hint?: string }> = ({
  icon: Icon,
  label,
  hint,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-white/60" />
    </div>
    <div>
      <h3 className="text-xs font-semibold text-white/90">{label}</h3>
      {hint && <p className="text-[10px] text-white/40">{hint}</p>}
    </div>
  </div>
);

const TemplateManagement: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigationStore();
  const { data: templates, isLoading } = useReviewTemplates();
  const createMutation = useCreateReviewTemplate();
  const updateMutation = useUpdateReviewTemplate();
  const deleteMutation = useDeleteReviewTemplate();

  const [search, setSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [iconId, setIconId] = useState('file-text');
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const [content, setContent] = useState('');
  const contentEditorRef = useRef<GravityMarkdownEditorHandle>(null);

  const resetForm = () => {
    setName('');
    setIconId('file-text');
    setColor(COLLECTION_COLORS[0]);
    setContent('');
    contentEditorRef.current?.setContent('');
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
    setEditingTemplate(null);
  };

  const handleEdit = (template: ReviewTemplate) => {
    setName(template.name);
    setIconId(template.icon);
    setColor(template.color);
    setContent(template.content);
    contentEditorRef.current?.setContent(template.content);
    setEditingTemplate(template);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          template_id: editingTemplate.id,
          name: name.trim(),
          icon: iconId,
          color,
          content: content.trim(),
        });
        setEditingTemplate(null);
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          icon: iconId,
          color,
          content: content.trim(),
        });
        setIsCreating(false);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteMutation.mutateAsync(templateToDelete);
      setTemplateToDelete(null);
      if (editingTemplate?.id === templateToDelete) {
        setEditingTemplate(null);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const filteredTemplates = search.trim()
    ? templates?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates;

  const templateToDeleteName = templates?.find((t) => t.id === templateToDelete)?.name;

  const isEditingOrCreating = isCreating || editingTemplate !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AppShell>
      <SharedHeader activePage="template-management" />
      <MainContent>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#8b5cf620' }}
              >
                <FileText className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              </div>
              <h1 className="text-lg font-bold text-white">{t('templateManagement.title')}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/30">
              {templates?.length || 0} {t('templateManagement.template', { count: templates?.length || 0 })}
            </span>
            {!isEditingOrCreating && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark rounded-xl text-sm font-semibold text-white transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t('common.new')}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT - Edit/Create Form */}
          <div className="lg:col-span-2 space-y-4">
            {isEditingOrCreating ? (
              <div className="glass-card rounded-2xl p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    {isCreating ? 'Nouveau modèle' : 'Modifier le modèle'}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    {t('templateManagement.templateName')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('templateManagement.namePlaceholder')}
                    maxLength={50}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
                  />
                </div>

                {/* Icon & Color */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Icon */}
                  <div>
                    <SectionLabel icon={FileText} label={t('templateManagement.icon')} hint={t('templateManagement.iconHint')} />
                    <div className="grid grid-cols-5 gap-1.5 max-h-[120px] overflow-y-auto p-2 bg-white/5 rounded-xl border border-white/10">
                      {COLLECTION_ICONS.map((entry) => {
                        const EntryIcon = entry.icon;
                        const isSelected = iconId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setIconId(entry.id)}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-white ring-2 ring-primary/50'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                            title={entry.label}
                          >
                            <EntryIcon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <SectionLabel icon={FileText} label={t('templateManagement.color')} hint={t('templateManagement.colorHint')} />
                    <ColorPicker value={color} onChange={setColor} />
                  </div>
                </div>

                {/* Content with GravityMarkdownEditor */}
                <div>
                  <SectionLabel icon={FileText} label={t('templateManagement.content')} hint={t('templateManagement.contentHint')} />
                  <div className="rounded-xl overflow-hidden border border-white/10 focus-within:border-primary/30 transition-colors">
                    <GravityMarkdownEditor
                      ref={contentEditorRef}
                      value={content}
                      onChange={setContent}
                      autofocus={false}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!name.trim() || isSaving}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isCreating ? 'Créer' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${COLLECTION_COLORS[0]}20` }}
                >
                  <FileText className="w-8 h-8" style={{ color: COLLECTION_COLORS[0] }} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{t('templateManagement.manageTemplates')}</h3>
                <p className="text-xs text-white/40 max-w-sm mx-auto mb-4">
                  {t('templateManagement.description')}
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {t('templateManagement.createTemplate')}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT - Template List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('templateManagement.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Templates Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : filteredTemplates?.length === 0 ? (
              <div className="text-center py-12 text-white/20">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{search ? 'Aucun modèle trouvé' : 'Aucun modèle créé'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredTemplates?.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleEdit(template)}
                    className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      editingTemplate?.id === template.id
                        ? 'bg-white/10 border-primary/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    {/* Icon indicator */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${template.color}20` }}
                    >
                      {(() => {
                        const IconComponent = getIconById(template.icon);
                        return <IconComponent className="w-4 h-4" style={{ color: template.color }} />;
                      })()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-white text-sm truncate">{template.name}</h3>
                        {template.is_default && (
                          <span className="text-[9px] px-1 py-0.5 rounded-full bg-white/10 text-white/50">
                            Défaut
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 line-clamp-2 font-mono">
                        {truncate(template.content, 80)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(template);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        title={t('media.edit')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateToDelete(template.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                        title={t('media.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </MainContent>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={templateToDelete !== null}
        onClose={() => setTemplateToDelete(null)}
        title={`Supprimer "${templateToDeleteName}" ?`}
        description="Ce modèle sera définitivement supprimé."
        iconColor="#ef4444"
        actions={[
          {
            label: deleteMutation.isPending ? 'Suppression...' : 'Supprimer',
            variant: 'danger',
            icon: Trash2,
            onClick: handleDelete,
          },
        ]}
      />
    </AppShell>
  );
};

export default TemplateManagement;
