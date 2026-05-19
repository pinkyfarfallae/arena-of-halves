export const isValidTwitterUrl = (url: string): boolean => {
  const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^\/]+\/status\/\d+/i;
  const xRegex = /^https?:\/\/(www\.)?x\.com\/[^\/]+\/status\/\d+/i;
  return twitterRegex.test(url) || xRegex.test(url);
};

export const extractTweetId = (url: string): string | null => {
  const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^\/]+\/status\/(\d+)/i;
  const xRegex = /^https?:\/\/(www\.)?x\.com\/[^\/]+\/status\/(\d+)/i;

  let match = url.match(twitterRegex);
  if (match && match[2]) {
    return match[2];
  }

  match = url.match(xRegex);
  if (match && match[2]) {
    return match[2];
  }

  return null;
};