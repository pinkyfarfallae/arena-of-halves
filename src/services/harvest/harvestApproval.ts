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

// Extract Twitter handle from URL or @mention
export const extractTwitterHandle = (input: string): string | null => {
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
export const parseScriptOutput = (input: string): { text: string; authors: string[]; tweetCount: number } | null => {
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