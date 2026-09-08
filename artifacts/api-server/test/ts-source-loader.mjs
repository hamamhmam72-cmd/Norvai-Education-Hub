export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".")) {
    const candidates = specifier.endsWith(".js")
      ? [`${specifier.slice(0, -3)}.ts`, specifier]
      : [`${specifier}.ts`, `${specifier}/index.ts`, specifier];
    for (const candidate of candidates) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // Try the next source or built-module candidate.
      }
    }
  }
  return nextResolve(specifier, context);
}