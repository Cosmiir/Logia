import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { CreateObjectiveDto, UpdateObjectiveDto } from '@/types';
import { useTriggerNotifications } from './useTriggerNotifications';

export function useObjectives() {
  return useQuery({
    queryKey: ['objectives'],
    queryFn: () => tauriApi.objectives.getAll(),
  });
}

export function useCreateObjective() {
  const queryClient = useQueryClient();
  const { triggerNotifications } = useTriggerNotifications();

  return useMutation({
    mutationFn: (dto: CreateObjectiveDto) => tauriApi.objectives.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      triggerNotifications();
    },
  });
}

export function useUpdateObjective() {
  const queryClient = useQueryClient();
  const { triggerNotifications } = useTriggerNotifications();

  return useMutation({
    mutationFn: (dto: UpdateObjectiveDto) => tauriApi.objectives.update(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      triggerNotifications();
    },
  });
}

export function useDeleteObjective() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objectiveId: number) => tauriApi.objectives.delete(objectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
}
