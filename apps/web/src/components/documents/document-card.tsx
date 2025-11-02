"use client";

import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

interface DocumentCardProps {
  document: any;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const statusConfig = {
    uploaded: {
      gradient: "from-blue-500 to-indigo-600",
      bg: "bg-blue-500/10",
      text: "text-blue-700",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    processing: {
      gradient: "from-amber-500 to-orange-600",
      bg: "bg-amber-500/10",
      text: "text-amber-700",
      icon: (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    ready: {
      gradient: "from-green-500 to-emerald-600",
      bg: "bg-green-500/10",
      text: "text-green-700",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    error: {
      gradient: "from-red-500 to-pink-600",
      bg: "bg-red-500/10",
      text: "text-red-700",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  };

  const status = statusConfig[document.status as keyof typeof statusConfig] || statusConfig.uploaded;

  return (
    <Link
      href={`/doc/${document.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative block"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative h-full rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1">
        {/* Document Preview Area */}
        <div className="relative h-32 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 mb-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
          
          {/* Document Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <div className={`flex items-center gap-1.5 rounded-full ${status.bg} px-2.5 py-1.5 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>
              <span className={status.text}>
                {status.icon}
              </span>
              <span className={`text-xs font-semibold ${status.text}`}>
                {document.status}
              </span>
            </div>
          </div>

          {/* Page Count */}
          {document.pages && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 border border-slate-200/50">
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-slate-600">
                  {document.pages} pages
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Document Details */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition-colors duration-200">
              {document.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500 line-clamp-1">
              {document.original_filename}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDate(document.created_at)}</span>
            </div>
            
            {/* Quick Actions (visible on hover) */}
            <div className={`flex items-center gap-1 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}>
              <button 
                onClick={(e) => e.preventDefault()}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button 
                onClick={(e) => e.preventDefault()}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Indicator for Processing Documents */}
        {document.status === 'processing' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 rounded-b-2xl overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
      </div>
    </Link>
  );
}

