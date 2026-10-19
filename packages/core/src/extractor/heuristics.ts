/**
 * Heuristics to determine whether a string is user-facing or technical code.
 */

const USER_FACING_ATTRIBUTES = new Set([
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'title',
  'alt',
  'label',
  'helpertext',
  'errortext',
  'description',
]);

const IGNORED_ATTRIBUTES = new Set([
  'classname',
  'class',
  'id',
  'name',
  'key',
  'ref',
  'type',
  'href',
  'src',
  'srcset',
  'rel',
  'target',
  'action',
  'method',
  'enctype',
  'role',
  'style',
  'width',
  'height',
  'viewbox',
  'd',
  'fill',
  'stroke',
  'as',
  'datatestid',
  'data-testid',
  'data-cy',
]);

const URL_OR_PATH_REGEX = /^(https?:\/\/|\/|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+|\.\/|\.\.\/)/;
const COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_UNIT_REGEX = /^-?[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw|pt|ms|s)$/;
const VARIABLE_NAME_REGEX = /^[A-Z0-9_]{3,}$/; // e.g. CONSTANT_NAME

export function isUserFacingAttribute(attrName: string): boolean {
  return USER_FACING_ATTRIBUTES.has(attrName.toLowerCase());
}

export function isIgnoredAttribute(attrName: string): boolean {
  return IGNORED_ATTRIBUTES.has(attrName.toLowerCase());
}

export function isLikelyUserFacingText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return false;
  }

  // Pure numbers or punctuation
  if (/^[0-9\s.,!?:;/\-_()+*=%$€£#@~^&|<>\[\]{}]+$/.test(trimmed)) {
    return false;
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }

  // URLs, file paths, hex colors, css units
  if (URL_OR_PATH_REGEX.test(trimmed)) {
    return false;
  }
  if (COLOR_REGEX.test(trimmed)) {
    return false;
  }
  if (CSS_UNIT_REGEX.test(trimmed)) {
    return false;
  }
  if (VARIABLE_NAME_REGEX.test(trimmed)) {
    return false;
  }

  // Mime types or file extensions
  if (/^[a-z]+\/[a-z0-9\-+.]+$/i.test(trimmed) || /^\.[a-z0-9]+$/i.test(trimmed)) {
    return false;
  }

  return true;
}
