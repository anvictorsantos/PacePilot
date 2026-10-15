import api from '@/services/api.ts'

import type { ProgressResponse } from '@/types/domain.ts'

export async function getProgress(): Promise<ProgressResponse> {
  const { data } = await api.get<ProgressResponse>('/progress')
  return data ?? {}
}
