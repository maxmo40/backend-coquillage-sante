const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration conditionnelle des services
let supabase;
let stripe;
let googleCalendar;

// Configuration Supabase conditionnelle
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('✅ Supabase configuré');
} else {
  console.warn('⚠️  Variables Supabase non définies - La base de données sera désactivée');
}

// Configuration Stripe conditionnelle
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe configuré');
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY non définie - Les paiements seront désactivés');
}

// Configuration Google Calendar conditionnelle
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALENDAR_ID) {
  const { google } = require('googleapis');
  
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  );
  
  // Utiliser un refresh token si disponible
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }
  
  googleCalendar = google.calendar({ version: 'v3', auth });
  console.log('✅ Google Calendar configuré');
} else {
  console.warn('⚠️  Variables Google Calendar non définies - L\'intégration calendrier sera désactivée');
}

// Middleware
const allowedOrigins = ['https://diet974.vercel.app', 'http://localhost:8080', 'http://localhost:3000'];
console.log('🌐 Origines CORS autorisées:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Coquillage Santé - Backend opérationnel',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      users: '/api/users',
      consultations: '/api/consultations',
      payments: '/api/payments'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase: !!supabase,
      stripe: !!stripe
    }
  });
});

// ===== API UTILISATEURS =====
app.get('/api/users', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { email, name, phone } = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, name, phone, created_at: new Date() }])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API CONSULTATIONS =====
app.get('/api/consultations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/consultations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { user_id, date, time, type, notes, patient_name, patient_email, patient_phone } = req.body;
    
    const { data, error } = await supabase
      .from('consultations')
      .insert([{ 
        user_id, 
        date, 
        time, 
        type, 
        notes, 
        patient_name,
        patient_email,
        patient_phone,
        status: 'pending',
        created_at: new Date() 
      }])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API PAIEMENTS STRIPE =====
app.post('/api/payments/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      error: 'Service de paiement non configuré',
      message: 'Stripe n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { amount, currency = 'eur', description } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/confirm', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      error: 'Service de paiement non configuré',
      message: 'Stripe n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { paymentIntentId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      if (supabase) {
        const { data, error } = await supabase
          .from('payments')
          .insert([{
            stripe_payment_id: paymentIntentId,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'completed',
            created_at: new Date()
          }])
          .select();
        
        if (error) throw error;
        
        res.json({ 
          success: true, 
          payment: data[0] 
        });
      } else {
        res.json({ 
          success: true, 
          message: 'Paiement confirmé (base de données non configurée)'
        });
      }
    } else {
      res.status(400).json({ 
        error: 'Paiement non confirmé' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API GOOGLE CALENDAR =====
app.post('/api/calendar/create-event', async (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré',
      message: 'Google Calendar n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const event = req.body;
    
    const calendarEvent = await googleCalendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      resource: event,
      sendUpdates: 'all', // Envoyer des notifications aux participants
    });
    
    // Sauvegarder dans Supabase si configuré
    if (supabase) {
      const { data, error } = await supabase
        .from('appointments')
        .insert([{
          google_event_id: calendarEvent.data.id,
          patient_name: event.attendees?.[0]?.displayName || '',
          patient_email: event.attendees?.[0]?.email || '',
          date: event.start.dateTime.split('T')[0],
          time: event.start.dateTime.split('T')[1].substring(0, 5),
          type: event.description?.split('\n')[0]?.replace('Type: ', '') || 'consultation',
          status: 'confirmed',
          created_at: new Date()
        }])
        .select();
      
      if (error) throw error;
    }
    
    res.json({ 
      success: true, 
      eventId: calendarEvent.data.id,
      event: calendarEvent.data 
    });
  } catch (error) {
    console.error('Erreur Google Calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendar/events', async (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré',
      message: 'Google Calendar n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { start, end } = req.query;
    
    const response = await googleCalendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    res.json({ 
      events: response.data.items || [] 
    });
  } catch (error) {
    console.error('Erreur Google Calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/calendar/events/:eventId', async (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré',
      message: 'Google Calendar n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { eventId } = req.params;
    
    await googleCalendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
    
    // Supprimer de Supabase si configuré
    if (supabase) {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('google_event_id', eventId);
      
      if (error) throw error;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur Google Calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/calendar/events/:eventId', async (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré',
      message: 'Google Calendar n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { eventId } = req.params;
    const updates = req.body;
    
    const response = await googleCalendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: eventId,
      resource: updates,
      sendUpdates: 'all',
    });
    
    // Mettre à jour Supabase si configuré
    if (supabase) {
      const { error } = await supabase
        .from('appointments')
        .update({
          patient_name: updates.attendees?.[0]?.displayName || '',
          patient_email: updates.attendees?.[0]?.email || '',
          date: updates.start?.dateTime?.split('T')[0] || '',
          time: updates.start?.dateTime?.split('T')[1]?.substring(0, 5) || '',
          updated_at: new Date()
        })
        .eq('google_event_id', eventId);
      
      if (error) throw error;
    }
    
    res.json({ 
      success: true, 
      event: response.data 
    });
  } catch (error) {
    console.error('Erreur Google Calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour l'authentification Google
app.get('/auth/google', (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré'
    });
  }
  
  const auth = googleCalendar.auth;
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  if (!googleCalendar) {
    return res.status(503).json({ 
      error: 'Service Google Calendar non configuré'
    });
  }
  
  try {
    const { code } = req.query;
    const auth = googleCalendar.auth;
    
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);
    
    console.log('✅ Authentification Google réussie');
    console.log('Refresh Token:', tokens.refresh_token);
    
    res.json({ 
      success: true, 
      message: 'Authentification réussie. Ajoutez le refresh_token à vos variables d\'environnement.' 
    });
  } catch (error) {
    console.error('Erreur authentification Google:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== API ADMIN =====
app.get('/api/admin/stats', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    // Récupérer tous les rendez-vous
    const { data: appointments, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Calculer les statistiques
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = {
      totalAppointments: appointments.length,
      confirmedAppointments: appointments.filter(apt => apt.status === 'confirmed').length,
      pendingAppointments: appointments.filter(apt => apt.status === 'pending').length,
      cancelledAppointments: appointments.filter(apt => apt.status === 'cancelled').length,
      thisWeekAppointments: appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= startOfWeek && aptDate <= now;
      }).length,
      thisMonthAppointments: appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= startOfMonth && aptDate <= now;
      }).length
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour mettre à jour un rendez-vous
app.put('/api/consultations/:id', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('consultations')
      .update({
        ...updates,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour supprimer un rendez-vous
app.delete('/api/consultations/:id', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer les rendez-vous avec filtres
app.get('/api/consultations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { start, end, status, type } = req.query;
    
    let query = supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Appliquer les filtres
    if (start && end) {
      query = query.gte('date', start).lte('date', end);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: err.message 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Coquillage démarré sur le port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Accueil: http://localhost:${PORT}/`);
});

module.exports = app;
