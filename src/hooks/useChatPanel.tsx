import { useEffect, useRef, useState } from 'react';
import { ref, onChildAdded, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { ChatMessage } from '../types/chatMessage';

/**
 * Subscribes to a RTDB chat room at `chat/<roomId>`.
 * Returns messages and a `sendMessage` helper.
 */
type SenderMeta = {
  authorName?: string;
  authorNickname?: string;
  authorImage?: string;
  authorPrimary?: string;
};

export function useChatPanel(roomId: string, sender?: SenderMeta) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Clean up previous listener
    unsubRef.current?.();
    setMessages([]);

    const chatRef = ref(db, `chat/${roomId}`);

    const unsub = onChildAdded(chatRef, (snap) => {
      const val = snap.val();
      if (!val) return;
      setMessages((prev) => [
        ...prev,
        {
          id: snap.key ?? String(Date.now()),
          author: val.author ?? undefined,
          authorNickname: val.authorNickname ?? undefined,
          authorImage: val.authorImage ?? undefined,
          authorPrimary: val.authorPrimary ?? undefined,
          text: val.text,
          ts: val.ts,
        },
      ]);
    });

    unsubRef.current = () => unsub();

    return () => {
      unsubRef.current?.();
    };
  }, [roomId]);

  const sendMessage = async (text: string) => {
    if (!roomId || !text.trim()) return;
    await push(ref(db, `chat/${roomId}`), {
      text: text.trim(),
      author: sender?.authorName ?? 'anonymous',
      authorNickname: sender?.authorNickname ?? sender?.authorName ?? 'anonymous',
      authorImage: sender?.authorImage ?? null,
      authorPrimary: sender?.authorPrimary ?? null,
      ts: serverTimestamp(),
    });
  };

  return { messages, sendMessage };
}
