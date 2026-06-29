import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import type { ChatMessageItem } from '../services/api.js';
import { WsEvent } from '@merchant-realms/shared';
import { getSocket } from '../services/socket.js';
import { useAuthStore } from '../stores/auth.js';
import { Button, Input, Modal, ModalBody } from '../components/ui/index.js';

const MAX_CHARS = 500;

export default function ChatPage() {
  const qc            = useQueryClient();
  const myEmpireId    = useAuthStore((s) => s.empireId);
  const myEmpireName  = useAuthStore((s) => s.empireName);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messageInput,   setMessageInput]   = useState('');
  const [dmSearchOpen,   setDmSearchOpen]   = useState(false);
  const [dmQuery,        setDmQuery]        = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Rooms ─────────────────────────────────────────────────────────────────
  const { data: roomsData } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  api.chatRooms,
  });
  const rooms        = roomsData?.rooms ?? [];
  const generalRooms = rooms.filter((r) => r.type === 'GENERAL');
  const dmRooms      = rooms.filter((r) => r.type === 'DM');

  // Auto-select first room
  useEffect(() => {
    if (!selectedRoomId && generalRooms.length > 0) {
      setSelectedRoomId(generalRooms[0]!.id);
    }
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Messages ──────────────────────────────────────────────────────────────
  const { data: messagesData } = useQuery({
    queryKey: ['chat-messages', selectedRoomId],
    queryFn:  () => api.chatMessages(selectedRoomId!),
    enabled:  !!selectedRoomId,
  });
  // Server returns newest-first; reverse to show oldest at top
  const messages = [...(messagesData?.messages ?? [])].reverse();

  // ── Player search ─────────────────────────────────────────────────────────
  const { data: searchData } = useQuery({
    queryKey: ['chat-search', dmQuery],
    queryFn:  () => api.chatSearch(dmQuery),
    enabled:  dmQuery.trim().length >= 2,
    staleTime: 5000,
  });
  const searchResults = searchData?.empires ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDm = useMutation({
    mutationFn: (empireId: number) => api.createDm(empireId),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setSelectedRoomId(data.room.id);
      setDmSearchOpen(false);
      setDmQuery('');
    },
  });

  const muteRoom = useMutation({
    mutationFn: ({ roomId, muted }: { roomId: number; muted: boolean }) =>
      api.muteRoom(roomId, muted),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chat-rooms'] }),
  });

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const handleMessage = (msg: ChatMessageItem) => {
      qc.setQueryData(
        ['chat-messages', msg.roomId],
        (old: { messages: ChatMessageItem[] } | undefined) => ({
          messages: old ? [msg, ...old.messages] : [msg],
        }),
      );
    };
    const handleNewDm = () => void qc.invalidateQueries({ queryKey: ['chat-rooms'] });

    socket.on(WsEvent.CHAT_MESSAGE, handleMessage);
    socket.on(WsEvent.CHAT_NEW_DM,  handleNewDm);
    return () => {
      socket.off(WsEvent.CHAT_MESSAGE, handleMessage);
      socket.off(WsEvent.CHAT_NEW_DM,  handleNewDm);
    };
  }, [qc]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Send ──────────────────────────────────────────────────────────────────
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text || !selectedRoomId) return;
    getSocket().emit(WsEvent.CHAT_SEND, { roomId: selectedRoomId, content: text });
    setMessageInput('');
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedRoom    = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const roomDisplayName = selectedRoom
    ? (selectedRoom.type === 'DM'
        ? (selectedRoom.partner?.name ?? '?')
        : (selectedRoom.name ?? 'Room'))
    : null;

  const charCount   = messageInput.length;
  const charWarning = charCount > 480 ? 'text-red-400' : charCount > 380 ? 'text-amber-400' : 'text-slate-600';

  // The Page wrapper contributes py-6 (24px top + 24px bottom = 48px) + navbar 48px = 96px total
  return (
    <div className="flex h-[calc(100vh-96px)] border border-slate-700/60 rounded-lg overflow-hidden">

      {/* ── Left sidebar ───────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-700/60 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700/60">
          <span className="text-slate-100 font-semibold text-sm">Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Rooms */}
          <div className="px-4 mt-1 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Rooms</span>
          </div>
          {generalRooms.map((room) => (
            <SidebarRow
              key={room.id}
              active={selectedRoomId === room.id}
              label={room.name ?? 'Room'}
              prefix="#"
              isMuted={room.isMuted}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}

          {/* DMs */}
          <div className="px-4 mt-4 mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Direct Messages</span>
            <button
              onClick={() => setDmSearchOpen(true)}
              className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-700 rounded text-sm font-bold leading-none transition-colors"
              title="New direct message"
            >+</button>
          </div>
          {dmRooms.map((room) => (
            <SidebarRow
              key={room.id}
              active={selectedRoomId === room.id}
              label={room.partner?.name ?? '?'}
              prefix="@"
              isMuted={room.isMuted}
              avatar={<EmpireAvatar name={room.partner?.name ?? null} />}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}
          {dmRooms.length === 0 && (
            <p className="px-4 py-1 text-xs text-slate-700 italic">None yet</p>
          )}
        </div>
      </div>

      {/* ── Right: chat window ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
            Select a room to start chatting
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-900 flex-shrink-0">
              <span className="font-semibold text-slate-100 text-sm">
                {selectedRoom.type === 'DM' ? `@ ${roomDisplayName}` : `# ${roomDisplayName}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => muteRoom.mutate({ roomId: selectedRoom.id, muted: !selectedRoom.isMuted })}
              >
                {selectedRoom.isMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <p className="text-slate-700 text-sm text-center py-12">No messages yet. Say hello!</p>
              )}
              {messages.map((msg, i) => {
                const prev      = messages[i - 1];
                const isMe      = msg.empireId === myEmpireId;
                const isGrouped = !!prev && prev.empireId === msg.empireId;
                const time      = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return isMe ? (
                  /* ── My message (right) ───────────────────── */
                  <div key={msg.id} className={`flex justify-end items-end gap-2 ${isGrouped ? 'mt-0.5' : 'mt-4'}`}>
                    <div className="max-w-[68%] flex flex-col items-end">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 mb-1 flex-row-reverse">
                          <span className="text-xs font-semibold text-azure-400">
                            {myEmpireName ?? 'You'}
                          </span>
                          <span className="text-[10px] text-slate-600">{time}</span>
                        </div>
                      )}
                      <div className="bg-azure-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed break-words">
                        {msg.content}
                      </div>
                    </div>
                    <div className="w-8 flex-shrink-0 flex items-end pb-0.5">
                      {!isGrouped && <EmpireAvatar name={myEmpireName} />}
                    </div>
                  </div>
                ) : (
                  /* ── Other's message (left) ───────────────── */
                  <div key={msg.id} className={`flex items-end gap-2 ${isGrouped ? 'mt-0.5' : 'mt-4'}`}>
                    <div className="w-8 flex-shrink-0 flex items-end pb-0.5">
                      {!isGrouped && <EmpireAvatar name={msg.empireName} />}
                    </div>
                    <div className="max-w-[68%] flex flex-col items-start">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-300">
                            {msg.empireName ?? 'Unknown'}
                          </span>
                          <span className="text-[10px] text-slate-600">{time}</span>
                        </div>
                      )}
                      <div className="bg-slate-800 text-slate-200 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm leading-relaxed break-words border border-slate-700/40">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-5 py-4 border-t border-slate-700/60 bg-slate-900 flex-shrink-0">
              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Submit on Enter (without Shift)
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                    }}
                    placeholder={
                      selectedRoom.type === 'DM'
                        ? `Message @${roomDisplayName}`
                        : `Message #${roomDisplayName}`
                    }
                    maxLength={MAX_CHARS}
                    className="pr-16 py-2.5"
                  />
                  {charCount > 350 && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums pointer-events-none ${charWarning}`}>
                      {charCount}/{MAX_CHARS}
                    </span>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!messageInput.trim()}
                  className="flex-shrink-0"
                >
                  Send
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* ── DM Search Modal ────────────────────────────────────── */}
      <Modal
        open={dmSearchOpen}
        onClose={() => { setDmSearchOpen(false); setDmQuery(''); }}
        title="New Direct Message"
        size="sm"
      >
        <ModalBody>
          <Input
            autoFocus
            value={dmQuery}
            onChange={(e) => setDmQuery(e.target.value)}
            placeholder="Search by empire name…"
          />
          <div className="mt-3 space-y-0.5 min-h-[60px]">
            {dmQuery.trim().length < 2 && (
              <p className="text-slate-600 text-xs py-2">Type at least 2 characters to search…</p>
            )}
            {dmQuery.trim().length >= 2 && searchResults.length === 0 && (
              <p className="text-slate-600 text-xs py-2">No empires found</p>
            )}
            {searchResults.map((empire) => (
              <button
                key={empire.id}
                onClick={() => createDm.mutate(empire.id)}
                disabled={createDm.isPending}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors disabled:opacity-50"
              >
                <EmpireAvatar name={empire.name} />
                <span>{empire.name}</span>
              </button>
            ))}
          </div>
        </ModalBody>
      </Modal>

    </div>
  );
}

// ── EmpireAvatar ──────────────────────────────────────────────────────────

function EmpireAvatar({ name }: { name: string | null }) {
  return (
    <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600/60 flex items-center justify-center text-xs font-bold text-slate-300 select-none flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── SidebarRow ────────────────────────────────────────────────────────────

function SidebarRow({
  active, label, prefix, isMuted, avatar, onClick,
}: {
  active: boolean;
  label: string;
  prefix: string;
  isMuted: boolean;
  avatar?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-slate-700/60 text-slate-100'
          : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
      }`}
    >
      {avatar
        ? avatar
        : <span className="text-slate-600 text-xs w-8 text-center flex-shrink-0">{prefix}</span>
      }
      <span className="flex-1 truncate text-left">{label}</span>
      {isMuted && <span className="text-[10px] text-slate-700 flex-shrink-0">muted</span>}
    </button>
  );
}
