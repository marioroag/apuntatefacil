// Laboratorio visual de la aplicación. Solo existe en desarrollo.
import { useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { AppThemeBoundary } from '../components/app/AppThemeBoundary'
import { FieldRenderer, type FieldValue } from '../components/FieldRenderer'
import { STATUS_META, type CandidateStatus, type FormField } from '../lib/types'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { Switch } from '../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'

const SAMPLE_FIELDS: FormField[] = [
  { id: 'text', type: 'text', label: 'Nombre completo', placeholder: 'Ana García', required: true },
  { id: 'phone', type: 'phone', label: 'Teléfono', required: true },
  { id: 'select', type: 'select', label: 'Disponibilidad', options: ['Inmediata', 'En 15 días', 'En 1 mes'], required: true },
  { id: 'boolean', type: 'boolean', label: '¿Tienes carnet de conducir?', required: true },
]

const LAB_CANDIDATES = [
  { name: 'Lucía Marrero', initials: 'LM', status: 'nuevo' as CandidateStatus, time: 'hace 8 min', score: '5/5' },
  { name: 'Carlos Medina', initials: 'CM', status: 'contactado' as CandidateStatus, time: 'hace 2 h', score: '4/5' },
  { name: 'Eva Santana', initials: 'ES', status: 'entrevista' as CandidateStatus, time: 'ayer', score: '5/5' },
]

function StatusChip({ status }: { status: CandidateStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.chip}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  )
}

function LabSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-5 border-t border-border py-10 first:border-t-0 first:pt-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export function Playground() {
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <AppThemeBoundary className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-3.5 sm:px-8">
          <div className="grid size-9 place-items-center rounded-xl bg-foreground text-background shadow-card">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[-0.01em]">App UI Lab</p>
            <p className="text-xs text-muted-foreground">Apúntate Fácil · dirección premium funcional</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-card">Solo desarrollo</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
        <div className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sistema de aplicación</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Precisión sin fricción.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Una interfaz más silenciosa, táctil y editorial. El ultramarine guía la acción; los datos y el contenido llevan el peso visual.
          </p>
        </div>

        <LabSection
          eyebrow="01 · Acciones"
          title="Jerarquía contenida"
          description="Controles compactos, relieve mínimo y estados inequívocos. El color de marca solo aparece donde hay una decisión."
        >
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button><Plus /> Nuevo puesto</Button>
              <Button variant="outline">Compartir</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="destructive">Eliminar</Button>
              <Button size="icon" variant="outline" aria-label="Más opciones"><MoreHorizontal /></Button>
            </CardContent>
          </Card>
        </LabSection>

        <LabSection
          eyebrow="02 · Entrada"
          title="Formularios que respiran"
          description="Etiquetas nítidas, ayudas próximas al campo y foco accesible sin convertir cada input en una caja pesada."
        >
          <Card>
            <CardHeader>
              <CardTitle>Crear puesto</CardTitle>
              <CardDescription>La información básica que verá tu equipo.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="lab-title">Nombre del puesto</FieldLabel>
                  <Input id="lab-title" defaultValue="Camarero/a de sala" />
                  <FieldDescription>Usa el mismo título que en tu anuncio.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="lab-site">Sede</FieldLabel>
                  <Select defaultValue="las-palmas">
                    <SelectTrigger id="lab-site" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="las-palmas">Las Palmas</SelectItem>
                      <SelectItem value="telde">Telde</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="lab-description">Nota interna</FieldLabel>
                  <Textarea id="lab-description" placeholder="Añade contexto para el equipo…" />
                </Field>
                <Field orientation="horizontal" className="sm:col-span-2">
                  <Switch id="lab-auto" defaultChecked />
                  <FieldLabel htmlFor="lab-auto">Avisar al equipo cuando llegue una candidatura</FieldLabel>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </LabSection>

        <LabSection
          eyebrow="03 · Workspace"
          title="Datos como protagonista"
          description="La tabla gana estructura y aire sin perder densidad. Estado, identidad y tiempo se reconocen antes de leer."
        >
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>Camarero/a de sala</CardTitle>
                  <CardDescription>24 candidatos · 3 nuevos hoy</CardDescription>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <InputGroup className="w-full sm:w-64">
                    <InputGroupAddon><Search /></InputGroupAddon>
                    <InputGroupInput placeholder="Buscar candidatos…" />
                  </InputGroup>
                  <Button variant="outline" size="icon" aria-label="Filtrar"><Filter /></Button>
                </div>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/45 hover:bg-muted/45">
                  <TableHead className="w-10"><Checkbox aria-label="Seleccionar todos" /></TableHead>
                  <TableHead>Candidato</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Valoración</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LAB_CANDIDATES.map((candidate) => (
                  <TableRow key={candidate.name} className="group">
                    <TableCell><Checkbox aria-label={`Seleccionar ${candidate.name}`} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                          {candidate.initials}
                        </span>
                        <span className="font-medium">{candidate.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><StatusChip status={candidate.status} /></TableCell>
                    <TableCell className="hidden font-medium tabular-nums sm:table-cell">{candidate.score}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span className="inline-flex items-center gap-2">{candidate.time}<ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" /></span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </LabSection>

        <LabSection
          eyebrow="04 · Capas"
          title="Profundidad con propósito"
          description="Las acciones secundarias viven en capas accesibles. Las superficies flotantes usan una elevación única y contenida."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Alert className="rounded-xl bg-card p-4">
              <CircleAlert className="text-muted-foreground" />
              <AlertTitle>3 candidaturas por revisar</AlertTitle>
              <AlertDescription>Entraron desde tu última visita y todavía no tienen responsable.</AlertDescription>
            </Alert>
            <Card>
              <CardContent className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><BriefcaseBusiness className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Puesto listo para publicar</p>
                  <p className="text-xs text-muted-foreground">8 campos · enlace configurado</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Ver"><ArrowRight /></Button>
              </CardContent>
            </Card>
          </div>
          <Button className="mt-4" variant="outline" onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publicar formulario</DialogTitle>
                <DialogDescription>El enlace quedará activo y empezará a recibir candidaturas.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/45 p-3">
                <span className="grid size-9 place-items-center rounded-full bg-background"><Check className="size-4 text-primary" /></span>
                <div><p className="font-medium">Todo preparado</p><p className="text-xs text-muted-foreground">Puedes editarlo después sin cambiar el enlace.</p></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Ahora no</Button>
                <Button onClick={() => setDialogOpen(false)}>Publicar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </LabSection>

        <LabSection
          eyebrow="05 · Estados"
          title="Sistema completo"
          description="Carga, vacío y selección comparten la misma geometría. Nada salta cuando cambia el estado de la interfaz."
        >
          <Tabs defaultValue="ready">
            <TabsList>
              <TabsTrigger value="ready">Listo</TabsTrigger>
              <TabsTrigger value="loading">Cargando</TabsTrigger>
              <TabsTrigger value="empty">Vacío</TabsTrigger>
            </TabsList>
            <TabsContent value="ready" className="mt-4">
              <Card><CardContent className="flex items-center gap-3"><UserRound className="size-5 text-primary" /><span className="text-sm font-medium">24 candidatos disponibles</span><Badge className="ml-auto">Actualizado</Badge></CardContent></Card>
            </TabsContent>
            <TabsContent value="loading" className="mt-4">
              <Card><CardContent className="space-y-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
            </TabsContent>
            <TabsContent value="empty" className="mt-4">
              <Card><CardContent className="py-10 text-center"><p className="font-medium">Todavía no hay candidatos</p><p className="mt-1 text-sm text-muted-foreground">Comparte el enlace para empezar a recibirlos.</p><Button className="mt-4" variant="outline">Copiar enlace</Button></CardContent></Card>
            </TabsContent>
          </Tabs>
        </LabSection>

        <LabSection
          eyebrow="06 · WYSIWYG"
          title="El formulario real"
          description="El constructor y la experiencia pública siguen compartiendo FieldRenderer: el revamp no rompe esa única fuente de verdad."
        >
          <Card>
            <CardContent className="mx-auto max-w-xl">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><BriefcaseBusiness className="size-5" /></span>
                <div><p className="font-semibold">Camarero/a de sala</p><p className="text-sm text-muted-foreground">Completa tu candidatura</p></div>
              </div>
              <Separator className="mb-6" />
              <div className="space-y-5">
                {SAMPLE_FIELDS.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(value) => setValues((previous) => ({ ...previous, [field.id]: value }))}
                    idPrefix="lab"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </LabSection>
      </main>
    </AppThemeBoundary>
  )
}
