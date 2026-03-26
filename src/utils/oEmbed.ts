export async function getTweetFromOEmbed(url: string) {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  const data = await res.json();

  return data.html;
}

