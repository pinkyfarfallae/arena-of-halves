/**
 * Twitter/X Thread Extractor Script
 * For admin use only - run in browser console on X thread page
 */

export const THREAD_EXTRACTOR_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  const clean = (text) =>
    (text || "")
      .replace(/\\u00a0/g, " ")
      .replace(/\\s+/g, " ")
      .trim();

  const getTweetId = (article) => {
    const links = [...article.querySelectorAll('a[href*="/status/"]')];
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/status\\/(\\d+)/);
      if (match) return match[1];
    }
    return null;
  };

  const getAuthor = (article) => {
    const spans = [...article.querySelectorAll('a[href^="/"][role="link"] span, a[href^="/"] span')];
    const handle = spans
      .map((el) => clean(el.textContent))
      .find((text) => /^@[A-Za-z0-9_]{1,15}$/.test(text));
    return handle || "";
  };

  const getTweetText = (article) => {
    const parts = [...article.querySelectorAll('[data-testid="tweetText"], div[lang]')]
      .map((el) => clean(el.innerText || el.textContent))
      .filter(Boolean);

    return uniq(parts).join("\\n").trim();
  };

  const getMentionHandles = (article, text) => {
    const fromText = [...text.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map((m) => \`@\${m[1]}\`);

    const fromLinks = [...article.querySelectorAll('a[href^="/"]')]
      .map((a) => a.getAttribute("href") || "")
      .map((href) => {
        const m = href.match(/^\\/([A-Za-z0-9_]{1,15})(?:\\/|$)/);
        return m ? \`@\${m[1]}\` : "";
      })
      .filter((handle) => {
        const blocked = new Set([
          "@home",
          "@explore",
          "@notifications",
          "@messages",
          "@compose",
          "@search",
          "@i",
          "@settings",
          "@jobs",
          "@premium",
        ]);
        return handle && !blocked.has(handle.toLowerCase());
      });

    return uniq([...fromText, ...fromLinks]);
  };

  const tweets = new Map();

  const scan = () => {
    const articles = [...document.querySelectorAll("article")];
    let missingId = 0;
    let missingText = 0;

    for (const article of articles) {
      const id = getTweetId(article);
      const author = getAuthor(article);
      const text = getTweetText(article);
      const mentions = getMentionHandles(article, text);

      if (!id) {
        if (text) missingId++;
        continue;
      }
      if (!text) {
        missingText++;
        continue;
      }

      const prev = tweets.get(id);
      const next = { id, author, text, mentions };

      if (!prev || next.text.length > prev.text.length) {
        tweets.set(id, next);
      }
    }

    return {
      count: tweets.size,
      articles: articles.length,
      missingId,
      missingText,
      height: document.body.scrollHeight,
    };
  };

  const scrollStep = async (direction = "down") => {
    const amount = Math.max(window.innerHeight * 0.85, 700);
    const nextY =
      direction === "down"
        ? Math.min(window.scrollY + amount, document.body.scrollHeight)
        : Math.max(window.scrollY - amount, 0);

    window.scrollTo({ top: nextY, behavior: "instant" });
    await sleep(2000);
    return scan();
  };

  let stableRounds = 0;
  let lastSignature = "";
  let lastHeight = 0;

  scan();

  for (let i = 0; i < 80; i++) {
    await scrollStep("down");
    const result = await scrollStep("down");

    const ids = [...tweets.keys()].sort().join(",");
    const signature = \`\${tweets.size}|\${ids}\`;
    const atBottom =
      Math.ceil(window.scrollY + window.innerHeight) >= document.body.scrollHeight - 5;
    const sameHeight = document.body.scrollHeight === lastHeight;

    console.log(\`[Pass \${i + 1}] tweets=\${tweets.size} articles=\${result.articles} missingId=\${result.missingId} missingText=\${result.missingText} stable=\${stableRounds} atBottom=\${atBottom}\`);

    if (signature === lastSignature && atBottom && sameHeight) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }

    lastSignature = signature;
    lastHeight = result.height;

    if (stableRounds >= 7) {
      console.log(\`✅ Stable for 7 rounds, stopping at \${tweets.size} tweets\`);
      break;
    }
  }

  for (let i = 0; i < 3; i++) await scrollStep("up");
  for (let i = 0; i < 6; i++) await scrollStep("down");

  // Final verification scans
  console.log("🔍 Final verification...");
  const beforeFinal = tweets.size;
  await sleep(1000);
  scan();
  await sleep(1000);
  scan();
  const afterFinal = tweets.size;
  
  if (afterFinal > beforeFinal) {
    console.log(\`⚠️  Found \${afterFinal - beforeFinal} more tweets in final scan!\`);
  }

  const ordered = [...tweets.values()];
  const combined = ordered
    .map((t, i) =>
      [
        \`--- TWEET \${i + 1} ---\`,
        \`Author: \${t.author || ""}\`,
        \`Mentions: \${t.mentions.join(", ")}\`,
        t.text,
      ].join("\\n")
    )
    .join("\\n\\n");

  console.log(\`✅ Extracted \${ordered.length} tweets\`);
  
  const finalScan = scan();
  if (finalScan.missingId > 0 || finalScan.missingText > 0) {
    console.warn(\`⚠️  \${finalScan.articles} articles visible, \${finalScan.missingId} missing IDs, \${finalScan.missingText} missing text\`);
    console.warn("💡 If count seems low, try: 1) Expand 'Show more' links, 2) Scroll manually, 3) Run script again");
  }
  
  // Store in global for easy access
  window.__harvestResult = combined;
})();` as const;


export const COPY_RESULT_SCRIPT = 'copy(window.__harvestResult)';