export function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .split(/[\s_]+/)
    .map(word => {
      const transformed = word.charAt(0).toUpperCase() + word.slice(1);
      return transformed;
    })
    .join(' ');
}