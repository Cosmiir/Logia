import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users, Trash2, Camera, Check, X, Plus, Search, Edit2 } from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import PersonCropModal from '@/components/PersonCropModal';
import { PersonPhoto, getPersonPhotoUrl } from '@/components/PersonPhoto';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { usePeople, useCreatePerson, useUpdatePerson, useDeletePerson } from '@/hooks/usePeople';
import type { Person } from '@/types';

const PersonManagement: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigationStore();

  // React Query
  const { data: people = [] } = usePeople();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();

  const [search, setSearch] = useState('');

  // Creation state
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhotoBase64, setNewPersonPhotoBase64] = useState<string | null>(null);
  const [newPersonPhotoPreview, setNewPersonPhotoPreview] = useState<string | null>(null);

  // Editing state
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [editingPersonPhotoBase64, setEditingPersonPhotoBase64] = useState<string | null>(null);
  const [editingPersonPhotoPreview, setEditingPersonPhotoPreview] = useState<string | null>(null);
  const [editingRemovePhoto, setEditingRemovePhoto] = useState(false);

  // Deletion state
  const [personToDelete, setPersonToDelete] = useState<number | null>(null);

  // Cropping state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropForEdit, setIsCropForEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImageSrc(reader.result as string);
      setIsCropForEdit(isEdit);
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) return;
    try {
      await createPerson.mutateAsync({ name: newPersonName.trim(), photo: newPersonPhotoBase64 });
      setNewPersonName('');
      setNewPersonPhotoBase64(null);
      setNewPersonPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to create person:', err);
    }
  };

  const startEditing = (person: Person) => {
    setEditingPersonId(person.id);
    setEditingPersonName(person.name);
    setEditingPersonPhotoPreview(person.photo_path);
    setEditingPersonPhotoBase64(null);
    setEditingRemovePhoto(false);
  };

  const cancelEditing = () => {
    setEditingPersonId(null);
    setEditingPersonName('');
    setEditingPersonPhotoPreview(null);
    setEditingPersonPhotoBase64(null);
    setEditingRemovePhoto(false);
  };

  const handleUpdatePerson = async (id: number) => {
    if (!editingPersonName.trim()) return;
    try {
      await updatePerson.mutateAsync({
        id,
        name: editingPersonName.trim(),
        photo: editingPersonPhotoBase64,
        removePhoto: editingRemovePhoto,
      });
      setEditingPersonId(null);
    } catch (err) {
      console.error('Failed to update person:', err);
    }
  };

  const handleDelete = (id: number) => {
    setPersonToDelete(id);
  };

  const confirmDeletePerson = async () => {
    if (!personToDelete) return;
    try {
      await deletePerson.mutateAsync(personToDelete);
      setPersonToDelete(null);
    } catch (err) {
      console.error('Failed to delete person:', err);
    }
  };

  const personToDeleteName = people.find((p) => p.id === personToDelete)?.name;

  const filtered = search.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : people;

  return (
    <AppShell>
      <SharedHeader activePage="person-management" />
      <MainContent>
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition-all cursor-pointer animate-fade-in"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a78bfa20' }}>
                <Users className="w-4 h-4" style={{ color: '#a78bfa' }} />
              </div>
              <h1 className="text-lg font-bold text-white">{t('common.peopleManagement')}</h1>
            </div>
          </div>
          <span className="text-sm text-white/30">{t('common.person', { count: people.length })}</span>
        </div>

        {/* Creation Box (Premium Glass Card) */}
        <div className="glass-card rounded-2xl p-6 mb-6 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
          <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            {t('person.addNew')}
          </h2>

          <div className="flex flex-col md:flex-row gap-5 items-center">
            {/* Photo upload */}
            <div className="relative group shrink-0">
              <div
                className="w-[80px] aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center bg-white/5 text-white/40 cursor-pointer hover:border-primary/50 transition-all shadow-inner relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {newPersonPhotoPreview ? (
                  <img
                    src={getPersonPhotoUrl(newPersonPhotoPreview)}
                    alt=""
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                  />
                ) : (
                  <Users className="w-7 h-7 opacity-50" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {/* Absolute border overlay to prevent bleed lines */}
                <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e, false)}
                className="hidden"
              />
              {newPersonPhotoPreview && (
                <button
                  type="button"
                  onClick={() => { setNewPersonPhotoBase64(null); setNewPersonPhotoPreview(null); }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white border border-[#0d0e15] shadow cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Input name + Submit */}
            <div className="flex-1 flex gap-3 w-full">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePerson(); }}
                placeholder={t('person.fullNamePlaceholder')}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={handleCreatePerson}
                disabled={!newPersonName.trim() || createPerson.isPending}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>

        {/* List Box */}
        <div className="glass-card rounded-2xl p-6">
          {/* Search bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('person.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* People list grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-white/20">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
              <p className="text-sm">{search ? t('person.noSearchResult') : t('person.noPersonAdded')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((person) => {
                const isEditing = editingPersonId === person.id;

                return (
                  <div
                    key={person.id}
                    className={`flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                      isEditing
                        ? 'bg-white/10 border-primary/40 shadow-2xl scale-[1.02]'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 shadow-lg'
                    }`}
                  >
                    {isEditing ? (
                      // Edit Form in Card
                      <div className="flex flex-col items-center w-full gap-4">
                        {/* Edit photo upload */}
                        <div className="relative shrink-0">
                          <div
                            className="w-[72px] aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center bg-white/5 text-white/40 cursor-pointer hover:border-primary/50 transition-all relative"
                            onClick={() => editFileInputRef.current?.click()}
                          >
                            {editingPersonPhotoPreview && !editingRemovePhoto ? (
                              <img
                                src={getPersonPhotoUrl(editingPersonPhotoPreview)}
                                alt=""
                                className="w-full h-full object-cover object-top"
                                draggable={false}
                              />
                            ) : (
                              <Users className="w-6 h-6 opacity-50" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                            {/* Absolute border overlay to prevent bleed lines */}
                            <div className="absolute inset-0 rounded-xl border border-white/15 pointer-events-none" />
                          </div>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, true)}
                            className="hidden"
                          />
                          {editingPersonPhotoPreview && !editingRemovePhoto && (
                            <button
                              type="button"
                              onClick={() => { setEditingRemovePhoto(true); }}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white border border-[#0d0e15] shadow cursor-pointer transition-colors"
                              title={t('person.removePhoto')}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Edit Name input */}
                        <input
                          type="text"
                          value={editingPersonName}
                          onChange={(e) => setEditingPersonName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePerson(person.id); }}
                          className="w-full text-center px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40"
                          placeholder={t('person.fullName')}
                          autoFocus
                        />

                        {/* Edit actions */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdatePerson(person.id)}
                            disabled={!editingPersonName.trim() || updatePerson.isPending}
                            className="w-8 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/35 border border-green-500/30 text-green-400 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 flex items-center justify-center transition-all cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Render view card
                      <>
                        <PersonPhoto
                          name={person.name}
                          photoPath={person.photo_path}
                          widthClass="w-[72px]"
                          className="mb-3"
                        />

                        {/* Name */}
                        <h3 className="text-sm font-semibold text-white text-center line-clamp-1 w-full px-2 mb-4">
                          {person.name}
                        </h3>

                        {/* Actions (fade-in on hover) */}
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            type="button"
                            onClick={() => startEditing(person)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                            title={t('media.edit')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(person.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                            title={t('media.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </MainContent>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={personToDelete !== null}
        onClose={() => setPersonToDelete(null)}
        title={t('person.deleteTitle', { name: personToDeleteName })}
        description={t('person.deleteDescription')}
        iconColor="#ef4444"
        actions={[
          {
            label: t('media.delete'),
            variant: 'danger',
            icon: Trash2,
            onClick: confirmDeletePerson,
          },
        ]}
      />

      {/* Image Crop Modal */}
      {cropImageSrc && (
        <PersonCropModal
          imageDataUrl={cropImageSrc}
          onConfirm={(croppedDataUrl) => {
            if (isCropForEdit) {
              setEditingPersonPhotoBase64(croppedDataUrl);
              setEditingPersonPhotoPreview(croppedDataUrl);
              setEditingRemovePhoto(false);
            } else {
              setNewPersonPhotoBase64(croppedDataUrl);
              setNewPersonPhotoPreview(croppedDataUrl);
            }
            setCropImageSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (editFileInputRef.current) editFileInputRef.current.value = '';
          }}
          onCancel={() => {
            setCropImageSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (editFileInputRef.current) editFileInputRef.current.value = '';
          }}
        />
      )}
    </AppShell>
  );
};

export default PersonManagement;