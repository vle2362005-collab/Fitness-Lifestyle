"use client";

import { useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { api } from "@/services/api";

type Message = { role: "me" | "bot"; text: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Xin chào! Mình có thể gợi ý bài tập, dinh dưỡng hoặc giải thích kết quả AI Coach." }
  ]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "me", text }]);
    setLoading(true);
    try {
      const res = await api.chat.ask(text);
      const answer = res.reply || res.answer || res.response || res.message || "Mình đã nhận được câu hỏi của bạn.";
      setMessages((prev) => [...prev, { role: "bot", text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Hiện chưa thể trả lời. Bạn thử lại sau nhé." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="between" style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
            <strong className="row"><Bot size={18} /> Fitness Assistant</strong>
            <button className="btn ghost" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
          <div className="chat-body">
            {messages.map((msg, index) => <div key={index} className={`chat-msg ${msg.role}`}>{msg.text}</div>)}
            {loading && <div className="chat-msg">Đang trả lời...</div>}
          </div>
          <div className="chat-input">
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Hỏi về luyện tập..." />
            <button className="btn" onClick={send}><Send size={16} /></button>
          </div>
        </div>
      )}
      {!open && <button className="btn" onClick={() => setOpen(true)}><Bot size={18} /> Chat</button>}
    </div>
  );
}
