export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getFormNumber(formData: FormData, key: string): number {
  const value = formData.get(key);
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return isNaN(parsed) ? 0 : parsed;
}

export function getFormBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

export function getFormFiles(formData: FormData, key: string): File[] {
  const files = formData.getAll(key);
  return files.filter((f): f is File => f instanceof File && f.size > 0);
}

export function getFormFilesByPrefix(formData: FormData, prefix: string): File[] {
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && !key.endsWith("undefined") && value instanceof File) {
      files.push(value);
    }
  }
  return files;
}

