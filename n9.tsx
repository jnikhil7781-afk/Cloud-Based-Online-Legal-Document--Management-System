import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Cloud, FileText, Scale, Clock3, CheckCircle2, AlertTriangle, Upload, Search, MoreHorizontal, PenLine, Eye, Download, Trash2, Building2, Users, Gavel, FileSearch, History, Lock, Sparkles, ArrowUpRight, Filter, X, Calendar, Briefcase, Shield, Zap, ChevronRight, Layers, FileSignature } from 'lucide-react'

type Direction = 'client' | 'counsel'
type DocStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Rejected' | 'Signed' | 'Expired'
type Matter = { id:number; title:string; client_name:string; client_email:string; type:string; status:string; priority:string; due_date:string; description:string; created_at:string }
type Doc = { id:number; title:string; category:string; matter_id:number|null; file_name:string; file_url:string; file_size:string; status:DocStatus; version:number; expiry_date:string|null; owner_name:string; owner_email:string; is_signed:boolean; cloud_path:string; created_at:string; updated_at:string; matters?:{title:string} }
type Activity = { id:number; document_id:number; action:string; actor:string; role:string; details:string; created_at:string }
type Annotation = { id:number; document_id:number; author:string; role:string; comment:string; created_at:string }

const categories = ['All','Contract','NDA','Lease Agreement','Affidavit','Power of Attorney','Will & Testament','Compliance','Litigation Brief']
const statuses: DocStatus[] = ['Draft','Pending Review','Approved','Signed','Expired']

function formatDate(d:string|null) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }
function daysUntilExpiry(d:string|null) {
  if(!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now())/86400000);
  return diff
}
function statusColor(s:DocStatus) {
  switch(s){
    case 'Approved': return 'bg-emerald-500 text-white'
    case 'Signed': return 'bg-[#0F2A44] text-white'
    case 'Pending Review': return 'bg-amber-400 text-[#0F2A44]'
    case 'Draft': return 'bg-slate-200 text-slate-700'
    case 'Rejected': return 'bg-red-500 text-white'
    case 'Expired': return 'bg-red-50 text-red-600 border border-red-200'
    default: return 'bg-slate-100'
  }
}

export default function App(){
  const [direction, setDirection] = useState<Direction>('client')
  const [documents, setDocuments] = useState<Doc[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedDoc, setSelectedDoc] = useState<Doc|null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [newDoc, setNewDoc] = useState({ title:'', category:'Contract', matter_id:'', expiry_date:'', file:null as File|null })
  const [annotationText, setAnnotationText] = useState('')
  const [showMatterModal, setShowMatterModal] = useState(false)
  const [newMatter, setNewMatter] = useState({ title:'', client_name:'', client_email:'', type:'Corporate', status:'Open', priority:'Medium', due_date:'', description:'' })

  const fetchAll = async() => {
    setLoading(true)
    try{
      const [dRes,mRes,aRes] = await Promise.all([
        fetch('/api/documents').then(r=>r.json()),
        fetch('/api/matters').then(r=>r.json()),
        fetch('/api/activities').then(r=>r.json())
      ])
      if(Array.isArray(dRes)) setDocuments(dRes)
      if(Array.isArray(mRes)) setMatters(mRes)
      if(Array.isArray(aRes)) setActivities(aRes)
    } catch(e){console.error(e)}
    finally{setLoading(false)}
  }
  useEffect(()=>{fetchAll()},[])

  useEffect(()=>{
    if(selectedDoc){
      fetch(`/api/annotations?document_id=${selectedDoc.id}`).then(r=>r.json()).then(d=>{if(Array.isArray(d)) setAnnotations(d)})
      fetch(`/api/activities?document_id=${selectedDoc.id}`).then(r=>r.json()).then(d=>{if(Array.isArray(d)) setActivities(prev=>{
        // merge: keep global but update with doc-specific if needed
        const other = prev.filter(a=>a.document_id!==selectedDoc.id)
        return [...d, ...other].sort((a,b)=> new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
      })})
    }
  },[selectedDoc])

  const filteredDocs = documents.filter(d=>{
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.category.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter==='All' || d.category===catFilter
    const matchStatus = statusFilter==='All' || d.status===statusFilter
    return matchSearch && matchCat && matchStatus
  })

  const expiringSoon = documents.filter(d=>{
    const days = daysUntilExpiry(d.expiry_date)
    return days!==null && days>=0 && days<=30
  }).length
  const pendingCount = documents.filter(d=>d.status==='Pending Review').length
  const signedCount = documents.filter(d=>d.is_signed).length

  const handleUpload = async(e:React.FormEvent) => {
    e.preventDefault()
    if(!newDoc.title || !newDoc.file) return alert('Title and file required')
    setUploading(true)
    try{
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve,reject)=>{
        reader.onload=()=> resolve((reader.result as string).split(',')[1])
        reader.onerror=reject
        reader.readAsDataURL(newDoc.file as File)
      })
      const upRes = await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:newDoc.file.name,fileBase64:base64,contentType:newDoc.file.type})})
      const upData = await upRes.json()
      if(!upRes.ok) throw new Error(upData.error)
      const payload = {
        title: newDoc.title,
        category: newDoc.category,
        matter_id: newDoc.matter_id? Number(newDoc.matter_id): null,
        file_name: newDoc.file.name,
        file_url: upData.url,
        file_size: `${(newDoc.file.size/1024).toFixed(1)} KB`,
        status: 'Pending Review' as DocStatus,
        version: 1,
        expiry_date: newDoc.expiry_date ? new Date(newDoc.expiry_date).toISOString() : null,
        owner_name: direction==='client' ? 'Alex Morgan (Client)' : 'Sarah Chen, Esq.',
        owner_email: direction==='client' ? 'alex.morgan@email.com' : 'sarah.chen@firm.com',
        is_signed: false,
        cloud_path: upData.path,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const res = await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      if(!res.ok) throw new Error('Create failed')
      setShowUpload(false)
      setNewDoc({ title:'', category:'Contract', matter_id:'', expiry_date:'', file:null })
      if(fileRef.current) fileRef.current.value=''
      fetchAll()
    } catch(err:any){alert(err.message)}
    finally{setUploading(false)}
  }

  const updateDoc = async(id:number, updates:any) => {
    const res = await fetch('/api/documents',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...updates})})
    if(res.ok){ fetchAll(); if(selectedDoc && selectedDoc.id===id){ const updated = await res.json(); setSelectedDoc(updated) } }
  }

  const signDocument = async(doc:Doc) => {
    if(doc.is_signed) return
    await updateDoc(doc.id,{ is_signed:true, status:'Signed', actor: 'Alex Morgan (Client)', actor_role:'Client', activity_details:`E-signed via cloud vault - ${doc.title}` })
  }

  const approveDoc = async(doc:Doc)=> updateDoc(doc.id,{ status:'Approved', actor:'Sarah Chen, Esq.', actor_role:'Counsel', activity_details:`Approved by counsel - ${doc.title}` })
  const rejectDoc = async(doc:Doc)=> updateDoc(doc.id,{ status:'Rejected', actor:'Sarah Chen, Esq.', actor_role:'Counsel', activity_details:`Rejected - requires revision - ${doc.title}` })
  const requestRevision = async(doc:Doc)=> updateDoc(doc.id,{ status:'Draft', actor:'Sarah Chen, Esq.', actor_role:'Counsel', activity_details:`Sent back for revision - ${doc.title}` })

  const addAnnotation = async() => {
    if(!selectedDoc || !annotationText.trim()) return
    const res = await fetch('/api/annotations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document_id:selectedDoc.id, author: direction==='counsel'?'Sarah Chen, Esq.':'Alex Morgan', role: direction==='counsel'?'Counsel':'Client', comment: annotationText})})
    if(res.ok){ setAnnotationText(''); const data = await res.json(); setAnnotations(prev=>[...prev,data]); fetchAll() }
  }

  const deleteDoc = async(id:number)=>{
    if(!confirm('Delete this document?')) return
    await fetch('/api/documents',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
    setSelectedDoc(null)
    fetchAll()
  }

  const createMatter = async(e:React.FormEvent)=>{
    e.preventDefault()
    const res = await fetch('/api/matters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...newMatter, due_date: newMatter.due_date? new Date(newMatter.due_date).toISOString(): null, created_at: new Date().toISOString()})})
    if(res.ok){ setShowMatterModal(false); setNewMatter({ title:'', client_name:'', client_email:'', type:'Corporate', status:'Open', priority:'Medium', due_date:'', description:'' }); fetchAll() }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F2A44] selection:bg-[#C9A86A]/30">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0,600;9..144,0,700;9..144,1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');`}</style>
      {/* Top Cloud Bar */}
      <div className="bg-[#0F2A44] text-white text-[11px] tracking-[0.14em] font-medium">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />CLOUD VAULT • AES-256 • SOC 2 CERTIFIED</span>
            <span className="hidden md:inline-flex items-center gap-2 opacity-70"><Cloud size={12}/> Region: us-east-1 • Encrypted at rest & in transit</span>
          </div>
          <span className="hidden lg:inline opacity-60">CLOUD-BASED • 99.99% UPTIME • VERSIONED • AUDIT-TRAILED</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F2A44] flex items-center justify-center text-white">
                <Scale size={20} />
              </div>
              <div>
                <h1 className="font-[Fraunces] text-[22px] leading-none font-bold tracking-tight">LEXCLOUD</h1>
                <p className="text-[10px] tracking-[0.16em] font-semibold text-slate-500">LEGAL DOCUMENT CLOUD</p>
              </div>
              <span className="hidden sm:inline-flex ml-3 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold tracking-[0.12em] border border-amber-200">CLOUD VAULT v2.4</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100"><Users size={14}/> 1,240 Active Clients</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100"><Building2 size={14}/> 48 Law Firms</span>
              <span className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><ShieldCheck size={14}/> Zero-trust access</span>
            </div>
            <button onClick={()=>setMobileMenu(!mobileMenu)} className="md:hidden p-2 rounded-xl border border-slate-200"><MoreHorizontal size={18}/></button>
          </div>

          {/* Direction Toggle */}
          <div className="mt-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.16em] font-bold text-[#C9A86A] mb-2">CHOOSE YOUR DIRECTION • 2 MODES</p>
                <div className="inline-flex p-1.5 bg-[#0F2A44] rounded-2xl shadow-lg shadow-[#0F2A44]/20">
                  <button onClick={()=>setDirection('client')} className={`px-5 sm:px-7 py-3 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-2 ${direction==='client' ? 'bg-white text-[#0F2A44] shadow' : 'text-white/80 hover:text-white'}`}>
                    <FileSignature size={18}/> CLIENT PORTAL
                    {direction==='client' && <span className="hidden sm:inline ml-1 px-2 py-0.5 rounded-full bg-[#C9A86A] text-white text-[10px]">VAULT</span>}
                  </button>
                  <button onClick={()=>setDirection('counsel')} className={`px-5 sm:px-7 py-3 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-2 ${direction==='counsel' ? 'bg-white text-[#0F2A44] shadow' : 'text-white/80 hover:text-white'}`}>
                    <Gavel size={18}/> COUNSEL CONSOLE
                    {direction==='counsel' && <span className="hidden sm:inline ml-1 px-2 py-0.5 rounded-full bg-[#0F2A44] text-white text-[10px] border">REVIEW</span>}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-[#C9A86A] text-white flex items-center justify-center font-bold text-xs">AM</div>
                  <div className="leading-tight">
                    <p className="text-sm font-bold">Alex Morgan</p>
                    <p className="text-[11px] text-slate-500">{direction==='client' ? 'Client • Premium Vault' : 'Viewing as Client'}</p>
                  </div>
                  <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/>
                </div>
                <button onClick={()=>setShowUpload(true)} className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#C9A86A] hover:bg-[#b8975d] text-white font-bold text-sm shadow-lg shadow-[#C9A86A]/30 transition">
                  <Upload size={16}/> Upload Document
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs sm:text-[13px] text-slate-500 max-w-3xl">
              {direction==='client' 
                ? 'Your secure cloud vault — upload, organize, e-sign & track every legal document. Real-time expiry alerts, version history & audit-grade access logs.'
                : 'Attorney workspace — review queues, annotate, approve/reject, manage matters & maintain a cloud audit trail for every client.'}
            </p>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-slate-200 px-4 py-3 bg-white flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-2"><Cloud size={14}/> Cloud Encrypted</span>
            <span>Alex Morgan • Client</span>
          </div>
        )}
      </header>

      {/* Stats */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-[20px] bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="w-9 h-9 rounded-xl bg-[#0F2A44] text-white grid place-items-center"><Layers size={16}/></span>
              <span className="text-[10px] font-bold tracking-[0.12em] px-2 py-1 rounded-full bg-slate-100">CLOUD</span>
            </div>
            <p className="text-2xl font-bold font-[Fraunces]">{loading? '—': documents.length}</p>
            <p className="text-[11px] tracking-[0.12em] font-semibold text-slate-500">TOTAL DOCUMENTS</p>
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><ArrowUpRight size={12}/> +3 this week</p>
          </div>
          <div className="rounded-[20px] bg-[#0F2A44] text-white p-4 sm:p-5 shadow-lg overflow-hidden relative">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl"/>
            <div className="flex items-center justify-between mb-3 relative">
              <span className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center"><Clock3 size={16}/></span>
              <span className="text-[10px] font-bold tracking-[0.12em] px-2 py-1 rounded-full bg-amber-400 text-[#0F2A44]">ALERT</span>
            </div>
            <p className="text-2xl font-bold font-[Fraunces] relative">{loading? '—': pendingCount}</p>
            <p className="text-[11px] tracking-[0.12em] font-semibold text-white/70 relative">PENDING REVIEW</p>
            <p className="text-xs text-white/80 mt-1 relative">{expiringSoon} expiring in 30d</p>
          </div>
          <div className="rounded-[20px] bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white grid place-items-center"><CheckCircle2 size={16}/></span>
              <span className="text-xs font-bold text-emerald-600">✓ Signed</span>
            </div>
            <p className="text-2xl font-bold font-[Fraunces]">{loading? '—': signedCount}</p>
            <p className="text-[11px] tracking-[0.12em] font-semibold text-slate-500">E-SIGNED</p>
            <p className="text-xs text-slate-500 mt-1">Legally binding • Cloud notary</p>
          </div>
          <div className="rounded-[20px] bg-[#C9A86A] text-white p-4 sm:p-5 shadow-lg shadow-[#C9A86A]/20">
            <div className="flex items-center justify-between mb-3">
              <span className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center"><Shield size={16}/></span>
              <span className="text-[10px] font-bold tracking-[0.12em] px-2 py-1 rounded-full bg-white text-[#C9A86A]">SECURE</span>
            </div>
            <p className="text-2xl font-bold font-[Fraunces]">{matters.length}</p>
            <p className="text-[11px] tracking-[0.12em] font-semibold text-white/90">ACTIVE MATTERS</p>
            <p className="text-xs text-white/90 mt-1">{matters.filter(m=>m.status==='Open').length} open • {matters.filter(m=>m.priority==='High').length} high priority</p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 mt-6 pb-12">
        <div className="grid grid-cols-12 gap-6">
          {/* Left panel */}
          <div className="col-span-12 lg:col-span-8">
            {/* Controls */}
            <div className="bg-white rounded-[20px] border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents, categories, matters..." className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20 focus:border-[#0F2A44] text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="pl-8 pr-8 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none">
                      {categories.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none">
                    <option value="All">All Status</option>
                    {statuses.map(s=><option key={s} value={s}>{s}</option>)}
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold tracking-[0.08em]">
                <span className="px-3 py-1.5 rounded-full bg-[#0F2A44] text-white">{filteredDocs.length} DOCUMENTS</span>
                {expiringSoon>0 && <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><AlertTriangle size={12}/> {expiringSoon} EXPIRING SOON</span>}
                <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border">ENCRYPTED CLOUD STORAGE</span>
                <span className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-white border text-slate-500">AES-256 • Versioned</span>
              </div>
            </div>

            {/* Document Grid/List */}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {[1,2,3,4].map(i=><div key={i} className="h-48 rounded-[20px] bg-white border border-slate-100 animate-pulse"/> )}
              </div>
            ) : filteredDocs.length===0 ? (
              <div className="mt-4 rounded-[20px] bg-white border border-dashed border-slate-300 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3"><FileSearch size={22} className="text-slate-400"/></div>
                <p className="font-bold">No documents found</p>
                <p className="text-sm text-slate-500">Try adjusting filters or upload a new document to your cloud vault.</p>
                <button onClick={()=>setShowUpload(true)} className="mt-4 px-5 py-2.5 rounded-xl bg-[#0F2A44] text-white text-sm font-bold">Upload to Cloud</button>
              </div>
            ) : direction==='client' ? (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {filteredDocs.map(doc=>{
                  const days = daysUntilExpiry(doc.expiry_date)
                  const isExpiring = days!==null && days<=30 && days>=0
                  const isExpired = days!==null && days<0 || doc.status==='Expired'
                  return (
                    <motion.div key={doc.id} layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} onClick={()=>setSelectedDoc(doc)} className="group cursor-pointer rounded-[20px] bg-white border border-slate-200 p-4 hover:shadow-xl hover:shadow-slate-200/60 hover:border-slate-300 transition-all overflow-hidden relative">
                      {isExpired && <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"/>}
                      {isExpiring && !isExpired && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"/>}
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0F2A44] text-white grid place-items-center shrink-0"><FileText size={18}/></div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${statusColor(doc.status)}`}>{doc.status.toUpperCase()}</span>
                      </div>
                      <h3 className="mt-3 font-bold leading-tight line-clamp-2 group-hover:text-[#0F2A44]">{doc.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><span className="px-2 py-1 rounded-full bg-slate-100 border text-[11px] font-semibold">{doc.category}</span> <span className="hidden sm:inline">• v{doc.version}</span> <span>• {doc.file_size}</span></p>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="flex items-center gap-1"><Briefcase size={12}/> {doc.matters?.title || 'No matter'}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={12}/> {doc.expiry_date ? `Expires ${formatDate(doc.expiry_date)}` : 'No expiry'}</span>
                        {doc.is_signed && <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><PenLine size={12}/> SIGNED</span>}
                      </div>
                      {(isExpiring || isExpired) && (
                        <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${isExpired ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                          <AlertTriangle size={14}/> {isExpired ? 'Expired — renewal required' : `Expiring in ${days} days — renew soon`}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Updated {formatDate(doc.updated_at)}</span>
                        <span className="flex items-center gap-1 font-semibold text-[#0F2A44]">Manage <ChevronRight size={14}/></span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredDocs.map(doc=>{
                  const days = daysUntilExpiry(doc.expiry_date)
                  return (
                    <div key={doc.id} onClick={()=>setSelectedDoc(doc)} className="group cursor-pointer bg-white border border-slate-200 rounded-[20px] p-4 hover:shadow-lg transition flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border grid place-items-center shrink-0"><FileText size={20} className="text-[#0F2A44]"/></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold leading-tight truncate">{doc.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColor(doc.status)}`}>{doc.status}</span>
                          {doc.is_signed && <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">SIGNED</span>}
                          {days!==null && days<=30 && days>=0 && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border text-[10px] font-bold">{days}d left</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{doc.category} • {doc.owner_name} • {doc.file_name} • v{doc.version} • {doc.matters?.title || 'No matter'}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                        {doc.status==='Pending Review' && (
                          <>
                            <button onClick={(e)=>{e.stopPropagation(); approveDoc(doc)}} className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold">Approve</button>
                            <button onClick={(e)=>{e.stopPropagation(); rejectDoc(doc)}} className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold">Reject</button>
                          </>
                        )}
                        <button className="p-2 rounded-xl bg-[#0F2A44] text-white group-hover:bg-[#0F2A44]/90"><Eye size={14}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right panel: Matters + Audit */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Matters */}
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 pb-3 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><Briefcase size={16}/> Matters & Cases</h3>
                <button onClick={()=>setShowMatterModal(true)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0F2A44] text-white hover:bg-black">+ New Matter</button>
              </div>
              <div className="px-3 pb-3 space-y-3 max-h-[420px] overflow-auto">
                {matters.map(m=>(
                  <div key={m.id} className="rounded-2xl border border-slate-200 p-3 hover:border-[#0F2A44]/20 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm leading-tight line-clamp-2">{m.title}</h4>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide ${m.status==='Open'?'bg-emerald-50 text-emerald-700 border border-emerald-200': m.status==='In Review'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-600'}`}>{m.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{m.client_name} • {m.type}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span className={`px-2 py-1 rounded-full font-bold ${m.priority==='High'?'bg-red-500 text-white': m.priority==='Medium'?'bg-amber-400 text-[#0F2A44]':'bg-slate-200'}`}>{m.priority}</span>
                      <span className="flex items-center gap-1 text-slate-500"><Calendar size={11}/> Due {formatDate(m.due_date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{documents.filter(d=>d.matter_id===m.id).length} documents</span>
                      <span>•</span>
                      <span>{m.description?.slice(0,48) || 'No description'}</span>
                    </div>
                  </div>
                ))}
                {matters.length===0 && <p className="text-sm text-slate-500 text-center py-8">No matters yet. Create one to organize documents.</p>}
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-[#0F2A44] text-white rounded-[20px] p-5 shadow-xl overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-3xl"/>
              <div className="flex items-center justify-between relative">
                <h3 className="font-bold flex items-center gap-2"><History size={16}/> Cloud Audit Trail</h3>
                <span className="text-[10px] font-bold tracking-[0.12em] px-2 py-1 rounded-full bg-white/15">LIVE • IMMUTABLE</span>
              </div>
              <p className="text-xs text-white/70 mt-1 relative">Every action versioned & timestamped in the cloud</p>
              <div className="mt-4 space-y-3 max-h-[360px] overflow-auto pr-1 relative">
                {activities.slice(0,12).map(a=>(
                  <div key={a.id} className="flex gap-3">
                    <div className="mt-1 w-7 h-7 rounded-full bg-white/10 border border-white/20 grid place-items-center shrink-0"><Zap size={12} className="text-amber-300"/></div>
                    <div className="flex-1 min-w-0 pb-3 border-b border-white/10 last:border-0">
                      <p className="text-sm font-semibold leading-tight">{a.action} <span className="font-normal text-white/70">• Doc #{a.document_id}</span></p>
                      <p className="text-xs text-white/70 line-clamp-2">{a.details}</p>
                      <p className="text-[11px] text-white/50 mt-1 flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white">{a.role}</span> {a.actor} • {new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {activities.length===0 && <p className="text-sm text-white/60 text-center py-6">No activity yet.</p>}
              </div>
            </div>

            {/* Cloud Benefits */}
            <div className="rounded-[20px] bg-white border border-slate-200 p-5">
              <h3 className="font-bold flex items-center gap-2"><Cloud size={16} className="text-[#C9A86A]"/> Why Cloud-Based?</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                <div className="flex gap-3 p-3 rounded-2xl bg-slate-50 border">
                  <span className="w-9 h-9 rounded-xl bg-[#0F2A44] text-white grid place-items-center shrink-0"><Lock size={14}/></span>
                  <div><p className="font-bold text-sm">Zero-trust & Encrypted</p><p className="text-xs text-slate-500">AES-256 at rest, TLS 1.3 in transit, RBAC per matter.</p></div>
                </div>
                <div className="flex gap-3 p-3 rounded-2xl bg-slate-50 border">
                  <span className="w-9 h-9 rounded-xl bg-[#C9A86A] text-white grid place-items-center shrink-0"><Layers size={14}/></span>
                  <div><p className="font-bold text-sm">Versioned & Recoverable</p><p className="text-xs text-slate-500">Every edit creates a version. Restore any point in time.</p></div>
                </div>
                <div className="flex gap-3 p-3 rounded-2xl bg-slate-50 border">
                  <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white grid place-items-center shrink-0"><Zap size={14}/></span>
                  <div><p className="font-bold text-sm">Always Available</p><p className="text-xs text-slate-500">Global CDN, 99.99% SLA, auto-expiry & e-sign from anywhere.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Detail Drawer */}
      <AnimatePresence>
        {selectedDoc && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSelectedDoc(null)} className="fixed inset-0 bg-[#0F2A44]/60 backdrop-blur-sm z-50"/>
            <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:28,stiffness:260}} className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-white z-50 shadow-2xl flex flex-col">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0F2A44] text-white grid place-items-center shrink-0"><FileText size={20}/></div>
                    <div>
                      <h3 className="font-bold leading-tight">{selectedDoc.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2"><span className="px-2 py-1 rounded-full bg-white border text-[11px] font-bold">{selectedDoc.category}</span> v{selectedDoc.version} • {selectedDoc.file_size} • {selectedDoc.file_name}</p>
                    </div>
                  </div>
                  <button onClick={()=>setSelectedDoc(null)} className="p-2 rounded-xl bg-white border hover:bg-slate-50"><X size={18}/></button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusColor(selectedDoc.status)}`}>{selectedDoc.status}</span>
                  {selectedDoc.is_signed ? <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"><ShieldCheck size={14}/> Legally Signed</span> : <span className="px-3 py-1.5 rounded-full bg-slate-100 border text-xs font-bold">Not signed</span>}
                  <span className="text-xs text-slate-500 flex items-center gap-1"><Cloud size={12}/> {selectedDoc.cloud_path || 'cloud://vault/docs'}</span>
                </div>
                {/* Expiry alert */}
                {(() => {
                  const d = daysUntilExpiry(selectedDoc.expiry_date)
                  if(d===null) return null
                  if(d<0) return <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={16}/> Expired {Math.abs(d)} days ago — renewal required</div>
                  if(d<=30) return <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle size={16}/> Expires in {d} days — {formatDate(selectedDoc.expiry_date)}</div>
                  return <div className="mt-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2"><Calendar size={16}/> Valid until {formatDate(selectedDoc.expiry_date)} ({d} days remaining)</div>
                })()}
              </div>

              <div className="flex-1 overflow-auto">
                <div className="p-6 space-y-6">
                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    {direction==='client' ? (
                      <>
                        {!selectedDoc.is_signed ? (
                          <button onClick={()=>signDocument(selectedDoc)} className="col-span-2 py-3.5 rounded-xl bg-[#0F2A44] hover:bg-black text-white font-bold flex items-center justify-center gap-2"><PenLine size={16}/> E-Sign Document (Cloud Notary)</button>
                        ) : (
                          <div className="col-span-2 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Already e-signed • Tamper-evident seal applied</div>
                        )}
                        <a href={selectedDoc.file_url} target="_blank" rel="noreferrer" className="py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50"><Download size={16}/> Download</a>
                        <button onClick={()=>window.open(selectedDoc.file_url,'_blank')} className="py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50"><Eye size={16}/> Preview</button>
                        {selectedDoc.status!=='Pending Review' && <button onClick={()=>updateDoc(selectedDoc.id,{status:'Pending Review', actor:'Alex Morgan', actor_role:'Client'})} className="col-span-2 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#0F2A44] font-bold text-sm">Resubmit for Review</button>}
                      </>
                    ) : (
                      <>
                        <button onClick={()=>approveDoc(selectedDoc)} disabled={selectedDoc.status==='Approved'} className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Approve</button>
                        <button onClick={()=>rejectDoc(selectedDoc)} disabled={selectedDoc.status==='Rejected'} className="py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-bold flex items-center justify-center gap-2"><X size={16}/> Reject</button>
                        <button onClick={()=>requestRevision(selectedDoc)} className="py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-sm border border-amber-200">Request Revision → Draft</button>
                        <a href={selectedDoc.file_url} target="_blank" rel="noreferrer" className="py-2.5 rounded-xl bg-[#0F2A44] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-black"><Download size={16}/> Download</a>
                      </>
                    )}
                    <button onClick={()=>deleteDoc(selectedDoc.id)} className="col-span-2 py-2 rounded-xl bg-white border border-red-200 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-50"><Trash2 size={14}/> Delete from Cloud Vault</button>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-2xl bg-slate-50 border"><p className="text-[11px] font-bold tracking-[0.1em] text-slate-500">OWNER</p><p className="font-semibold mt-1">{selectedDoc.owner_name}</p><p className="text-xs text-slate-500">{selectedDoc.owner_email}</p></div>
                    <div className="p-3 rounded-2xl bg-slate-50 border"><p className="text-[11px] font-bold tracking-[0.1em] text-slate-500">MATTER</p><p className="font-semibold mt-1">{selectedDoc.matters?.title || matters.find(m=>m.id===selectedDoc.matter_id)?.title || '— No matter —'}</p><p className="text-xs text-slate-500">{formatDate(selectedDoc.created_at)} • Updated {formatDate(selectedDoc.updated_at)}</p></div>
                  </div>

                  {/* Version & Cloud Path */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <h4 className="font-bold text-sm flex items-center gap-2"><Layers size={14}/> Version & Cloud Storage</h4>
                      <span className="text-[11px] font-mono px-2 py-1 rounded bg-white border">v{selectedDoc.version}.0</span>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#0F2A44] text-white">
                        <span className="flex items-center gap-2 text-xs font-mono"><Cloud size={14}/> {selectedDoc.cloud_path || 'vault://encrypted/docs'}</span>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500 font-bold">ENCRYPTED</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"/> Version history preserved • Rollback available • Checksum verified
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>updateDoc(selectedDoc.id,{ version: selectedDoc.version+1, actor: direction==='counsel'?'Sarah Chen':'Alex Morgan', actor_role: direction==='counsel'?'Counsel':'Client', activity_details:`New version v${selectedDoc.version+1} uploaded`})} className="flex-1 py-2 rounded-xl bg-white border font-bold text-sm hover:bg-slate-50">+ New Version</button>
                        <button className="flex-1 py-2 rounded-xl bg-white border font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1"><History size={14}/> History</button>
                      </div>
                    </div>
                  </div>

                  {/* Annotations */}
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 mb-3"><FileSearch size={16}/> Annotations & Review Notes <span className="ml-auto text-xs font-mono px-2 py-1 rounded-full bg-slate-100 border">{annotations.length}</span></h4>
                    <div className="space-y-3 max-h-[220px] overflow-auto pr-1">
                      {annotations.map(an=>(
                        <div key={an.id} className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{an.author} <span className="px-1.5 py-0.5 rounded bg-white border text-[10px]">{an.role}</span></span>
                            <span className="text-[11px] text-slate-500">{new Date(an.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm mt-1 leading-relaxed">{an.comment}</p>
                        </div>
                      ))}
                      {annotations.length===0 && <p className="text-sm text-slate-500 text-center py-6 border border-dashed rounded-2xl">No annotations yet. {direction==='counsel' ? 'Add review notes for the client.' : 'Counsel feedback will appear here.'}</p>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input value={annotationText} onChange={e=>setAnnotationText(e.target.value)} placeholder={direction==='counsel' ? 'Add annotation (e.g., Clause 4 needs revision)...' : 'Reply to counsel...'} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20 text-sm" />
                      <button onClick={addAnnotation} className="px-5 py-3 rounded-xl bg-[#C9A86A] hover:bg-[#b8975d] text-white font-bold text-sm">Post</button>
                    </div>
                  </div>

                  {/* Access History mini */}
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 mb-3"><ShieldCheck size={16}/> Access & Audit History</h4>
                    <div className="space-y-2">
                      {activities.filter(a=>a.document_id===selectedDoc.id).slice(0,6).map(a=>(
                        <div key={a.id} className="flex gap-3 p-2.5 rounded-xl bg-slate-50 border">
                          <span className="w-8 h-8 rounded-full bg-white border grid place-items-center shrink-0"><Clock3 size={12}/></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-none">{a.action}</p>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{a.details}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{a.actor} • {new Date(a.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>!uploading && setShowUpload(false)} className="fixed inset-0 bg-[#0F2A44]/60 backdrop-blur-sm z-50"/>
            <motion.div initial={{opacity:0, scale:0.96, y:10}} animate={{opacity:1, scale:1, y:0}} exit={{opacity:0, scale:0.96}} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-[560px] bg-white rounded-[24px] shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-auto">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0F2A44] text-white grid place-items-center"><Upload size={18}/></div>
                  <div>
                    <h3 className="font-bold">Upload to Cloud Vault</h3>
                    <p className="text-xs text-slate-500">Encrypted • Versioned • Audit-trailed • Expiry-tracked</p>
                  </div>
                </div>
                <button onClick={()=>setShowUpload(false)} className="p-2 rounded-xl bg-white border"><X size={18}/></button>
              </div>
              <form onSubmit={handleUpload} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold tracking-[0.1em] text-slate-600">DOCUMENT TITLE *</label>
                  <input value={newDoc.title} onChange={e=>setNewDoc({...newDoc, title:e.target.value})} placeholder="e.g., Master Service Agreement — Acme Corp" className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20 focus:border-[#0F2A44]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold tracking-[0.1em] text-slate-600">CATEGORY</label>
                    <select value={newDoc.category} onChange={e=>setNewDoc({...newDoc, category:e.target.value})} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 bg-white">
                      {categories.filter(c=>c!=='All').map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-[0.1em] text-slate-600">MATTER / CASE</label>
                    <select value={newDoc.matter_id} onChange={e=>setNewDoc({...newDoc, matter_id:e.target.value})} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 bg-white">
                      <option value="">— No matter —</option>
                      {matters.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-[0.1em] text-slate-600">EXPIRY DATE (for alerts)</label>
                  <input type="date" value={newDoc.expiry_date} onChange={e=>setNewDoc({...newDoc, expiry_date:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20" />
                  <p className="text-[11px] text-slate-500 mt-1">We’ll alert you 30, 14 and 3 days before expiry via cloud notifications.</p>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-[0.1em] text-slate-600">FILE * (PDF, DOCX, PNG)</label>
                  <div onClick={()=>fileRef.current?.click()} className="mt-1 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-[#0F2A44] hover:bg-slate-50 cursor-pointer transition group">
                    <div className="w-12 h-12 rounded-xl bg-[#0F2A44] text-white grid place-items-center mx-auto group-hover:scale-105 transition"><Cloud size={20}/></div>
                    <p className="font-bold mt-3 text-sm">{newDoc.file ? newDoc.file.name : 'Click to choose or drag file here'}</p>
                    <p className="text-xs text-slate-500 mt-1">{newDoc.file ? `${(newDoc.file.size/1024).toFixed(1)} KB • Will be encrypted in cloud` : 'Max 25 MB • Encrypted at rest (AES-256) & in transit'}</p>
                    <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.doc,.png,.jpg" onChange={e=>setNewDoc({...newDoc, file: e.target.files?.[0] || null })} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowUpload(false)} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={uploading} className="flex-1 py-3 rounded-xl bg-[#C9A86A] hover:bg-[#b8975d] disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2">
                    {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Encrypting & Uploading...</> : <><Sparkles size={16}/> Upload Securely</>}
                  </button>
                </div>
                <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1"><ShieldCheck size={12}/> Your file is encrypted, versioned and logged. Meets eIDAS & ESIGN compliance.</p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New Matter Modal */}
      <AnimatePresence>
        {showMatterModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowMatterModal(false)} className="fixed inset-0 bg-[#0F2A44]/60 backdrop-blur-sm z-50"/>
            <motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.96}} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-[520px] bg-white rounded-[24px] shadow-2xl z-50 overflow-hidden">
              <div className="px-6 py-5 border-b flex items-center justify-between bg-slate-50">
                <h3 className="font-bold flex items-center gap-2"><Briefcase size={18}/> New Matter / Case</h3>
                <button onClick={()=>setShowMatterModal(false)} className="p-2 rounded-xl bg-white border"><X size={18}/></button>
              </div>
              <form onSubmit={createMatter} className="p-6 space-y-3">
                <input required value={newMatter.title} onChange={e=>setNewMatter({...newMatter, title:e.target.value})} placeholder="Matter title (e.g., Acme Merger — Due Diligence)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20" />
                <div className="grid grid-cols-2 gap-3">
                  <input required value={newMatter.client_name} onChange={e=>setNewMatter({...newMatter, client_name:e.target.value})} placeholder="Client name" className="px-4 py-3 rounded-xl border border-slate-200" />
                  <input value={newMatter.client_email} onChange={e=>setNewMatter({...newMatter, client_email:e.target.value})} placeholder="Client email" className="px-4 py-3 rounded-xl border border-slate-200" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select value={newMatter.type} onChange={e=>setNewMatter({...newMatter, type:e.target.value})} className="px-3 py-3 rounded-xl border bg-white"><option>Corporate</option><option>Litigation</option><option>Real Estate</option><option>Intellectual Property</option><option>Compliance</option><option>Employment</option></select>
                  <select value={newMatter.status} onChange={e=>setNewMatter({...newMatter, status:e.target.value})} className="px-3 py-3 rounded-xl border bg-white"><option>Open</option><option>In Review</option><option>On Hold</option><option>Closed</option></select>
                  <select value={newMatter.priority} onChange={e=>setNewMatter({...newMatter, priority:e.target.value})} className="px-3 py-3 rounded-xl border bg-white"><option>Low</option><option>Medium</option><option>High</option></select>
                </div>
                <input type="date" value={newMatter.due_date} onChange={e=>setNewMatter({...newMatter, due_date:e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                <textarea value={newMatter.description} onChange={e=>setNewMatter({...newMatter, description:e.target.value})} placeholder="Description / scope" rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowMatterModal(false)} className="flex-1 py-3 rounded-xl border font-bold">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl bg-[#0F2A44] text-white font-bold">Create Matter</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-2 font-semibold tracking-wide"><span className="w-7 h-7 rounded-lg bg-[#0F2A44] text-white grid place-items-center"><Scale size={14}/></span> LEXCLOUD • Cloud-Based Legal Document Management • © 2026</span>
          <span className="flex items-center gap-3"><span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> All systems operational</span><span>GDPR • SOC 2 • ISO 27001 • eIDAS</span></span>
        </div>
      </footer>
    </div>
  )
}
