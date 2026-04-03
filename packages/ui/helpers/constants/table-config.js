/**
 * Standardized Table Configuration
 * =================================
 *
 * This module provides centralized configuration for data tables across the application.
 * It ensures consistent pagination, styling, and behavior.
 *
 * ## Recommended Usage
 *
 * ### Option 1: Use BsDataTable component (Preferred)
 *
 * The `BsDataTable` component wraps v-data-table with all standard configurations
 * and provides additional features like loading states and empty states.
 *
 * ```vue
 * <bs-data-table
 *   :headers="headers"
 *   :items="items"
 *   :loading="loading"
 *   clickable
 *   @click:row="handleRowClick"
 * >
 *   <template #item.name="{ item }">
 *     <span class="font-weight-medium">{{ item.name }}</span>
 *   </template>
 * </bs-data-table>
 * ```
 *
 * ### Option 2: Direct v-data-table usage
 *
 * For cases where you need more control, use the constants directly:
 *
 * ```vue
 * <script>
 * import {
 *   TABLE_FOOTER_PROPS,
 *   TABLE_PAGINATION_THRESHOLD,
 * } from '~/helpers/constants/table-config.js';
 *
 * export default {
 *   TABLE_FOOTER_PROPS,
 *   TABLE_PAGINATION_THRESHOLD,
 * };
 * </script>
 *
 * <template>
 *   <v-data-table
 *     :headers="headers"
 *     :items="items"
 *     :hide-default-footer="items.length <= $options.TABLE_PAGINATION_THRESHOLD"
 *     :footer-props="$options.TABLE_FOOTER_PROPS"
 *   />
 * </template>
 * ```
 *
 * ## Design Guidelines
 *
 * - Tables show 25 items per page by default
 * - Pagination footer is hidden when items <= 25
 * - Pagination options: 25, 50, 100, All
 * - Clickable rows have a subtle hover effect (accent color at 5% opacity)
 * - Empty states should include an icon and descriptive message
 * - Action columns should use icon buttons with tooltips
 */

/**
 * Default items per page options for all tables.
 * -1 represents "All" items (Vuetify convention).
 */
export const TABLE_ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, -1];

/**
 * Default number of items per page.
 */
export const TABLE_DEFAULT_ITEMS_PER_PAGE = 25;

/**
 * Threshold below which the pagination footer is hidden.
 * When items.length <= this value, the footer is not displayed.
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
