import { apiClient } from '../client';
import { HomeResponse } from '../types';

export function getHome(): Promise<HomeResponse> {
  return apiClient.get<HomeResponse>('/home');
}
