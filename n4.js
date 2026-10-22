import supabase from './db-client.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { document_id } = req.query;
      let q = supabase.from('annotations').select('*').order('created_at', { ascending: true });
      if (document_id) q = q.eq('document_id', document_id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { data, error } = await supabase.from('annotations').insert(req.body).select().single();
      if (error) throw error;
      await supabase.from('activities').insert({ document_id: req.body.document_id, action: 'Annotated', actor: req.body.author, role: req.body.role || 'Counsel', details: `Comment added: "${req.body.comment.slice(0,60)}"` });
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('annotations').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
