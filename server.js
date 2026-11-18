require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });
const PORT = Number(process.env.PORT || 3000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) console.warn('WARNING: JWT_SECRET should be set to a random string of at least 32 characters.');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 7 * 24 * 60 * 60 * 1000 };
const tokenFor = (user) => jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
async function auth(req, res, next) {
  const token = req.cookies.futbet_session;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.clearCookie('futbet_session'); return res.status(401).json({ error: 'Sesión vencida. Ingresa nuevamente.' }); }
}
function admin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acceso exclusivo de administración.' }); next(); }
function safeUser(u) { return { id: u.id, username: u.username, role: u.role, virtual_balance: Number(u.virtual_balance) }; }

app.get('/api/status', (req,res)=>res.json({app:'FUTBET',mode:'demo',currency:'virtual-only',realMoney:false}));
app.get('/api/events', async (req,res) => {
  try { const { rows } = await pool.query('SELECT * FROM events WHERE active=true ORDER BY starts_at NULLS LAST, id DESC'); res.json(rows); }
  catch(e){ console.error(e); res.status(500).json({error:'No se pudieron cargar los eventos.'}); }
});
app.post('/api/register', async (req,res) => {
  const username = String(req.body.username || '').trim(); const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,40}$/.test(username) || password.length < 10) return res.status(400).json({error:'Usuario: 3 a 40 caracteres (letras, números o _). Contraseña: mínimo 10 caracteres.'});
  try { const hash = await bcrypt.hash(password, 12); const { rows } = await pool.query('INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id,username,role,virtual_balance', [username,hash]); const user=rows[0]; res.cookie('futbet_session',tokenFor(user),cookieOpts).json({user:safeUser(user)}); }
  catch(e){ if(e.code==='23505') return res.status(409).json({error:'Ese usuario ya existe.'}); console.error(e); res.status(500).json({error:'No se pudo crear la cuenta.'}); }
});
app.post('/api/login', async (req,res) => {
  const username=String(req.body.username||'').trim(); const password=String(req.body.password||'');
  try { const { rows }=await pool.query('SELECT * FROM users WHERE username=$1',[username]); if(!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash))) return res.status(401).json({error:'Usuario o contraseña incorrectos.'}); res.cookie('futbet_session',tokenFor(rows[0]),cookieOpts).json({user:safeUser(rows[0])}); }
  catch(e){console.error(e);res.status(500).json({error:'Error al iniciar sesión.'});}
});
app.post('/api/logout',(req,res)=>res.clearCookie('futbet_session',{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true'}).json({ok:true}));
app.get('/api/me',auth,async(req,res)=>{try{const {rows}=await pool.query('SELECT id,username,role,virtual_balance FROM users WHERE id=$1',[req.user.id]); if(!rows[0])return res.status(401).json({error:'Cuenta no encontrada'});res.json({user:safeUser(rows[0])});}catch(e){console.error(e);res.status(500).json({error:'No se pudo leer la cuenta.'});}});
app.get('/api/tickets',auth,async(req,res)=>{try{const {rows}=await pool.query('SELECT id,stake,combined_odds,virtual_potential,picks,status,created_at FROM demo_tickets WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);res.json(rows);}catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar los boletos.'});}});
// Virtual-only tickets. All picks are revalidated server-side; never real money.
app.post('/api/tickets',auth,async(req,res)=>{
  const picks=req.body.picks; const stake=Number(req.body.stake);
  if(!Array.isArray(picks)||picks.length<1||picks.length>10||!Number.isFinite(stake)||stake<=0||stake>10000) return res.status(400).json({error:'Boleto inválido. Selecciona entre 1 y 10 eventos y un monto virtual válido.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN'); const u=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.user.id]); if(!u.rows[0])throw new Error('USER_NOT_FOUND'); if(Number(u.rows[0].virtual_balance)<stake)throw new Error('BALANCE_LOW');
    let odds=1; const validated=[];
    for(const pick of picks){const e=await client.query('SELECT id,sport,competition,home,away,odds_home,odds_draw,odds_away FROM events WHERE id=$1 AND active=true FOR SHARE',[Number(pick.eventId)]);if(!e.rows[0])throw new Error('EVENT_INVALID');const ev=e.rows[0];const outcomes=['Local','Empate','Visitante'];const idx=Number(pick.outcome);if(!Number.isInteger(idx)||idx<0||idx>2)throw new Error('PICK_INVALID');const price=[Number(ev.odds_home),Number(ev.odds_draw),Number(ev.odds_away)][idx];if(!price||price<=1)throw new Error('ODD_INVALID');odds*=price;validated.push({eventId:ev.id,sport:ev.sport,competition:ev.competition,home:ev.home,away:ev.away,outcome:outcomes[idx],odd:price});}
    const potential=Math.round(stake*odds*100)/100; await client.query('UPDATE users SET virtual_balance=virtual_balance-$1 WHERE id=$2',[stake,req.user.id]); const t=await client.query('INSERT INTO demo_tickets(user_id,stake,combined_odds,virtual_potential,picks) VALUES($1,$2,$3,$4,$5) RETURNING id',[req.user.id,stake,odds,potential,JSON.stringify(validated)]); await client.query('COMMIT');res.status(201).json({id:t.rows[0].id,stake,combined_odds:odds,virtual_potential:potential,picks:validated,note:'Boleto demo. No dinero real.'});
  }catch(e){await client.query('ROLLBACK');const messages={USER_NOT_FOUND:'Cuenta no encontrada.',BALANCE_LOW:'Saldo virtual insuficiente.',EVENT_INVALID:'Un evento ya no está disponible.',PICK_INVALID:'Selección no válida.',ODD_INVALID:'Cuota inválida.'};if(messages[e.message])return res.status(400).json({error:messages[e.message]});console.error(e);res.status(500).json({error:'No se pudo generar el boleto virtual.'});}finally{client.release();}
});
app.get('/api/admin/events',auth,admin,async(req,res)=>{try{const {rows}=await pool.query('SELECT * FROM events ORDER BY created_at DESC');res.json(rows);}catch(e){console.error(e);res.status(500).json({error:'No se cargaron los eventos.'});}});
app.post('/api/admin/events',auth,admin,async(req,res)=>{const b=req.body;const sport=String(b.sport||'').trim(),competition=String(b.competition||'').trim(),home=String(b.home||'').trim(),away=String(b.away||'').trim(),display_time=String(b.display_time||'').trim(),odds=[Number(b.odds_home),Number(b.odds_draw||0),Number(b.odds_away)];if(!sport||!competition||!home||!away||!display_time||odds.some(x=>!Number.isFinite(x)||x<0)||odds[0]<=1||odds[2]<=1)return res.status(400).json({error:'Revisa todos los datos y las cuotas.'});try{const {rows}=await pool.query('INSERT INTO events(sport,competition,display_time,home,away,odds_home,odds_draw,odds_away) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[sport,competition,display_time,home,away,...odds]);res.status(201).json(rows[0]);}catch(e){console.error(e);res.status(500).json({error:'No se pudo crear el evento.'});}});
app.patch('/api/admin/events/:id',auth,admin,async(req,res)=>{const odds=[Number(req.body.odds_home),Number(req.body.odds_draw||0),Number(req.body.odds_away)];if(odds.some(x=>!Number.isFinite(x)||x<0)||odds[0]<=1||odds[2]<=1)return res.status(400).json({error:'Cuotas inválidas.'});try{const {rows}=await pool.query('UPDATE events SET odds_home=$1,odds_draw=$2,odds_away=$3 WHERE id=$4 RETURNING *',[...odds,req.params.id]);if(!rows[0])return res.status(404).json({error:'Evento no encontrado.'});res.json(rows[0]);}catch(e){console.error(e);res.status(500).json({error:'No se pudieron modificar las cuotas.'});}});
app.delete('/api/admin/events/:id',auth,admin,async(req,res)=>{try{const {rows}=await pool.query('UPDATE events SET active=false WHERE id=$1 RETURNING id',[req.params.id]);if(!rows[0])return res.status(404).json({error:'Evento no encontrado.'});res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'No se pudo retirar el evento.'});}});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
async function bootstrap(){
  const username=process.env.ADMIN_USERNAME; const password=process.env.ADMIN_PASSWORD;
  if(username && password && password.length>=14){
    const hash=await bcrypt.hash(password,12);
    await pool.query('INSERT INTO users(username,password_hash,role) VALUES($1,$2,\'admin\') ON CONFLICT(username) DO UPDATE SET role=\'admin\', password_hash=EXCLUDED.password_hash', [username,hash]);
    console.log('Cuenta admin inicial configurada.');
  } else console.warn('Admin bootstrap omitido: configura ADMIN_USERNAME y ADMIN_PASSWORD (14+ caracteres).');
  app.listen(PORT,()=>console.log(`FUTBET demo listo en http://localhost:${PORT}`));
}
bootstrap().catch(e=>{console.error('Error inicializando FUTBET',e);process.exit(1);});
