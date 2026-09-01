'use client';

export default function SpeechBubble({ text }: { text: string }) {
  return (
    <div className="speech">
      <p>{text}</p>
    </div>
  );
}
