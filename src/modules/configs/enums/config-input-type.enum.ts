/**
 * Field types a config-driven form can render. Mirrors Fleetzen's
 * ConfigInputType so a shared renderer understands both APIs, plus `group`
 * for nested/repeatable field sets (e.g. quote line items).
 */
export enum ConfigInputType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  JSON = 'json',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  SWITCH = 'switch',
  DATE = 'date',
  DATETIME = 'datetime',
  FILE = 'file',
  MONEY = 'money',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  GROUP = 'group',
}
