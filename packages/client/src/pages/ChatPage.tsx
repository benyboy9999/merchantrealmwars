import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import type { ChatRoom, ChatMessageItem } from '../services/api.js';
import { WsEvent } from '@merchant-realms/shared';
import { getSocket } from '../services/socket.js';
import { useAuthStore } from '../stores/auth.js';

export default function ChatPage() {
  const qc = useQueryClient();
  const myEmpireId  = useAuthStore((s) => s.empireId);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messageInput, setMessageInput]     = useState('');
  const [dmSearchOpen, setDmSearchOpen]     = useState(false);
  const [dmQuery, setDmQuery]               = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Rooms ─────────────────────────────────────────────────────────────────
  const { data: roomsData } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  api.chatRooms,
  });
  const rooms        = roomsData?.rooms ?? [];
  const generalRooms = rooms.filter((r) => r.type === 'GENERAL');
  const dmRooms      = rooms.filter((r) => r.type === 'DM');

  // Auto-select first room on load
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

  // ── Player search for DMs ─────────────────────────────────────────────────
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

  // ── Real-time via socket ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const handleMessage = (msg: ChatMessageItem) => {
      // Prepend to cached array (which is newest-first from server)
      qc.setQueryData(
        ['chat-messages', msg.roomId],
        (old: ChatMessageItem[] | undefined) => (old ? [msg, ...old] : [msg]),
      );
    };

    const handleNewDm = () => {
      void qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    };

    socket.on(WsEvent.CHAT_MESSAGE, handleMessage);
    socket.on(WsEvent.CHAT_NEW_DM, handleNewDm);
    return () => {
      socket.off(WsEvent.CHAT_MESSAGE, handleMessage);
      socket.off(WsEvent.CHAT_NEW_DM, handleNewDm);
    };
  }, [qc]);

  // Auto-scroll to bottom when messages change
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

  // ── Derived display ───────────────────────────────────────────────────────
  const selectedRoom    = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const roomDisplayName = selectedRoom
    ? (selectedRoom.type === 'DM'
        ? (selectedRoom.partner?.name ?? '?')
        : (selectedRoom.name ?? 'Room'))
    : null;

  return (
    <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Left sidebar ───────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 border-r border-slate-700/60 bg-slate-900 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700/60">
          <h2 className="text-slate-100 font-semibold text-sm tracking-wide">Chat</h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">

          {/* Rooms */}
          <div className="px-3 mb-1 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Rooms</span>
          </div>
          {generalRooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              active={selectedRoomId === room.id}
              prefix="#"
              label={room.name ?? 'Room'}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}

          {/* DMs */}
          <div className="px-3 mt-4 mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Direct Messages</span>
            <button
              onClick={() => setDmSearchOpen(true)}
              className="w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 text-sm leading-none font-bold"
              title="New direct message"
            >+</button>
          </div>
          {dmRooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              active={selectedRoomId === room.id}
              prefix="@"
              label={room.partner?.name ?? '?'}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}
          {dmRooms.length === 0 && (
            <p className="px-4 py-1 text-xs text-slate-700">No direct messages yet</p>
          )}

        </div>
      </div>

      {/* ── Right: chat window ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
            Select a room to start chatting
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/60 bg-slate-900 flex-shrink-0">
              <span className="font-semibold text-slate-100 text-sm">
                {selectedRoom.type === 'DM' ? `@ ${roomDisplayName}` : `# ${roomDisplayName}`}
              </span>
              <button
                onClick={() => muteRoom.mutate({ roomId: selectedRoom.id, muted: !selectedRoom.isMuted })}
                className="text-xs text-slate-600 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                title={selectedRoom.isMuted ? 'Unmute this room' : 'Mute this room'}
              >
                {selectedRoom.isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.length === 0 && (
                <p className="text-slate-700 text-sm text-center py-8">No messages yet. Say hello!</p>
              )}
              {messages.map((msg, i) => {
                const prev       = messages[i - 1];
                const showHeader = !prev || prev.empireId !== msg.empireId;
                const isMe       = msg.empireId === myEmpireId;
                return (
                  <div key={msg.id} className={showHeader && i > 0 ? 'mt-4' : 'mt-0.5'}>
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-sm font-semibold ${isMe ? 'text-azure-400' : 'text-slate-200'}`}>
                          {msg.empireName ?? 'System'}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-slate-300 leading-relaxed break-words">{msg.content}</p>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-slate-700/60 bg-slate-900 flex-shrink-0">
              <form onSubmit={handleSend} className="flex gap-3">
                <input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    selectedRoom.type === 'DM'
                      ? `Message @${roomDisplayName}`
                      : `Message #${roomDisplayName}`
                  }
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="bg-azure-500 hover:bg-azure-400 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex-shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* ── DM search overlay ──────────────────────────────────────────── */}
      {dmSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center pt-24"
          onClick={(e) => { if (e.target === e.currentTarget) { setDmSearchOpen(false); setDmQuery(''); } }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-96">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-100 font-semibold text-sm">New Direct Message</span>
              <button
                onClick={() => { setDmSearchOpen(false); setDmQuery(''); }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >✕</button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={dmQuery}
                onChange={(e) => setDmQuery(e.target.value)}
                placeholder="Search by empire name…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
              />
              <div className="mt-2 min-h-[40px]">
                {dmQuery.trim().length < 2 && (
                  <p className="text-slate-600 text-xs px-1 py-2">Type at least 2 characters to search…</p>
                )}
                {dmQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-slate-600 text-xs px-1 py-2">No empires found</p>
                )}
                {searchResults.map((empire) => (
                  <button
                    key={empire.id}
                    onClick={() => createDm.mutate(empire.id)}
                    disabled={createDm.isPending}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors disabled:opacity-50"
                  >
                    {empire.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Room row ──────────────────────────────────────────────────────────────

function RoomRow({ room, active, prefix, label, onClick }: {
  room: ChatRoom;
  active: boolean;
  prefix: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-slate-700/60 text-slate-100'
          : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
      }`}
    >
      <span className="text-slate-600 text-xs">{prefix}</span>
      <span className="flex-1 truncate">{label}</span>
      {room.isMuted && <span className="text-[10px] text-slate-700">muted</span>}
    </button>
  );
}
