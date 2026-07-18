import { apiClient } from '../client';
import { UpcomingPage } from '../types';

export interface GetUpcomingParams {
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD", exclusive
}

export function getUpcoming({ from, to }: GetUpcomingParams): Promise<UpcomingPage> {
  return apiClient.get<UpcomingPage>(`/me/upcoming?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}
