import React, { useEffect, useRef, useState } from "react";
import "./TweetPreview.scss";

interface TweetMediaProps {
  url: string;
  className?: string;
  scale?: number;
}

declare global {
  interface Window {
    twttr?: any;
  }
}

const loadTwitterScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.twttr?.widgets) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
};

const extractTweetId = (url: string): string | null => {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
};

const TweetMedia: React.FC<TweetMediaProps> = ({ url, className, scale = 1 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const tweetId = extractTweetId(url);
    if (!tweetId || !containerRef.current) {
      setError(true);
      setLoading(false);
      return;
    }

    let isMounted = true;

    setLoading(true);
    setError(false);

    loadTwitterScript()
      .then(() => {
        if (!isMounted || !window.twttr) return;

        window.twttr.ready(() => {
          if (!isMounted || !containerRef.current) return;

          containerRef.current.innerHTML = "";

          window.twttr.widgets
            .createTweet(tweetId, containerRef.current, {
              align: "center",
              theme: "light",
              width: 550,
              dnt: true,
            })
            .then(() => {
              if (isMounted) setLoading(false);
            })
            .catch(() => {
              if (isMounted) {
                setError(true);
                setLoading(false);
              }
            });
        });
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <div className={`tweet-preview-container tweet-preview-container--${loading ? "loading" : error ? "error" : "loaded"} ${className || ""} `} style={{ position: "relative" }}>
      
      {loading && <>Loading tweet...</>}
      {error && <>Failed to load tweet.</>}

      <div
        ref={containerRef}
        className="tweet-preview-embed"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          opacity: loading ? 0 : 1,
        }}
      />
    </div>
  );
};

export default TweetMedia;