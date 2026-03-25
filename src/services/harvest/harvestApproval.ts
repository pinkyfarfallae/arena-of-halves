const normalizeExtractedTweet = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueTweets = (tweets: string[]): string[] => {
  const seen = new Set<string>();

  return tweets.filter(tweet => {
    if (!tweet || seen.has(tweet)) {
      return false;
    }

    seen.add(tweet);
    return true;
  });
};

const uniqueHandles = (handles: string[]): string[] => {
  const seen = new Set<string>();

  return handles.filter(handle => {
    const normalizedHandle = handle.toLowerCase();

    if (!normalizedHandle || seen.has(normalizedHandle)) {
      return false;
    }

    seen.add(normalizedHandle);
    return true;
  });
};

const extractMentions = (text: string): string[] => {
  const mentions = text.match(/@(\w+)/g) || [];
  return uniqueHandles(mentions.map(m => m.substring(1)));
};

const extractTweetUsernames = (text: string): string[] => {
  const usernames = text.match(/(?:^|\n)\s*(?:author|username|handle)\s*:\s*@?([A-Za-z0-9_]{1,15})\b/gi) || [];

  return uniqueHandles(
    usernames
      .map(entry => entry.match(/@?([A-Za-z0-9_]{1,15})\b/i)?.[1] || '')
      .filter(Boolean)
  );
};

const extractParticipantHandles = (text: string): string[] =>
  uniqueHandles([...extractMentions(text), ...extractTweetUsernames(text)]);

// Extract Twitter handle from URL or @mention
const extractTwitterHandle = (input: string): string | null => {
  if (!input) return null;

  const trimmed = input.trim();

  // Extract from URL: https://x.com/username or https://twitter.com/username
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})/i);
  if (urlMatch) {
    return urlMatch[1].toLowerCase();
  }

  // Remove @ if present
  const cleaned = trimmed.replace(/^@/, '');

  // Check if it's a valid handle
  if (/^[A-Za-z0-9_]{1,15}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return null;
};

// Parse script output format: "--- TWEET X ---\nAuthor: @username\nMentions: @user1, @user2\ntext"
const parseScriptOutput = (input: string): { text: string; authors: string[]; tweetCount: number } | null => {
  const trimmed = input.trim();

  // Check if it matches the script output format
  if (!trimmed.includes('--- TWEET') || !trimmed.includes('Author:')) {
    return null;
  }

  const tweetBlocks = trimmed.split(/---\s*TWEET\s+\d+\s*---/).filter(Boolean);
  const allAuthors: string[] = [];
  const tweetTexts: string[] = [];

  for (const block of tweetBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let tweetText = '';
    for (const line of lines) {
      // Extract author from "Author: @username" line
      if (line.startsWith('Author:')) {
        const authorLine = line.replace('Author:', '').trim();
        const author = authorLine.replace(/^@/, '');
        if (author) {
          allAuthors.push(author);
        }
        continue;
      }
      // Skip Mentions line
      else if (line.startsWith('Mentions:')) {
        continue;
      }
      // Collect actual tweet text
      else {
        tweetText += (tweetText ? '\n' : '') + line;
      }
    }

    if (tweetText) {
      tweetTexts.push(tweetText);
    }
  }

  if (tweetTexts.length === 0) {
    return null;
  }

  return {
    text: tweetTexts.join('\n\n'),
    authors: uniqueHandles(allAuthors),
    tweetCount: tweetBlocks.length,
  };
};

const extractPlainReviewText = (input: string): string => {
  const trimmedInput = input.trim();

  if (!trimmedInput.includes('<') || !trimmedInput.includes('>')) {
    return trimmedInput;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmedInput, 'text/html');
  const tweetTextNodes = uniqueTweets(
    Array.from(doc.querySelectorAll('[data-testid="tweetText"]'))
      .map(node => normalizeExtractedTweet(node.textContent || ''))
      .filter(Boolean)
  );

  const articleLangNodes = uniqueTweets(
    Array.from(doc.querySelectorAll('article [lang]'))
      .map(node => normalizeExtractedTweet(node.textContent || ''))
      .filter(Boolean)
  );

  const articleBlocks = uniqueTweets(
    Array.from(doc.querySelectorAll('article'))
      .map(article => {
        const articleTweetParts = Array.from(article.querySelectorAll('[data-testid="tweetText"], [lang]'))
          .map(node => normalizeExtractedTweet(node.textContent || ''))
          .filter(Boolean);

        return normalizeExtractedTweet(uniqueTweets(articleTweetParts).join('\n'));
      })
      .filter(Boolean)
  );

  const tweetHtmlBlocks =
    trimmedInput.match(/<[^>]*data-testid=(["'])tweetText\1[^>]*>[\s\S]*?(?=<[^>]*data-testid=(["'])tweetText\2[^>]*>|$)/gi) || [];
  const tweetTextFallback = uniqueTweets(
    tweetHtmlBlocks
      .map(block => normalizeExtractedTweet(parser.parseFromString(block, 'text/html').body.textContent || ''))
      .filter(Boolean)
  );

  const langHtmlBlocks =
    trimmedInput.match(/<[^>]*lang=(["'])[^"']+\1[^>]*>[\s\S]*?<\/[^>]+>/gi) || [];
  const langFallback = uniqueTweets(
    langHtmlBlocks
      .map(block => normalizeExtractedTweet(parser.parseFromString(block, 'text/html').body.textContent || ''))
      .filter(Boolean)
  );

  const strategies = [
    { label: 'tweetText', tweets: tweetTextNodes },
    { label: 'articleLang', tweets: articleLangNodes },
    { label: 'articleBlocks', tweets: articleBlocks },
    { label: 'tweetTextFallback', tweets: tweetTextFallback },
    { label: 'langFallback', tweets: langFallback },
  ];

  const bestStrategy = strategies.reduce((best, current) => {
    const bestScore = best.tweets.length * 10000 + best.tweets.join('').length;
    const currentScore = current.tweets.length * 10000 + current.tweets.join('').length;

    return currentScore > bestScore ? current : best;
  }, strategies[0]);

  if (bestStrategy.tweets.length > 0) {
    return bestStrategy.tweets.join('\n\n').trim();
  }

  return doc.body.textContent?.trim() || trimmedInput;
};