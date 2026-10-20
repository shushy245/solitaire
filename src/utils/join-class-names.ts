const isClassName = (name: string | false | undefined): name is string => typeof name === 'string' && name !== '';

// Joins the present class names with spaces, dropping undefined/false/empty entries.
export const joinClassNames = (...names: (string | false | undefined)[]): string => names.filter(isClassName).join(' ');
