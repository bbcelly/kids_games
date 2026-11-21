// The base game, packaged exactly like a mod.
import { data as content } from './data.js';
import { missions } from './missions.js';
import cs from './locale/cs.js';
import en from './locale/en.js';

export const manifest = { id: 'base', name: 'Biofilm', version: '1.0.0', description: 'The base game' };

export function data(api) {
  content(api);
  missions(api);
  api.locale('cs', cs);
  api.locale('en', en);
}
