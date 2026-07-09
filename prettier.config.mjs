/** @type {import("prettier").Config} */
const config = {
  // This codebase favors dense, one-statement-per-line logic files; a wide
  // printWidth keeps that shape and just normalizes spacing, instead of
  // reflowing everything into many short lines.
  printWidth: 500,
};

export default config;
