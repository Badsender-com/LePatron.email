/**
 * Standardized table configuration for v-data-table components.
 *
 * Usage:
 * ```vue
 * <v-data-table
 *   :footer-props="TABLE_FOOTER_PROPS"
 *   :hide-default-footer="items.length <= TABLE_PAGINATION_THRESHOLD"
 * />
 * ```
 */

/**
 * Default items per page options for all tables.
 * -1 represents "All" items (Vuetify convention).
 */
export const TABLE_ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, -1];

/**
 * Threshold below which the pagination footer is hidden.
 */
export const TABLE_PAGINATION_THRESHOLD = 25;

/**
 * Standard footer props for v-data-table.
 * Provides consistent pagination options across the application.
 */
export const TABLE_FOOTER_PROPS = {
  'items-per-page-options': TABLE_ITEMS_PER_PAGE_OPTIONS,
  'items-per-page-all-text': 'Tout',
};
