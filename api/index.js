import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dbRepo from '../db/index.js'; // Adjusted path
import { sendRegistrationEmail } from '../emailService.js'; // Adjusted path

/* ── Password Security ── */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return password === storedHash; 
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === hash;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Parse JSON body ── */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    const MAX_SIZE = 10 * 1024 * 1024; 
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > MAX_SIZE) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
    });
    req.on('error', (err) => reject(err));
  });
}

/* ── CORS headers ── */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/* ── JSON response helper ── */
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

/* ── API Handler ── */
export default async function handler(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  const query = parsed.query;

  setCORS(res);

/* ── Debug Endpoint ── */
  if (req.method === 'GET' && normalizedPath === '/api/debug-files') {
    try {
      const files = fs.readdirSync(path.join(process.cwd()));
      const dbFiles = fs.existsSync(path.join(process.cwd(), 'db')) ? fs.readdirSync(path.join(process.cwd(), 'db')) : 'NOT FOUND';
      return sendJSON(res, 200, { cwd: process.cwd(), root: files, db: dbFiles });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  if (req.method === 'OPTIONS') {

    res.writeHead(204);
    return res.end();
  }

  // Handle /api/ prefix if it's there (for local testing or specific routing)
  const normalizedPath = pathname.startsWith('/api') ? pathname : `/api${pathname}`;

  /* Auth: Register */
  if (req.method === 'POST' && normalizedPath === '/api/auth/register') {
    try {
      const body = await readBody(req);
      if (!body.email || !body.password || !body.name) return sendJSON(res, 400, { error: 'Missing fields' });
      const existing = await dbRepo.getUserByEmail(body.email);
      if (existing) return sendJSON(res, 409, { error: 'User exists' });
      body.password = hashPassword(body.password);
      const result = await dbRepo.createUser(body);
      return sendJSON(res, 201, { success: true, userId: result.id });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Auth: Login */
  if (req.method === 'POST' && normalizedPath === '/api/auth/login') {
    try {
      const body = await readBody(req);
      const user = await dbRepo.getUserByEmail(body.email);
      if (!user || !verifyPassword(body.password, user.password)) return sendJSON(res, 401, { error: 'Invalid credentials' });
      return sendJSON(res, 200, { success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Donors: List All */
  if (req.method === 'GET' && normalizedPath === '/api/donors') {
    try {
      const donors = await dbRepo.getAllDonors();
      return sendJSON(res, 200, { total: donors.length, donors });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Donors: Save New */
  if (req.method === 'POST' && (normalizedPath === '/api/donors' || normalizedPath === '/api/register')) {
    try {
      const body = await readBody(req);
      const phoneKey = (body.phone || '').replace(/\D/g, '');
      const record = {
        donorId: body.donorId || `BHM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        name: body.name || '',
        dob: body.dob || '',
        bloodgroup: body.bloodgroup || 'N/A',
        type: body.type || '',
        organs: body.organs || [],
        city: body.city || '',
        phone: phoneKey,
        email: body.email || '',
        biometric: body.biometric || null,
        registeredOn: new Date().toLocaleDateString('en-IN'),
        timestamp: Date.now(),
        donated_count: 1,
        donated_detail: body.type,
      };
      const result = await dbRepo.saveDonor(record);
      return sendJSON(res, 201, { success: true, donorId: record.donorId });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Dashboard: Blood Groups */
  if (req.method === 'GET' && normalizedPath === '/api/dashboard/blood-groups') {
    try {
      const result = await dbRepo.getBloodGroupAvailability();
      return sendJSON(res, 200, { blood_group_availability: result });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Dashboard: Donation Types */
  if (req.method === 'GET' && normalizedPath === '/api/dashboard/donation-types') {
    try {
      const result = await dbRepo.getDonationTypeBreakdown();
      return sendJSON(res, 200, { donation_type_breakdown: result });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Dashboard: Cities */
  if (req.method === 'GET' && normalizedPath === '/api/dashboard/cities') {
    try {
      const result = await dbRepo.getCityWiseDistribution();
      return sendJSON(res, 200, { city_wise_distribution: result });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Stats */
  if (req.method === 'GET' && (normalizedPath === '/api/stats' || normalizedPath === '/api/analytics')) {
    try {
      const stats = await dbRepo.getStats();
      const byType = await dbRepo.countByType();
      return sendJSON(res, 200, { ...stats, by_type: byType });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Emergency Requests */
  if (req.method === 'GET' && normalizedPath === '/api/requests') {
    try {
      const requests = await dbRepo.getAllRequests();
      return sendJSON(res, 200, { requests });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Recent Donors */
  if (req.method === 'GET' && normalizedPath === '/api/donors/recent') {
    try {
      const donors = await dbRepo.getRecentDonors(query.limit || 10);
      return sendJSON(res, 200, { donors });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  /* Delete Donor */
  if (req.method === 'POST' && normalizedPath === '/api/donors/delete') {
    try {
      const body = await readBody(req);
      await dbRepo.deleteDonor(body.donorId);
      return sendJSON(res, 200, { success: true });
    } catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  // Default fallback for other API paths
  if (normalizedPath.startsWith('/api')) {
    return sendJSON(res, 404, { error: `Endpoint ${normalizedPath} not found` });
  }

  // If not an API call, it might be a static file request (handled by Vercel static normally)
  res.writeHead(404);
  res.end('Not Found');
}
