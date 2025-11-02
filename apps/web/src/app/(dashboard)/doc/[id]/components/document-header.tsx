"use client";

interface DocumentHeaderProps {
  title: string;
}

export function DocumentHeader({ title }: DocumentHeaderProps) {
  return (
    <div className=" flex-shrink-0 border-b px-6 py-2">
      <h1 className="text-base font-medium">{title}</h1>
    </div>
  );
}