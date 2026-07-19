import { useQuery } from '@tanstack/react-query';
import { genresApi } from '@/lib/tauri-api';

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => genresApi.getAll(),
  });
}
