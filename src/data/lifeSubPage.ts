export const lifeSubPages = [
  '/iris-message',
  '/shop',
  '/arena',
  '/forge',
  '/strawberry-fields',
  '/training-grounds',
  '/big-house',
];

export function isLifeSubPage(path: string): boolean {
  return lifeSubPages.some(page => path === page || path.startsWith(page + '/'));
}
