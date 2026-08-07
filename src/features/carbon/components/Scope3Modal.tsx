'use client'

import { X, Download } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { buildCertificateText, downloadText, type CertificateInput } from '@/features/carbon/certificate'

interface Scope3ModalProps {
  voyageId: string
  input: CertificateInput
  onClose: () => void
}

export function Scope3Modal({ voyageId, input, onClose }: Scope3ModalProps) {
  const { t, lang } = useLanguage()
  const certText = buildCertificateText(lang, input)

  function handleDownload() {
    downloadText(`scope3-certificate-${voyageId}.txt`, certText)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold">{t.carbon.scope3ModalTitle}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.scope3ModalSub}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <pre className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-800/60">
            {certText}
          </pre>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.scope3Disclaimer}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t.carbon.scope3Close}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4f46e5]"
          >
            <Download className="h-3.5 w-3.5" />
            {t.carbon.scope3Download}
          </button>
        </div>
      </div>
    </div>
  )
}
