export const lifeSubPages = [
  '/iris-message',
  '/shop',
  '/arena',
  '/craft-forge',
  '/strawberry-fields',
  '/training-grounds',
];

export function isLifeSubPage(path: string): boolean {
  return lifeSubPages.some(page => path === page || path.startsWith(page + '/'));
}
