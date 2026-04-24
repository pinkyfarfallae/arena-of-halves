export const isValidTwitterUrl = (url: string): boolean => {
  const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^\/]+\/status\/\d+/i;
  const xRegex = /^https?:\/\/(www\.)?x\.com\/[^\/]+\/status\/\d+/i;
  return twitterRegex.test(url) || xRegex.test(url);
};