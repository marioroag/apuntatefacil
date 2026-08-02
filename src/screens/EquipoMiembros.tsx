import { useCallback, useEffect, useState } from 'react'
import { Building2, Copy, Loader2, Mail, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { planHas } from '../lib/pricing'
import { personLabel, relativeDate } from '../lib/format'
import { useProfiles } from '../lib/profiles'
import { Avatar } from '../components/ui/Avatar'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { SEED_INVITES, SEED_MEMBERS, freshenDemoIso } from '../lib/seed'

type Member = { user_id: string; email: string; role: string; is_self: boolean; site_ids: string[] }
type Invitation = { id: string; email: string; token: string; created_at: string; role: string }

const ROLE_LABEL: Record<string, string> = { owner: 'Propietario', member: 'Miembro', encargado: 'Encargado' }

// Gestión de miembros (pestaña "Miembros" de Equipo, Pro+, solo owner): miembros
// actuales + invitar por email. En Multi se puede invitar como ENCARGADO
// acotado a sedes. Usuarios ilimitados (sin coste por asiento).
// En demo: datos de ejemplo en memoria (sin Supabase).
export function EquipoMiembros() {
  const toast = useToast()
  const { sites } = useStore()
  const { company } = useAuth()
  const demo = company?.id === 'demo'
  const canManagers = planHas(company?.plan, 'managers') && sites.length > 0
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? 'sede'

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'encargado'>('member')
  const [siteSel, setSiteSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null) // miembro pendiente de confirmar borrado
  const [removeBusy, setRemoveBusy] = useState(false)

  const load = useCallback(async () => {
    if (!company) return
    if (company.id === 'demo') {
      setMembers(SEED_MEMBERS.map((m) => ({ ...m, site_ids: [...m.site_ids] })))
      setInvites(SEED_INVITES.map((i) => ({ ...i, created_at: freshenDemoIso(i.created_at) })))
      setLoading(false)
      return
    }
    const [m, i] = await Promise.all([
      supabase.rpc('list_company_members', { p_company_id: company.id }),
      supabase.from('invitations').select('id,email,token,created_at,role').eq('status', 'pending').eq('company_id', company.id).order('created_at', { ascending: false }),
    ])
    if (!m.error && m.data) setMembers(m.data as Member[])
    if (!i.error && i.data) setInvites(i.data as Invitation[])
    setLoading(false)
  }, [company])
  useEffect(() => {
    load()
  }, [load])

  const isOwner = members.some((mm) => mm.is_self && mm.role === 'owner')
  const inviteLink = (token: string) => `${window.location.origin}/invitacion?token=${token}`

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (demo) {
      toast.show('En la demo solo puedes ver cómo se invita. Crea tu cuenta para usarlo.')
      return
    }
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@') || mail.length < 3) {
      toast.error('Escribe un email válido.')
      return
    }
    const effectiveRole = canManagers ? role : 'member'
    if (effectiveRole === 'encargado' && siteSel.size === 0) {
      toast.error('Elige al menos una sede para el encargado.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('create_invitation', {
      p_email: mail,
      p_role: effectiveRole,
      p_site_ids: effectiveRole === 'encargado' ? [...siteSel] : [],
    })
    if (error) {
      setBusy(false)
      toast.error(error.message || 'No se pudo crear la invitación.')
      return
    }
    const id = (data as { id?: string })?.id
    if (id) supabase.functions.invoke('send-invitation', { body: { invitation_id: id } }).catch(() => {})
    setEmail('')
    setRole('member')
    setSiteSel(new Set())
    await load()
    setBusy(false)
    toast.success('Invitación creada')
  }

  const copy = async (token: string) => {
    if (demo) {
      toast.show('En la demo el enlace de invitación es de ejemplo.')
      return
    }
    try {
      await navigator.clipboard.writeText(inviteLink(token))
      toast.success('Enlace copiado')
    } catch {
      toast.show('Copia el enlace manualmente: ' + inviteLink(token))
    }
  }

  const revoke = async (id: string) => {
    if (demo) {
      toast.show('En la demo no se pueden revocar invitaciones.')
      return
    }
    const prev = invites
    setInvites((v) => v.filter((x) => x.id !== id))
    const { error } = await supabase.rpc('revoke_invitation', { p_id: id })
    if (error) {
      setInvites(prev)
      toast.error('No se pudo revocar la invitación.')
    }
  }

  const saveAccess = async (userId: string, newRole: 'member' | 'encargado', siteIds: string[]) => {
    if (demo) {
      toast.show('En la demo no se puede cambiar el acceso.')
      return
    }
    if (newRole === 'encargado' && siteIds.length === 0) {
      toast.error('Elige al menos una sede.')
      return
    }
    const { error } = await supabase.rpc('set_member_access', { p_user_id: userId, p_role: newRole, p_site_ids: siteIds })
    if (error) {
      toast.error(error.message || 'No se pudo guardar.')
      return
    }
    setEditing(null)
    await load()
    toast.success('Acceso actualizado')
  }

  const removeMember = async () => {
    if (!removing || !company) return
    if (demo) {
      toast.show('En la demo no se puede eliminar miembros.')
      setRemoving(null)
      return
    }
    setRemoveBusy(true)
    const { error } = await supabase.rpc('remove_member', { p_company_id: company.id, p_user_id: removing.user_id })
    setRemoveBusy(false)
    if (error) {
      toast.error(error.message || 'No se pudo eliminar al miembro.')
      return
    }
    setMembers((ms) => ms.filter((m) => m.user_id !== removing.user_id))
    setRemoving(null)
    toast.success('Miembro eliminado del equipo')
  }

  return (
    <>
      {isOwner && (
        <form
          onSubmit={invite}
          className={`rounded-xl border border-slate-200 bg-white p-4 shadow-card ${demo ? 'opacity-[0.92]' : ''}`}
        >
          <p className="text-sm font-semibold text-slate-800">Invitar por email</p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={demo ? '' : email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="compañero@empresa.com"
              disabled={demo}
              readOnly={demo}
              className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
            <button
              type="submit"
              disabled={demo || busy}
              className={`${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
              Invitar
            </button>
          </div>

          {canManagers && (
            <div className={`mt-3 ${demo ? 'pointer-events-none opacity-70' : ''}`}>
              <div className="flex gap-1.5">
                <RolePill active={role === 'member'} onClick={() => setRole('member')} label="Miembro" hint="ve todo" />
                <RolePill active={role === 'encargado'} onClick={() => setRole('encargado')} label="Encargado" hint="solo sus sedes" />
              </div>
              {role === 'encargado' && (
                <SedePicker sites={sites} selected={siteSel} onToggle={(id) => setSiteSel((s) => toggle(s, id))} />
              )}
            </div>
          )}
          <p className="mt-2 text-[12px] text-slate-500">
            {demo
              ? 'Así se invita a tu equipo en una cuenta real. En la demo solo se muestra el apartado.'
              : 'Le llega un email con un enlace para unirse. También puedes copiar el enlace y enviárselo tú.'}
          </p>
        </form>
      )}

      {loading ? (
        <div className="mt-6 grid place-items-center py-10" role="status" aria-label="Cargando">
          <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
        </div>
      ) : (
        <>
          {invites.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invitaciones pendientes</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{inv.email}</p>
                      <p className="text-[12px] text-slate-500">
                        {ROLE_LABEL[inv.role] ?? 'Miembro'}, invitado {relativeDate(inv.created_at)}, pendiente
                      </p>
                    </div>
                    <button onClick={() => copy(inv.token)} className={BTN_SECONDARY}>
                      <Copy className="size-3.5" aria-hidden /> Enlace
                    </button>
                    {isOwner && !demo && (
                      <button onClick={() => revoke(inv.id)} aria-label={`Revocar invitación de ${inv.email}`} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
            </h2>
            <div className="space-y-2">
              {members.map((m) =>
                editing === m.user_id ? (
                  <MemberEditor
                    key={m.user_id}
                    member={m}
                    sites={sites}
                    onCancel={() => setEditing(null)}
                    onSave={(r, ids) => saveAccess(m.user_id, r, ids)}
                  />
                ) : (
                  <MemberRow
                    key={m.user_id}
                    member={m}
                    siteName={siteName}
                    isOwner={isOwner}
                    canManagers={canManagers}
                    readOnly={demo}
                    onEdit={() => setEditing(m.user_id)}
                    onRemove={() => setRemoving(m)}
                  />
                ),
              )}
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        title="Eliminar del equipo"
        confirmLabel="Eliminar"
        confirmVariant="danger"
        loading={removeBusy}
      >
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar a{' '}
          <strong className="font-semibold text-slate-800">{removing?.email}</strong> del equipo?
          Perderá el acceso a los candidatos de esta empresa. Puedes volver a invitarle cuando quieras.
        </p>
      </ConfirmDialog>
    </>
  )
}

function toggle(set: Set<string>, id: string): Set<string> {
  const n = new Set(set)
  n.has(id) ? n.delete(id) : n.add(id)
  return n
}

function MemberRow({
  member,
  siteName,
  isOwner,
  canManagers,
  readOnly = false,
  onEdit,
  onRemove,
}: {
  member: Member
  siteName: (id: string) => string
  isOwner: boolean
  canManagers: boolean
  readOnly?: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const profiles = useProfiles()
  const nombre = profiles.nameFor(member.user_id, member.email)
  // Con perfil, manda el nombre y el email baja a segunda línea (sigue haciendo
  // falta: es con lo que se invita y con lo que se menciona). Sin perfil, el
  // email es lo único que hay y ocupa la primera línea, como siempre.
  const tieneNombre = nombre.toLowerCase() !== personLabel(member.email).toLowerCase()
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <Avatar name={nombre} seed={member.email} src={profiles.avatarFor(member.user_id)} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {tieneNombre ? nombre : member.email}{' '}
          {member.is_self && <span className="text-[12px] font-normal text-slate-500">(tú)</span>}
        </p>
        {tieneNombre && <p className="truncate text-[12px] text-slate-500">{member.email}</p>}
        {member.role === 'encargado' && member.site_ids.length > 0 && (
          <p className="truncate text-[12px] text-slate-500">{member.site_ids.map(siteName).join(', ')}</p>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600">
        {ROLE_LABEL[member.role] ?? member.role}
      </span>
      {!readOnly && isOwner && !member.is_self && member.role !== 'owner' && canManagers && (
        <button
          onClick={onEdit}
          aria-label={`Editar acceso de ${member.email}`}
          className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      )}
      {!readOnly && isOwner && !member.is_self && member.role !== 'owner' && (
        <button
          onClick={onRemove}
          aria-label={`Eliminar a ${member.email} del equipo`}
          className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

function RolePill({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${active ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200' : 'border-slate-200 hover:bg-slate-50'}`}
    >
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      <span className="block text-[12px] text-slate-500">{hint}</span>
    </button>
  )
}

function SedePicker({ sites, selected, onToggle }: { sites: { id: string; name: string }[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="mt-2 rounded-xl border border-slate-200 p-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
        <Building2 className="size-3.5 text-slate-500" aria-hidden /> Sedes que gestiona
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sites.map((s) => {
          const on = selected.has(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MemberEditor({
  member,
  sites,
  onCancel,
  onSave,
}: {
  member: Member
  sites: { id: string; name: string }[]
  onCancel: () => void
  onSave: (role: 'member' | 'encargado', siteIds: string[]) => void
}) {
  const [role, setRole] = useState<'member' | 'encargado'>(member.role === 'encargado' ? 'encargado' : 'member')
  const [sel, setSel] = useState<Set<string>>(new Set(member.site_ids))
  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-card">
      <p className="truncate text-sm font-medium text-slate-900">{member.email}</p>
      <div className="mt-2 flex gap-1.5">
        <RolePill active={role === 'member'} onClick={() => setRole('member')} label="Miembro" hint="ve todo" />
        <RolePill active={role === 'encargado'} onClick={() => setRole('encargado')} label="Encargado" hint="solo sus sedes" />
      </div>
      {role === 'encargado' && <SedePicker sites={sites} selected={sel} onToggle={(id) => setSel((s) => toggle(s, id))} />}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className={BTN_SECONDARY}>
          <X className="size-4" aria-hidden />
        </button>
        <button onClick={() => onSave(role, [...sel])} className={BTN_PRIMARY}>
          Guardar
        </button>
      </div>
    </div>
  )
}
