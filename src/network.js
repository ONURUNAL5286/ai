export function describeNetworkError(error) {
  const cause = error?.cause;
  const details = [
    error?.message,
    cause?.code,
    cause?.syscall,
    cause?.hostname,
  ].filter(Boolean);

  return details.join(" | ");
}

export async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(describeNetworkError(lastError));
}
