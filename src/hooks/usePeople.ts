import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { peopleApi } from '@/lib/tauri-api';

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: () => peopleApi.getAll(),
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, photo }: { name: string; photo: string | null }) =>
      peopleApi.create(name, photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      photo,
      removePhoto,
    }: {
      id: number;
      name: string;
      photo: string | null;
      removePhoto: boolean;
    }) => peopleApi.update(id, name, photo, removePhoto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => peopleApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
}