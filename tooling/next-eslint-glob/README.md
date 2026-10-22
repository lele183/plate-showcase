# Next.js ESLint directory glob adapter

`@next/eslint-plugin-next@16.4.2` uses `fast-glob` only to find application
directories for `settings.next.rootDir`. Its dependency chain includes the
vulnerable `braces` package.

The root package installs this adapter as the development dependency `fast-glob`.
A version-scoped npm override makes the Next.js plugin use that same dependency.
Keeping the local package at the root makes its file reference resolve correctly
on clean installs.

The adapter uses the existing `tinyglobby` dependency and implements only
`globSync(string, { onlyDirectories: true })`. It preserves absolute and relative
paths, disables automatic directory expansion, and removes trailing separators
except on filesystem roots. Unsupported options fail explicitly. It does not
replace or disable any ESLint rules.

When upgrading the Next.js ESLint plugin, review its use of `fast-glob` again.
Remove the adapter, its root development dependency, and the scoped override once
upstream no longer needs the vulnerable chain. The lockfile regression test
detects reintroduction of `braces` or `micromatch`.

Run `npm ci`, `npm test`, `npm run lint`, and `npm audit` to check installation,
directory matching, the Next.js link rule, and dependency security. The focused
tests also exercise deeply nested brace patterns in a process with a timeout.
