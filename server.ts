import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client Initialization
const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("Supabase credentials missing. App will run in limited mode.");
    return null;
  }
  return createClient(url, key);
};

const supabase = getSupabase();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  app.use(express.json());

  // WebSocket Broadcast Helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name, role, field, location } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const adminEmail = process.env.ADMIN_EMAIL || "justinwilson9017@gmail.com";
      const isAdmin = email === adminEmail ? 1 : 0;
      const finalRole = isAdmin ? "admin" : role;
      
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          email, 
          password, 
          name, 
          role: finalRole, 
          field, 
          location: location || '', 
          is_admin: isAdmin 
        }])
        .select()
        .single();

      if (error) throw error;
      res.json({ ...data, isAdmin: !!data.is_admin });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const adminEmail = process.env.ADMIN_EMAIL || "justinwilson9017@gmail.com";
      const adminPassword = process.env.ADMIN_PASSWORD || "admin706";
      // Special case for the requested admin credentials
      if (email === adminEmail && password === adminPassword) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (!existingUser) {
          const { data: newUser, error } = await supabase
            .from('users')
            .insert([{ email, password, name: "Super Admin", role: "admin", is_admin: 1 }])
            .select()
            .single();
          if (error) throw error;
          return res.json({ ...newUser, isAdmin: true });
        } else {
          await supabase.from('users').update({ is_admin: 1, role: 'admin' }).eq('email', email);
          return res.json({ ...existingUser, is_admin: 1, role: 'admin', isAdmin: true });
        }
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (user) {
        res.json({ ...user, isAdmin: !!user.is_admin });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (e) {
      res.status(401).json({ error: "Login failed" });
    }
  });

  // Profile Update
  app.put("/api/profile", async (req, res) => {
    const { id, name, email, location, picture } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ name, email, location, picture })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ ...data, isAdmin: !!data.is_admin });
    } catch (e) {
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  // Job Routes
  app.get("/api/jobs", async (req, res) => {
    const { field } = req.query;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      let query = supabase
        .from('jobs')
        .select('*, hirer:users(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (field) {
        query = query.eq('field', field);
      }

      const { data: jobs, error } = await query;
      if (error) throw error;

      // Flatten hirer name
      const formattedJobs = (jobs || []).map(j => ({
        ...j,
        hirer_name: (j as any).hirer?.name
      }));

      res.json(formattedJobs);
    } catch (e: any) {
      console.error("Fetch jobs error:", e);
      res.status(500).json({ error: e.message || "Failed to fetch jobs" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    const { hirer_id, title, description, field, budget, location } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const { data: newJob, error } = await supabase
        .from('jobs')
        .insert([{ hirer_id, title, description, field, budget, location: location || '' }])
        .select()
        .single();

      if (error) throw error;
      broadcast({ type: "NEW_JOB", job: newJob });
      res.json(newJob);
    } catch (e) {
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.get("/api/jobs/hirer/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('hirer_id', req.params.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: "Failed to fetch hirer jobs" });
    res.json(jobs);
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    await supabase.from('jobs').update({ status: 'deleted' }).eq('id', req.params.id);
    broadcast({ type: "JOB_DELETED", jobId: req.params.id });
    res.json({ success: true });
  });

  app.put("/api/jobs/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, field, budget, location } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      await supabase
        .from('jobs')
        .update({ title, description, field, budget, location })
        .eq('id', id);
      broadcast({ type: "JOB_UPDATED", jobId: id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // Bid Routes
  app.post("/api/bids", async (req, res) => {
    const { job_id, worker_id, amount, message } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const { data: newBid, error } = await supabase
        .from('bids')
        .insert([{ job_id, worker_id, amount, message }])
        .select()
        .single();

      if (error) throw error;
      broadcast({ type: "NEW_BID", bid: newBid });
      res.json(newBid);
    } catch (e) {
      res.status(500).json({ error: "Failed to create bid" });
    }
  });

  app.get("/api/bids/job/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const { data: bids, error } = await supabase
      .from('bids')
      .select('*, worker:users(name, picture)')
      .eq('job_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch bids error:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch bids" });
    }
    
    const formattedBids = (bids || []).map(b => ({
      ...b,
      worker_name: (b as any).worker?.name,
      worker_picture: (b as any).worker?.picture
    }));
    
    res.json(formattedBids);
  });

  app.get("/api/bids/worker/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const { data: bids, error } = await supabase
      .from('bids')
      .select('*, job:jobs(title, location)')
      .eq('worker_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch worker bids error:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch worker bids" });
    }

    const formattedBids = (bids || []).map(b => ({
      ...b,
      job_title: (b as any).job?.title,
      job_location: (b as any).job?.location
    }));

    res.json(formattedBids);
  });

  app.delete("/api/bids/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    await supabase.from('bids').delete().eq('id', req.params.id);
    broadcast({ type: "BID_DELETED", bidId: req.params.id });
    res.json({ success: true });
  });

  app.post("/api/bids/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    await supabase.from('bids').update({ status }).eq('id', req.params.id);
    broadcast({ type: "BID_STATUS_UPDATED", bidId: req.params.id, status });
    res.json({ success: true });
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, field, is_admin, created_at')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: "Failed to fetch users" });
    res.json(users);
  });

  app.post("/api/admin/jobs/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    await supabase.from('jobs').update({ status }).eq('id', req.params.id);
    broadcast({ type: "JOB_STATUS_UPDATED", jobId: req.params.id, status });
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    await supabase.from('users').delete().eq('id', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/admin/stats", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    
    try {
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: totalJobs } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
      const { count: totalBids } = await supabase.from('bids').select('*', { count: 'exact', head: true });
      
      // Grouping logic for stats (Supabase doesn't support GROUP BY directly in simple select, so we might need a RPC or just fetch and process)
      const { data: allJobs } = await supabase.from('jobs').select('field');
      const { data: allUsers } = await supabase.from('users').select('role');

      const jobsByField = allJobs ? Object.entries(
        allJobs.reduce((acc: any, curr) => {
          acc[curr.field] = (acc[curr.field] || 0) + 1;
          return acc;
        }, {})
      ).map(([field, count]) => ({ field, count })) : [];

      const usersByRole = allUsers ? Object.entries(
        allUsers.reduce((acc: any, curr) => {
          acc[curr.role] = (acc[curr.role] || 0) + 1;
          return acc;
        }, {})
      ).map(([role, count]) => ({ role, count })) : [];

      res.json({
        totalUsers,
        totalJobs,
        totalBids,
        jobsByField,
        usersByRole
      });
    } catch (e: any) {
      console.error("Fetch stats error:", e);
      res.status(500).json({ error: e.message || "Failed to fetch stats" });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
