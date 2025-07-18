export interface SlugOptions {
  maxLength?: number;
  separator?: string;
}

/**
 * Generates a URL-friendly slug from a string
 */
export function generateSlug(input: string, options: SlugOptions = {}): string {
  const { maxLength = 80, separator = '-' } = options;
  
  return input
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with separator
    .replace(/[\s_]+/g, separator)
    // Remove special characters except separator
    .replace(/[^a-z0-9\-]/g, '')
    // Replace multiple separators with single separator
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    // Remove leading/trailing separators
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '')
    // Truncate to max length
    .substring(0, maxLength)
    // Remove trailing separator if truncation created one
    .replace(new RegExp(`${separator}+$`, 'g'), '');
}

/**
 * Generates a unique project slug by checking for collisions
 * Project slugs are capped at 20 characters including collision numbers
 */
export async function generateUniqueProjectSlug(
  name: string, 
  userId: string,
  checkExisting: (userId: string, slug: string) => Promise<boolean>
): Promise<string> {
  const maxProjectLength = 20;
  const baseSlug = generateSlug(name, { maxLength: maxProjectLength });
  
  if (!baseSlug) {
    throw new Error('Project name must contain at least one alphanumeric character');
  }
  
  // Check if base slug is available
  const exists = await checkExisting(userId, baseSlug);
  if (!exists) {
    return baseSlug;
  }
  
  // Try numbered variations, ensuring total length stays within limit
  for (let i = 2; i <= 999; i++) {
    const suffix = `-${i}`;
    const maxBaseLength = maxProjectLength - suffix.length;
    
    // Truncate base slug if needed to accommodate suffix
    const truncatedBase = baseSlug.length > maxBaseLength 
      ? baseSlug.substring(0, maxBaseLength)
      : baseSlug;
    
    const numberedSlug = `${truncatedBase}${suffix}`;
    const numberedExists = await checkExisting(userId, numberedSlug);
    if (!numberedExists) {
      return numberedSlug;
    }
  }
  
  throw new Error('Unable to generate unique project slug');
}

/**
 * Generates a unique task slug within a project
 * Task slugs are capped at 20 characters including project ID and number
 */
export async function generateUniqueTaskSlug(
  projectId: string,
  checkExisting: (taskId: string) => Promise<boolean>
): Promise<string> {
  const maxTaskLength = 20;
  
  // Find the next sequential number, ensuring total length stays within limit
  for (let i = 1; i <= 9999; i++) {
    const suffix = `-${i}`;
    const maxProjectLength = maxTaskLength - suffix.length;
    
    // Truncate project ID if needed to accommodate task number
    const truncatedProjectId = projectId.length > maxProjectLength 
      ? projectId.substring(0, maxProjectLength)
      : projectId;
    
    const taskSlug = `${truncatedProjectId}${suffix}`;
    const exists = await checkExisting(taskSlug);
    if (!exists) {
      return taskSlug;
    }
  }
  
  throw new Error('Unable to generate unique task slug');
}

/**
 * Validates a project slug format
 */
export function validateProjectSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false;
  if (slug.length > 20) return false;
  
  // Must match: alphanumeric and hyphens only, no leading/trailing hyphens
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Validates a task slug format
 */
export function validateTaskSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false;
  if (slug.length > 20) return false;
  
  // Must match: project-slug-number format
  const taskSlugRegex = /^[a-z0-9]+(-[a-z0-9]+)*-\d+$/;
  return taskSlugRegex.test(slug);
}

/**
 * Extracts project ID from task slug
 */
export function getProjectIdFromTaskSlug(taskSlug: string): string {
  const parts = taskSlug.split('-');
  if (parts.length < 2) {
    throw new Error('Invalid task slug format');
  }
  
  // Remove the last part (task number) to get project ID
  return parts.slice(0, -1).join('-');
}