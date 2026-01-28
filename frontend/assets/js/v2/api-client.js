/**
 * API Client for Tiny-TID v2 Backend
 */

// 開発環境: バックエンドのフルURLを使用
// 本番環境: Nginxリバースプロキシで /api が :8001 に転送される
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8001/api'
  : '/api';

/**
 * Fetch trains passing through Ibaraki station
 * @returns {Promise<Object>} Train data
 */
export async function fetchIbarakiTrains() {
  const url = `${API_BASE}/trains`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch trains: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch lines passing through Ibaraki station
 * @returns {Promise<Object>} Lines data
 */
export async function fetchLines() {
  const url = `${API_BASE}/lines`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch lines: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch Ibaraki station information
 * @returns {Promise<Object>} Station data
 */
export async function fetchStationInfo() {
  const url = `${API_BASE}/station-info`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch station info: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check backend health
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  const url = '/health';
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
