import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ChatPanel.scss';
import { useChatPanel } from '../../../../hooks/useChatPanel';
import { ChatMessage } from '../../../../types/chatMessage';
import type { Character } from '../../../../data/characters';
import Close from '../../../../icons/Close';
import ArrowRight from '../../../Lobby/icons/ArrowRight';

type Props = {
  title?: string;
  /** Convenience: use arenaId directly as the RTDB room key. */
  arenaId?: string;
  /** Pass roomId to use Firebase RTDB auto-sync (chat/<roomId>). */
  roomId?: string;
  /** Logged-in character — drives myName and message attribution. */
  user?: Character | null;
  /** Current user name override (falls back to user.characterId). */
  myName?: string;
  /** Controlled messages list (used when neither arenaId nor roomId is provided). */
  messages?: ChatMessage[];
  placeholder?: string;
  /** Whether the side panel is open (for slide-in animation). */
  isOpen?: boolean;
  /** Called on send when no room is configured. */
  onSend?: (text: string) => Promise<void> | void;
  /** Called when the close button is clicked. */
  onClose?: () => void;
  /** Mark the current user as a spectator — shows a notice above the composer. */
  isViewer?: boolean;
  className?: string;
};

export default function ChatPanel({
  title = 'Chat',
  arenaId,
  roomId,
  user,
  myName: myNameProp,
  messages: controlledMessages,
  placeholder = 'Type a message',
  isOpen = false,
  onSend,
  onClose,
  isViewer = false,
  className = '',
}: Props) {
  const effectiveRoomId = arenaId ?? roomId ?? '';
  const myName = myNameProp ?? user?.characterId ?? undefined;
  const { messages: rtdbMessages, sendMessage } = useChatPanel(effectiveRoomId, {
    authorName: myName,
    authorNickname: user?.nicknameEng ?? myName,
    authorImage: user?.image,
    authorPrimary: user?.theme?.[0],
  });

  const messages = effectiveRoomId ? rtdbMessages : (controlledMessages ?? []);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const hashToColor = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 360;
    }
    return `hsl(${hash} 52% 58%)`;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resolveSenderPrimary = (m: ChatMessage) => {
    if (m.authorPrimary) return m.authorPrimary;
    const seed = m.authorNickname ?? m.author ?? 'guest';
    return hashToColor(seed);
  };
  const isMe = (m: ChatMessage) => !!myName && m.author === myName;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 240);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 240 ? 'auto' : 'hidden';
  }, [draft]);

  useEffect(() => {
    if(!isOpen) return;
    // close when clicking outside the panel
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      setSending(true);
      if (effectiveRoomId) {
        await sendMessage(text);
      } else {
        await onSend?.(text);
      }
      setDraft('');
    } catch (err) {
      console.error('ChatPanel send failed', err);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      ref={panelRef}
      className={`chat-panel${isOpen ? ' chat-panel--open' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="chat-panel__header">
        <h3 className="chat-panel__title">{title}</h3>
        {effectiveRoomId && <span className="chat-panel__room-id"># {effectiveRoomId}</span>}
        {onClose && (
          <button className="chat-panel__close" onClick={onClose} aria-label="Close chat">
            <Close />
          </button>
        )}
      </div>

      <div className="chat-panel__body" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-panel__empty">No messages yet</div>
        ) : (
          messages.map((m: ChatMessage) => {
            const senderPrimary = resolveSenderPrimary(m);
            const senderName = m.authorNickname ?? m.author ?? 'Unknown';
            const senderImage = m.authorImage;
            const isSelf = isMe(m);
            return (
              <div
                key={m.id}
                className={`chat-panel__msg ${isSelf ? 'chat-panel__msg--me' : 'chat-panel__msg--other'}`}
                style={
                  {
                    '--chat-bubble-primary': senderPrimary,
                  } as React.CSSProperties
                }
              >
                <div className="chat-panel__msg-author">
                  {isSelf ? (
                    <>
                      <span className="chat-panel__msg-author-name">{senderName}</span>
                      <div className="chat-panel__msg-avatar">
                        {senderImage ? <img src={senderImage} alt="" referrerPolicy="no-referrer" /> : <span>{senderName.charAt(0).toUpperCase()}</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="chat-panel__msg-avatar">
                        {senderImage ? <img src={senderImage} alt="" referrerPolicy="no-referrer" /> : <span>{senderName.charAt(0).toUpperCase()}</span>}
                      </div>
                      <span className="chat-panel__msg-author-name">{senderName}</span>
                    </>
                  )}
                </div>
                <div className="chat-panel__msg-text">{m.text}</div>
                {m.ts && <div className="chat-panel__msg-time">{new Date(m.ts).toLocaleTimeString()}</div>}
              </div>
            );
          })
        )}
      </div>

      {isViewer && (
        <div className="chat-panel__spectator-notice">
          Chatting as spectator
        </div>
      )}

      <div className="chat-panel__composer">
        <textarea
          ref={inputRef}
          className="chat-panel__input"
          placeholder={placeholder}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="chat-panel__send"
          onClick={() => void handleSend()}
          disabled={sending || draft.trim() === ''}
        >
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
