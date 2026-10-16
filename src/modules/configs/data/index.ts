import { ConfigSeed } from '../types/config.types';
import { FILTER_CONFIGS } from './filters.config';
import { FORM_CONFIGS } from './forms.config';
import { SETTINGS_CONFIGS } from './settings.config';
import { TABLE_CONFIGS } from './tables.config';
import { WORKFLOW_CONFIGS } from './workflow.config';

export const DEFAULT_CONFIGS: ConfigSeed[] = [
  ...SETTINGS_CONFIGS,
  ...WORKFLOW_CONFIGS,
  ...FORM_CONFIGS,
  ...FILTER_CONFIGS,
  ...TABLE_CONFIGS,
];
