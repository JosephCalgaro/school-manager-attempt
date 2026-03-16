/**
 * TempAdminBanner — banner âmbar fixo quando o SaaS Owner está
 * operando dentro de uma escola como admin temporário.
 *
 * O token temporário tem validade de 2h e expira sozinho.
 * Ao clicar "Sair da escola", apenas limpa o localStorage e
 * volta para /signin (sem precisar chamar o backend).
 */

import { useEffect, useState } from 'react'
import { LuShieldAlert, LuLogOut, LuClock } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

function formatRemaining(expiresIso: string): string {
  const diff = new Date(expiresIso).getTime() - Date.now()
  if (diff <= 0) return 'expirado'
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m < 10 ? '0' : ''}${m}min`
  return `${m}min restantes`
}

export default function TempAdminBanner() {
  const { user, logout } = useAuth()
  const [remaining, setRemaining] = useState('')

  const expiresAt = user?.temp_expires_at

  useEffect(() => {
    if (!expiresAt) return
    setRemaining(formatRemaining(expiresAt))
    const interval = setInterval(() => {
      const r = formatRemaining(expiresAt)
      setRemaining(r)
      if (r === 'expirado') { clearInterval(interval); logout() }
    }, 30_000)
    return () => clearInterval(interval)
  }, [expiresAt, logout])

  if (!user?.is_temp) return null

  return (
    <div className="sticky top-0 z-[99999] flex items-center justify-between gap-3 bg-amber-500 px-4 py-2.5 text-white shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LuShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Acesso via <strong>SaaS Owner</strong>
          {user.school_name ? ` — ${user.school_name}` : ''}.
          Você tem permissões de administrador nesta escola.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {expiresAt && remaining && (
          <span className="flex items-center gap-1 text-xs bg-amber-600/50 rounded-full px-2.5 py-1">
            <LuClock className="h-3.5 w-3.5" />
            {remaining}
          </span>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <LuLogOut className="h-3.5 w-3.5" />
          Sair da escola
        </button>
      </div>
    </div>
  )
}
