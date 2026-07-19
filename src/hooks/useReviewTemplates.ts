import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewTemplatesApi } from '@/lib/tauri-api';
import type { CreateReviewTemplateDto, UpdateReviewTemplateDto } from '@/types/review-template';

export function useReviewTemplates() {
  return useQuery({
    queryKey: ['reviewTemplates'],
    queryFn: () => reviewTemplatesApi.getAll(),
  });
}

export function useCreateReviewTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateReviewTemplateDto) => reviewTemplatesApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewTemplates'] });
    },
  });
}

export function useUpdateReviewTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateReviewTemplateDto) => reviewTemplatesApi.update(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewTemplates'] });
    },
  });
}

export function useDeleteReviewTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: number) => reviewTemplatesApi.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewTemplates'] });
    },
  });
}
