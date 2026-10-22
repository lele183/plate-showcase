/* eslint-disable @typescript-eslint/no-require-imports -- The Next.js plugin loads this adapter through CommonJS. */
const { statSync } = require("node:fs");
const { isAbsolute, parse } = require("node:path");
const { globSync } = require("tinyglobby");

// This adapter only covers Next.js 16.4.2's root-directory lookup.
exports.globSync = (patterns, options) => {
  if (
    typeof patterns !== "string" ||
    options?.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== "onlyDirectories")
  ) {
    throw new TypeError(
      "The Next.js ESLint glob adapter only supports { onlyDirectories: true }.",
    );
  }

  if (patterns === parse(patterns).root) {
    return statSync(patterns, { throwIfNoEntry: false })?.isDirectory()
      ? [patterns]
      : [];
  }

  return globSync(patterns, {
    absolute: isAbsolute(patterns),
    onlyDirectories: true,
    expandDirectories: false,
  }).map((directory) =>
    directory.length > parse(directory).root.length
      ? directory.replace(/\/$/, "")
      : directory,
  );
};
