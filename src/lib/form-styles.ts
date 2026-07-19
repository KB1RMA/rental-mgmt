/**
 * Native <input>/<select> elements don't inherit color from surrounding
 * dark: utility classes — their background/text follow the browser's own
 * form-control rendering unless explicitly overridden. Always spread this
 * in alongside any layout-specific classes (border color, width, etc).
 */
export const fieldClass =
  'bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
